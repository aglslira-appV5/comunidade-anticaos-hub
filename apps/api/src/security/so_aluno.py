"""553 · Porteiro da Comunidade: só aluno com produto ativo (ou a equipe) entra.

Regra do André (21/10, Planilha Mestre, aba Comunidade e App, item 77): convidado e vencido não têm
Comunidade. Aluno = pelo menos 1 de Kit, Mapa Wi-Fi Humano, Combo ou Leadership OS ativo.
"""

import os

from fastapi import Depends, HTTPException, status
from sqlmodel.ext.asyncio.session import AsyncSession

from src.core.events.database import get_db_session
from src.db.users import PublicUser
from src.security.api_token_utils import get_authenticated_non_api_token_user
from src.security.org_auth import is_org_admin
from src.services.entitlements.acesso import eh_aluno

PAGINA_DE_VENDAS_COMUNIDADE = "https://lp.souanticaos.app/combo"


def _get_default_org_id() -> int:
    return int(os.environ.get("DEFAULT_ORG_ID", "1"))


async def exigir_aluno(
    db_session: AsyncSession = Depends(get_db_session),
    user: PublicUser = Depends(get_authenticated_non_api_token_user),
) -> PublicUser:
    """Deixa passar a equipe (admin, maintainer ou superadmin) e quem é aluno. Senão, 403 sem_produto."""
    if await is_org_admin(user.id, _get_default_org_id(), db_session):
        return user
    if await eh_aluno(db_session, user.id):
        return user
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail={
            "motivo": "sem_produto",
            "message": "A Comunidade é para alunos com um produto ativo.",
            "venda": PAGINA_DE_VENDAS_COMUNIDADE,
        },
    )
