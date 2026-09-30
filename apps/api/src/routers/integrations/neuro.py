"""Router da Neuroacabativa (as 8 aulas, sinapses e emissão de licença)."""

from datetime import datetime, timezone
import os
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import BaseModel
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.core.events.database import get_db_session
from src.db.kit_certificates import KitCertificate
from src.db.neuro_sinapses import NeuroSinapse
from src.db.user_organizations import UserOrganization
from src.db.users import AnonymousUser, PublicUser, User
from src.security.auth import get_current_user
from src.services.certificates.constants import generate_certificate_code
from src.services.neuro.aulas import (
    AULAS_DICT,
    AULAS_NEURO,
    MIN_CASO,
    ORDEM_SUGERIDA,
)

router = APIRouter()


def _get_default_org_id() -> int:
    return int(os.environ.get("DEFAULT_ORG_ID", "1"))


def _ensure_authenticated_user(current_user: PublicUser) -> None:
    if isinstance(current_user, AnonymousUser) or not getattr(current_user, "id", None):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Autenticação necessária para acessar a Neuroacabativa",
        )


class CasoBody(BaseModel):
    caso: str


class SinapseAulaItem(BaseModel):
    aula: int
    slug: str
    titulo: str
    tese: str
    acesa: bool
    caso: Optional[str] = None
    acesa_em: Optional[str] = None


class LicencaInfo(BaseModel):
    code: str
    url: str


class MeSinapsesResponse(BaseModel):
    aulas: List[SinapseAulaItem]
    acesas: int
    total: int
    licenca: Optional[LicencaInfo] = None


class SinapseAcesaResponse(BaseModel):
    aula: int
    acesa: bool
    caso: str
    acesa_em: str
    criada: bool


class LicencaResponse(BaseModel):
    code: str
    url: str
    full_name: str
    formal_title: str
    issued_at: str


@router.get(
    "/sinapses/me",
    response_model=MeSinapsesResponse,
    summary="Consulta o estado das 8 sinapses e licença do aluno logado",
    status_code=status.HTTP_200_OK,
)
async def get_minhas_sinapses(
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> MeSinapsesResponse:
    _ensure_authenticated_user(current_user)

    stmt = select(NeuroSinapse).where(NeuroSinapse.user_id == current_user.id)
    sinapses = (await db_session.execute(stmt)).scalars().all()
    sinapses_map = {s.aula: s for s in sinapses}

    cert_stmt = select(KitCertificate).where(
        KitCertificate.user_id == current_user.id,
        KitCertificate.kit == "neuro",
    )
    cert = (await db_session.execute(cert_stmt)).scalars().first()
    licenca = (
        LicencaInfo(
            code=cert.code,
            url=f"https://hub.souanticaos.app/certificado/{cert.code}",
        )
        if cert
        else None
    )

    aulas_res: List[SinapseAulaItem] = []
    for a_num in ORDEM_SUGERIDA:
        info = AULAS_DICT[a_num]
        s = sinapses_map.get(a_num)
        acesa_em_str = None
        if s and s.acesa_em:
            acesa_em_str = (
                s.acesa_em.isoformat()
                if hasattr(s.acesa_em, "isoformat")
                else str(s.acesa_em)
            )
        aulas_res.append(
            SinapseAulaItem(
                aula=a_num,
                slug=info["slug"],
                titulo=info["titulo"],
                tese=info["tese"],
                acesa=bool(s is not None),
                caso=s.caso if s else None,
                acesa_em=acesa_em_str,
            )
        )

    return MeSinapsesResponse(
        aulas=aulas_res,
        acesas=len(sinapses_map),
        total=len(AULAS_NEURO),
        licenca=licenca,
    )


@router.post(
    "/sinapses/{aula}",
    response_model=SinapseAcesaResponse,
    summary="Acende ou atualiza uma sinapse com o caso prático do aluno",
)
async def acender_sinapse(
    aula: int,
    body: CasoBody,
    response: Response,
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> SinapseAcesaResponse:
    _ensure_authenticated_user(current_user)

    if aula not in AULAS_DICT:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Aula {aula} inexistente.",
        )

    caso_texto = body.caso.strip()
    if len(caso_texto) < MIN_CASO:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"O caso deve ter no mínimo {MIN_CASO} caracteres.",
        )

    stmt = select(NeuroSinapse).where(
        NeuroSinapse.user_id == current_user.id,
        NeuroSinapse.aula == aula,
    )
    existing = (await db_session.execute(stmt)).scalars().first()
    now = datetime.now(timezone.utc)

    if not existing:
        sinapse = NeuroSinapse(
            user_id=current_user.id,
            aula=aula,
            caso=body.caso,
            acesa_em=now,
            atualizada_em=now,
        )
        db_session.add(sinapse)
        await db_session.commit()
        await db_session.refresh(sinapse)
        response.status_code = status.HTTP_201_CREATED
        acesa_em_str = (
            sinapse.acesa_em.isoformat()
            if hasattr(sinapse.acesa_em, "isoformat")
            else str(sinapse.acesa_em)
        )
        return SinapseAcesaResponse(
            aula=aula,
            acesa=True,
            caso=sinapse.caso,
            acesa_em=acesa_em_str,
            criada=True,
        )
    else:
        existing.caso = body.caso
        existing.atualizada_em = now
        db_session.add(existing)
        await db_session.commit()
        await db_session.refresh(existing)
        response.status_code = status.HTTP_200_OK
        acesa_em_str = (
            existing.acesa_em.isoformat()
            if hasattr(existing.acesa_em, "isoformat")
            else str(existing.acesa_em)
        )
        return SinapseAcesaResponse(
            aula=aula,
            acesa=True,
            caso=existing.caso,
            acesa_em=acesa_em_str,
            criada=False,
        )


