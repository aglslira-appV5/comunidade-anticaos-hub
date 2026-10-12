"""Router de consulta de direitos de acesso a Kits do aluno ("Meus acessos" - ENT-6).

Fonte de regras: docs/anticaos/PLANO-ACESSO-POR-KIT-E-VALIDADE-1-ANO.md §3.8 e §3.9.
Esta rota é puramente de leitura e avalia a situação de cada Kit para o aluno logado.
"""

from datetime import datetime, timezone
import math
import os
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.core.events.database import get_db_session
from src.db.user_organizations import UserOrganization
from src.db.users import AnonymousUser, PublicUser
from src.security.auth import get_current_user
from src.security.rbac.constants import ADMIN_OR_MAINTAINER_ROLE_IDS
from src.services.entitlements.acesso import avaliar_acesso

router = APIRouter()


def _get_default_org_id() -> int:
    """Retrieve default platform organization ID (mesmo padrão do canvas_access)."""
    return int(os.environ.get("DEFAULT_ORG_ID", "1"))

# Origem: VALID_KITS do canvas_access.py (ENT-5) excluindo o alias 'profissional-indispensavel'
# mantendo a ordem canônica da esteira P0 a P10 e diagnósticos.
AVALIATED_KITS: List[str] = [
    "p0",
    "p1",
    "p2",
    "p3",
    "p4",
    "p5",
    "p10",
    "termometro",
    "wifi",
]


ASSINATURAS: List[str] = [
    "ai-sub",
]


class KitStatusItem(BaseModel):
    kit: str
    status: str  # "ativo" | "vence_em_breve" | "expirado" | "revogado" | "sem_acesso" | "cortesia" | "gratuito"
    via: Optional[str] = None  # "kit" | "combo" | "gratuito" | None
    expires_at: Optional[str] = None
    dias_restantes: Optional[int] = None


class MeEntitlementsResponse(BaseModel):
    kits: List[KitStatusItem]
    assinaturas: List[KitStatusItem] = []
    agora: str
    equipe: bool


def _construir_status_item(acesso, kit: str, agora: datetime) -> KitStatusItem:
    if acesso.via == "gratuito":
        return KitStatusItem(
            kit=kit,
            status="gratuito",
            via="gratuito",
            expires_at=None,
            dias_restantes=None,
        )

    if acesso.permitido:
        if acesso.expires_at is None:
            return KitStatusItem(
                kit=kit,
                status="cortesia",
                via=acesso.via,
                expires_at=None,
                dias_restantes=None,
            )
        else:
            exp = acesso.expires_at
            if exp.tzinfo is None:
                exp = exp.replace(tzinfo=timezone.utc)
            else:
                exp = exp.astimezone(timezone.utc)

            diff_seconds = (exp - agora).total_seconds()
            dias_restantes = math.ceil(diff_seconds / 86400.0)

            status_kit = "vence_em_breve" if dias_restantes <= 30 else "ativo"
            return KitStatusItem(
                kit=kit,
                status=status_kit,
                via=acesso.via,
                expires_at=exp.isoformat(),
                dias_restantes=dias_restantes,
            )
    else:
        # Negado: não expõe data nem dias_restantes
        if acesso.motivo == "vencido":
            status_kit = "expirado"
        elif acesso.motivo == "revogado":
            status_kit = "revogado"
        else:
            status_kit = "sem_acesso"

        return KitStatusItem(
            kit=kit,
            status=status_kit,
            via=None,
            expires_at=None,
            dias_restantes=None,
        )


@router.get(
    "/me",
    response_model=MeEntitlementsResponse,
    summary="Consulta direitos de acesso aos Kits do aluno logado",
    status_code=status.HTTP_200_OK,
)
async def get_my_entitlements(
    db_session: AsyncSession = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
):
    """
    Retorna a situação de cada Kit para o aluno logado.
    
    Fail-closed:
    - 401 se não autenticado ou usuário anônimo
    
    Regras de status (em ordem):
    - via == "gratuito" -> "gratuito", dias_restantes = None, expires_at = None
    - permitido e expires_at is None -> "cortesia", dias_restantes = None, expires_at = None
    - permitido e dias_restantes <= 30 -> "vence_em_breve", dias_restantes >= 0
    - permitido -> "ativo"
    - negado: motivo vencido -> "expirado", revogado -> "revogado", sem_direito -> "sem_acesso"
      (negado não expõe data: expires_at = None, dias_restantes = None)
    """
    if isinstance(current_user, AnonymousUser) or not getattr(current_user, "id", None):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Autenticação necessária para consultar acessos",
        )

    # Identifica se o usuário pertence à equipe (admin ou maintainer) na organização padrão
    default_org_id = _get_default_org_id()
    user_org_stmt = select(UserOrganization).where(
        UserOrganization.user_id == current_user.id,
        UserOrganization.org_id == default_org_id,
    )
    user_org = (await db_session.execute(user_org_stmt)).scalars().first()
    is_equipe = bool(user_org and user_org.role_id in ADMIN_OR_MAINTAINER_ROLE_IDS)

    agora = datetime.now(timezone.utc)
    items: List[KitStatusItem] = []

    for kit in AVALIATED_KITS:
        acesso = await avaliar_acesso(db_session, current_user.id, kit, agora=agora)
        items.append(_construir_status_item(acesso, kit, agora))

    assinaturas_items: List[KitStatusItem] = []
    for sub in ASSINATURAS:
        acesso = await avaliar_acesso(db_session, current_user.id, sub, agora=agora)
        assinaturas_items.append(_construir_status_item(acesso, sub, agora))

    return MeEntitlementsResponse(
        kits=items,
        assinaturas=assinaturas_items,
        agora=agora.isoformat(),
        equipe=is_equipe,
    )
