"""
Canvas Access Token Router for anticaos-lms.

Issues short-lived signed JWT access tokens (badges) for enrolled students
to securely load, save state, and request certificate sealing on interactive canvases.
"""

import logging
import os
from datetime import datetime, timedelta, timezone
from typing import Optional, Set

import jwt
from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from pydantic import BaseModel
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.core.events.database import get_db_session
from src.db.kit_certificates import KitCertificate
from src.db.kit_entitlements import KitEntitlement
from src.db.user_organizations import UserOrganization
from src.db.users import AnonymousUser, PublicUser, User
from src.security.auth import get_current_user
from src.security.rbac.constants import ADMIN_OR_MAINTAINER_ROLE_IDS
from src.services.certificates.constants import (
    FORMAL_TITLES,
    generate_certificate_code,
    titulo_formal_no_idioma,
)
from src.services.certificates.selo import SeloIndisponivel, kit_selado
from src.services.entitlements.acesso import _is_linha_valida, avaliar_acesso, normalizar_kit
from src.services.neuro.aulas import AULAS_DICT
from src.services.neuro.trava import sinapses_faltantes

logger = logging.getLogger(__name__)

router = APIRouter()

DEFAULT_CANVAS_TOKEN_TTL_MIN = 480
CANVAS_TOKEN_TTL_MIN = DEFAULT_CANVAS_TOKEN_TTL_MIN
MIN_CANVAS_TOKEN_TTL_MIN = 5
MAX_CANVAS_TOKEN_TTL_MIN = 1440
CANVAS_ALGO = "HS256"

VALID_KITS: Set[str] = {
    "p0",
    "p1",
    "p2",
    "p3",
    "p4",
    "p5",
    "p10",
    "termometro",
    "wifi",
    "profissional-indispensavel",
}


def _get_canvas_token_secret() -> str:
    """Retrieve the CANVAS_TOKEN_SECRET from environment (fail-closed)."""
    return os.environ.get("CANVAS_TOKEN_SECRET", "").strip()


def _get_default_org_id() -> int:
    """Retrieve default platform organization ID."""
    return int(os.environ.get("DEFAULT_ORG_ID", "1"))


def _get_canvas_token_ttl_min() -> int:
    """
    Lê a duração do crachá da variável de ambiente CANVAS_TOKEN_TTL_MIN.
    Padrão: 480 min (8 horas). Faixa válida: 5..1440 minutos.
    Valores inválidos, vazios ou fora da faixa geram warning e revertem ao padrão.
    """
    raw = os.environ.get("CANVAS_TOKEN_TTL_MIN")
    if raw is None or not raw.strip():
        return DEFAULT_CANVAS_TOKEN_TTL_MIN
    try:
        val = int(raw.strip())
        if MIN_CANVAS_TOKEN_TTL_MIN <= val <= MAX_CANVAS_TOKEN_TTL_MIN:
            return val
        logger.warning(
            f"[Canvas Access] CANVAS_TOKEN_TTL_MIN={val} fora da faixa permitida "
            f"({MIN_CANVAS_TOKEN_TTL_MIN}..{MAX_CANVAS_TOKEN_TTL_MIN}). Usando padrão {DEFAULT_CANVAS_TOKEN_TTL_MIN} min."
        )
    except (ValueError, TypeError):
        logger.warning(
            f"[Canvas Access] CANVAS_TOKEN_TTL_MIN='{raw}' inválido. Usando padrão {DEFAULT_CANVAS_TOKEN_TTL_MIN} min."
        )
    return DEFAULT_CANVAS_TOKEN_TTL_MIN


