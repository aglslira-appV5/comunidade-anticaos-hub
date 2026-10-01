"""
Public Certificate Verification Router for anticaos-lms.

Provides public (unauthenticated) verification of issued kit certificates.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import JSONResponse
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.core.events.database import get_db_session
from src.db.kit_certificates import KitCertificate
from src.db.kit_entitlements import KitEntitlement
from src.db.users import AnonymousUser
from src.security.auth import get_current_user
from src.services.certificates.constants import (
    CERTIFICATE_BASE_P10,
    CERTIFICATE_CABECALHO,
    CERTIFICATE_CNPJ,
    CERTIFICATE_EMISSOR,
)

router = APIRouter()


@router.get(
    "/meus",
    summary="Listar certificados de kit do usuário autenticado",
    status_code=status.HTTP_200_OK,
)
async def get_meus_certificados(
    db_session: AsyncSession = Depends(get_db_session),
    current_user=Depends(get_current_user),
):
    """
    Lista os certificados de Kit do aluno autenticado, do mais recente para o mais antigo.
    - Visitante sem autenticação ou com id ausente/0 -> 401.
    - Não vaza dados internos (user_id, org_id, entitlement_id, e-mail, pedido).
    """
    user_id = getattr(current_user, "id", None)
    if isinstance(current_user, AnonymousUser) or not user_id or user_id == 0:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Autenticação necessária",
        )

    stmt = (
        select(KitCertificate)
        .where(KitCertificate.user_id == user_id)
        .order_by(KitCertificate.issued_at.desc())
    )
    certs = (await db_session.execute(stmt)).scalars().all()

    ent_ids = [c.entitlement_id for c in certs if c.entitlement_id is not None]
    revoked_ent_ids = set()
    if ent_ids:
        ent_stmt = select(KitEntitlement.id).where(
            KitEntitlement.id.in_(ent_ids),
            KitEntitlement.revoked_at.is_not(None),
        )
        revoked_ent_ids = set((await db_session.execute(ent_stmt)).scalars().all())

    itens = []
    for c in certs:
        is_revoked = c.entitlement_id is not None and c.entitlement_id in revoked_ent_ids
        status_str = "revogado" if is_revoked else "valido"
        issued_iso = (
            c.issued_at.isoformat()
            if hasattr(c.issued_at, "isoformat")
            else str(c.issued_at)
        )
        itens.append(
            {
                "code": c.code,
                "kit": c.kit,
                "formal_title": c.formal_title,
                "issued_at": issued_iso,
                "status": status_str,
                "url": f"https://hub.souanticaos.app/certificado/{c.code}",
            }
        )

    return {"certificados": itens}


@router.get(
    "/{code}",
    summary="Consulta pública de autenticidade de certificado",
    status_code=status.HTTP_200_OK,
)
async def get_public_certificate(
    code: str,
    db_session: AsyncSession = Depends(get_db_session),
):
    """
    Consulta pública de certificado por código alfanumérico único.

    - 404 se não encontrado: {"valido": false, "status": "nao_encontrado"}
    - 200 se válido ou revogado.
    - Revogado automaticamente se o direito associado possuir revoked_at (estorno/chargeback).
    - Não vaza e-mail, user_id, org_id ou dados internos do pedido.
    """
    code_norm = code.strip().upper()
    cert_stmt = select(KitCertificate).where(KitCertificate.code == code_norm)
    cert = (await db_session.execute(cert_stmt)).scalars().first()

    if not cert:
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content={"valido": False, "status": "nao_encontrado"},
        )

    is_revoked = False
    if cert.entitlement_id is not None:
        ent = await db_session.get(KitEntitlement, cert.entitlement_id)
        if ent and ent.revoked_at is not None:
            is_revoked = True

    status_str = "revogado" if is_revoked else "valido"
    valido_bool = not is_revoked

    issued_iso = (
        cert.issued_at.isoformat()
        if hasattr(cert.issued_at, "isoformat")
        else str(cert.issued_at)
    )

    resp = {
        "valido": valido_bool,
        "status": status_str,
        "full_name": cert.full_name,
        "formal_title": cert.formal_title,
        "issued_at": issued_iso,
        "emissor": CERTIFICATE_EMISSOR,
        "cnpj": CERTIFICATE_CNPJ,
        "cabecalho": CERTIFICATE_CABECALHO,
        "equipe": cert.via == "equipe",
    }

    if cert.kit in ("p10", "profissional-indispensavel"):
        resp["base"] = CERTIFICATE_BASE_P10

    return resp
