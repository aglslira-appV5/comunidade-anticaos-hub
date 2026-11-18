import os
from typing import Optional

from fastapi import Depends, HTTPException, Request, status
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.core.events.database import get_db_session
from src.db.user_organizations import UserOrganization
from src.db.users import PublicUser
from src.security.api_token_utils import get_authenticated_non_api_token_user
from src.security.rbac.constants import ADMIN_OR_MAINTAINER_ROLE_IDS
from src.services.entitlements.acesso import tem_acesso


def _get_default_org_id() -> int:
    """Retrieve default platform organization ID (mesmo padrão do canvas_access)."""
    return int(os.environ.get("DEFAULT_ORG_ID", "1"))


async def exigir_assinatura_ia(
    request: Request,
    db_session: AsyncSession = Depends(get_db_session),
    user: PublicUser = Depends(get_authenticated_non_api_token_user),
) -> PublicUser:
    """
    Dependência FastAPI que garante acesso aos endpoints de IA do hub.

    Permite se:
    1. Usuário for admin ou maintainer na organização padrão (DEFAULT_ORG_ID).
    2. Ou possuir a assinatura 'ai-sub' ativa em kit_entitlements.

    Caso contrário, retorna 403 com mensagem explicativa.
    """
    default_org_id = _get_default_org_id()
    stmt = select(UserOrganization).where(
        UserOrganization.user_id == user.id,
        UserOrganization.org_id == default_org_id,
    )
    user_org: Optional[UserOrganization] = (await db_session.execute(stmt)).scalars().first()

    if user_org and user_org.role_id in ADMIN_OR_MAINTAINER_ROLE_IDS:
        return user

    if await tem_acesso(db_session, user.id, "ai-sub"):
        return user

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="A Mentor IA é uma assinatura à parte. Assine para usar a IA do hub.",
    )