@router.get(
    "/access-token",
    summary="Emite crachá assinado para o canvas (aluno logado e com acesso ao Kit)",
    status_code=status.HTTP_200_OK,
)
async def issue_canvas_token(
    kit: str = Query(..., min_length=2, max_length=50, description="Slug do Kit canvas"),
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
):
    """
    Emite crachá JWT HS256 com duração configurável (padrão 8h, limitada à validade do direito).

    Fail-closed:
    - 500 if CANVAS_TOKEN_SECRET is missing
    - 401 if user is unauthenticated or anonymous
    - 400 if kit is invalid
    - 403 (string detail) if user is not enrolled in the platform organization
    - 403 (structured dict detail) if student lacks valid entitlement for this kit
    """
    secret = _get_canvas_token_secret()
    if not secret:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="CANVAS_TOKEN_SECRET não configurado no servidor",
        )

    if isinstance(current_user, AnonymousUser) or not getattr(current_user, "id", None):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Autenticação necessária para acessar o canvas",
        )

    kit_norm = kit.lower().strip()
    if kit_norm not in VALID_KITS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Kit '{kit}' inválido. Kits permitidos: {', '.join(sorted(VALID_KITS))}",
        )

    # 1. Validate active platform enrollment
    default_org_id = _get_default_org_id()
    user_org_stmt = select(UserOrganization).where(
        UserOrganization.user_id == current_user.id,
        UserOrganization.org_id == default_org_id,
    )
    user_org = (await db_session.execute(user_org_stmt)).scalars().first()
    if not user_org:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Aluno não possui matrícula ativa na plataforma para este Kit",
        )

    # 2. Check elevated role (admin / maintainer bypass)
    via: str
    expires_at_iso: Optional[str] = None
    acesso = None

    if user_org.role_id in ADMIN_OR_MAINTAINER_ROLE_IDS:
        logger.info(
            f"[Canvas Access] Crachá emitido via equipe: user_id={current_user.id} kit='{kit_norm}' role_id={user_org.role_id}"
        )
        via = "equipe"
    else:
        # 3. Evaluate student entitlement for this kit
        acesso = await avaliar_acesso(db_session, current_user.id, kit_norm)
        if not acesso.permitido:
            logger.info(
                f"[Canvas Access] Acesso negado: user_id={current_user.id} kit='{kit_norm}' motivo={acesso.motivo}"
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "code": "kit_access_denied",
                    "motivo": acesso.motivo,
                    "kit": kit_norm,
                },
            )

        via = acesso.via or "kit"
        if acesso.expires_at:
            if acesso.expires_at.tzinfo is None:
                expires_at_iso = acesso.expires_at.replace(tzinfo=timezone.utc).isoformat()
            else:
                expires_at_iso = acesso.expires_at.astimezone(timezone.utc).isoformat()

    now = datetime.now(timezone.utc)
    ttl_min = _get_canvas_token_ttl_min()
    exp_token = now + timedelta(minutes=ttl_min)

    # Teto pela validade do direito: quando emitido por direito de Kit/Combo (não equipe) e expires_at existir
    if via in ("kit", "combo") and acesso is not None and acesso.expires_at is not None:
        expires_at_utc = acesso.expires_at
        if expires_at_utc.tzinfo is None:
            expires_at_utc = expires_at_utc.replace(tzinfo=timezone.utc)
        else:
            expires_at_utc = expires_at_utc.astimezone(timezone.utc)
        exp_token = min(exp_token, expires_at_utc)

    diff_seconds = (exp_token - now).total_seconds()
    expires_in = max(0, int(diff_seconds))

    payload = {
        "sub": str(current_user.user_uuid),
        "user_id": current_user.id,
        "kit": kit_norm,
        "iss": "anticaos-lms",
        "aud": "canvas",
        "iat": now,
        "exp": exp_token,
    }

    token = jwt.encode(payload, secret, algorithm=CANVAS_ALGO)
    return {
        "token": token,
        "expires_in": expires_in,
        "kit": kit_norm,
        "via": via,
        "expires_at": expires_at_iso,
    }


class IssueCertificateRequest(BaseModel):
    kit: str