@router.post(
    "/licenca",
    response_model=LicencaResponse,
    summary="Emite a Licença em Neuroacabativa (Neuroestrategista) quando as 8 sinapses estiverem acesas",
    status_code=status.HTTP_200_OK,
)
async def emitir_licenca(
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
) -> LicencaResponse:
    _ensure_authenticated_user(current_user)

    stmt = select(NeuroSinapse).where(NeuroSinapse.user_id == current_user.id)
    sinapses = (await db_session.execute(stmt)).scalars().all()
    acesas_set = {s.aula for s in sinapses}

    if len(acesas_set) < len(AULAS_NEURO):
        faltantes = [a for a in ORDEM_SUGERIDA if a not in acesas_set]
        titulos = [AULAS_DICT[a]["titulo"] for a in faltantes]
        titulos_str = " · ".join(titulos)
        n = len(faltantes)
        prefix = "Falta 1 sinapse:" if n == 1 else f"Faltam {n} sinapses:"
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"{prefix} {titulos_str}",
        )

    # Idempotência: emitir de novo devolve o mesmo certificado
    existing_cert_stmt = select(KitCertificate).where(
        KitCertificate.user_id == current_user.id,
        KitCertificate.kit == "neuro",
    )
    existing_cert = (await db_session.execute(existing_cert_stmt)).scalars().first()
    if existing_cert:
        issued_iso = (
            existing_cert.issued_at.isoformat()
            if hasattr(existing_cert.issued_at, "isoformat")
            else str(existing_cert.issued_at)
        )
        return LicencaResponse(
            code=existing_cert.code,
            url=f"https://hub.souanticaos.app/certificado/{existing_cert.code}",
            full_name=existing_cert.full_name,
            formal_title=existing_cert.formal_title,
            issued_at=issued_iso,
        )

    user = await db_session.get(User, current_user.id)
    first_name = (user.first_name or "").strip() if user else ""
    last_name = (user.last_name or "").strip() if user else ""
    full_name = f"{first_name} {last_name}".strip()

    if not full_name:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Complete seu nome no perfil do hub para emitir o certificado.",
        )

    default_org_id = _get_default_org_id()
    user_org_stmt = select(UserOrganization).where(
        UserOrganization.user_id == current_user.id,
        UserOrganization.org_id == default_org_id,
    )
    user_org = (await db_session.execute(user_org_stmt)).scalars().first()
    if not user_org:
        user_org_stmt2 = select(UserOrganization).where(
            UserOrganization.user_id == current_user.id
        )
        user_org = (await db_session.execute(user_org_stmt2)).scalars().first()
    org_id = user_org.org_id if user_org else default_org_id

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
        user_id=current_user.id,
        org_id=org_id,
        kit="neuro",
        entitlement_id=None,
        full_name=full_name,
        formal_title="Neuroestrategista",
        issued_at=now,
        via="neuro",
        created_at=now,
        updated_at=now,
    )
    db_session.add(cert)
    await db_session.commit()
    await db_session.refresh(cert)

    return LicencaResponse(
        code=cert.code,
        url=f"https://hub.souanticaos.app/certificado/{cert.code}",
        full_name=cert.full_name,
        formal_title=cert.formal_title,
        issued_at=cert.issued_at.isoformat(),
    )