@router.post(
    "/certificado",
    summary="Emite certificado para o Kit usando o crachá do canvas como autenticação",
    status_code=status.HTTP_200_OK,
)
async def issue_kit_certificate(
    body: IssueCertificateRequest,
    authorization: Optional[str] = Header(None),
    db_session: AsyncSession = Depends(get_db_session),
):
    """
    Emite certificado com código único (10 caracteres) e URL pública de verificação.

    Autenticação: crachá assinado do canvas (Authorization: Bearer <token>).
    Validações:
    - 500 se CANVAS_TOKEN_SECRET ausente.
    - 401 se token ausente, expirado ou assinatura inválida.
    - 403 se kit do crachá for diferente do kit requisitado no corpo.
    - 422 se nome completo do aluno não estiver preenchido no perfil.
    - 403 se aluno não possuir matrícula ativa na plataforma ou não tiver direito ativo.
    - Idempotente: emitir novamente devolve o mesmo código já gerado.
    """
    secret = _get_canvas_token_secret()
    if not secret:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="CANVAS_TOKEN_SECRET não configurado no servidor",
        )

    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Autenticação necessária via crachá do canvas (Bearer token)",
        )

    token = authorization.split("Bearer ", 1)[1].strip()

    try:
        payload = jwt.decode(
            token,
            secret,
            algorithms=[CANVAS_ALGO],
            audience="canvas",
            issuer="anticaos-lms",
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Crachá do canvas expirado",
        )
    except (jwt.InvalidTokenError, Exception):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Crachá do canvas inválido ou assinatura incorreta",
        )

    token_kit = str(payload.get("kit", "")).strip().lower()
    body_kit = body.kit.strip().lower()

    if normalizar_kit(body_kit) != normalizar_kit(token_kit):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Crachá emitido para outro Kit",
        )

    user_id = payload.get("user_id")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Identificação do aluno ausente no crachá",
        )

    user = await db_session.get(User, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Aluno não encontrado no sistema",
        )

    user_idioma = user.idioma if hasattr(user, "idioma") else None
    first_name = (user.first_name or "").strip()
    last_name = (user.last_name or "").strip()
    full_name = f"{first_name} {last_name}".strip()

    if not full_name:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Complete seu nome no perfil do hub para emitir o certificado.",
        )

    default_org_id = _get_default_org_id()
    user_org_stmt = select(UserOrganization).where(
        UserOrganization.user_id == user_id,
        UserOrganization.org_id == default_org_id,
    )
    user_org = (await db_session.execute(user_org_stmt)).scalars().first()
    if not user_org:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Aluno não possui matrícula ativa na plataforma",
        )

    kit_norm = normalizar_kit(body_kit)
    via: str
    entitlement_id: Optional[int] = None

    if user_org.role_id in ADMIN_OR_MAINTAINER_ROLE_IDS:
        via = "equipe"
        entitlement_id = None
    else:
        acesso = await avaliar_acesso(db_session, user_id, kit_norm)
        if not acesso.permitido:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Acesso ao Kit não permitido ou expirado",
            )
        via = acesso.via or "kit"

        ent_stmt = select(KitEntitlement).where(
            KitEntitlement.user_id == user_id,
            KitEntitlement.kit.in_([kit_norm, "combo"]),
        )
        ents = (await db_session.execute(ent_stmt)).scalars().all()
        now_utc = datetime.now(timezone.utc)
        active_ent = next(
            (e for e in ents if e.kit == kit_norm and _is_linha_valida(e, now_utc)),
            None,
        )
        if not active_ent:
            active_ent = next(
                (e for e in ents if e.kit == "combo" and _is_linha_valida(e, now_utc)),
                None,
            )
        entitlement_id = active_ent.id if active_ent else None

    # Idempotência: emitir de novo devolve o mesmo certificado
    existing_cert_stmt = select(KitCertificate).where(
        KitCertificate.user_id == user_id,
        KitCertificate.kit == kit_norm,
    )
    existing_cert = (await db_session.execute(existing_cert_stmt)).scalars().first()

    if existing_cert:
        issued_iso = (
            existing_cert.issued_at.isoformat()
            if hasattr(existing_cert.issued_at, "isoformat")
            else str(existing_cert.issued_at)
        )
        return {
            "code": existing_cert.code,
            "url": f"https://hub.souanticaos.app/certificado/{existing_cert.code}",
            "full_name": existing_cert.full_name,
            "formal_title": titulo_formal_no_idioma(
                existing_cert.kit,
                existing_cert.formal_title,
                user_idioma,
            ),
            "issued_at": issued_iso,
        }

    try:
        selado = await kit_selado(token, token_kit)
    except SeloIndisponivel as e:
        logger.warning(f"[Certificado] selo não conferido user_id={user_id} kit='{token_kit}': {e}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Não foi possível conferir o selo do Kit agora. Tente de novo em instantes.",
        )
    if not selado:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Conclua e sele o Kit para emitir o certificado.",
        )

    if os.getenv("NEURO_TRAVA_SINAPSES") != "desligado":
        faltantes = await sinapses_faltantes(db_session, user_id, kit_norm)
        if faltantes:
            titulos = [AULAS_DICT[a]["titulo"] for a in faltantes if a in AULAS_DICT]
            titulos_str = " · ".join(titulos)
            num = len(faltantes)
            msg = (
                f"Falta 1 sinapse da Neuroacabativa para este certificado: {titulos_str}"
                if num == 1
                else f"Faltam {num} sinapses da Neuroacabativa para este certificado: {titulos_str}"
            )
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=msg,
            )

    formal_title = FORMAL_TITLES.get(body_kit) or FORMAL_TITLES.get(kit_norm)
    if not formal_title:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Kit '{body_kit}' não possui título formal cadastrado",
        )

    # Gera código alfanumérico único sem colisão
    while True:
        code = generate_certificate_code(10)
        code_exists = (
            await db_session.execute(
                select(KitCertificate).where(KitCertificate.code == code)
            )
        ).scalars().first()
        if not code_exists:
            break

    now = datetime.now(timezone.utc)
    cert = KitCertificate(
        code=code,
        user_id=user_id,
        org_id=user_org.org_id,
        kit=kit_norm,
        entitlement_id=entitlement_id,
        full_name=full_name,
        formal_title=formal_title,
        issued_at=now,
        via=via,
        created_at=now,
        updated_at=now,
    )
    db_session.add(cert)
    await db_session.commit()
    await db_session.refresh(cert)

    return {
        "code": cert.code,
        "url": f"https://hub.souanticaos.app/certificado/{cert.code}",
        "full_name": cert.full_name,
        "formal_title": titulo_formal_no_idioma(
            cert.kit,
            cert.formal_title,
            user_idioma,
        ),
        "issued_at": cert.issued_at.isoformat(),
    }

