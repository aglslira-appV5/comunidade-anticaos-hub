"""Router para consulta e atualização de idioma da conta do aluno."""

from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlmodel.ext.asyncio.session import AsyncSession

import src.routers.users as ru
from src.core.events.database import get_db_session
from src.db.users import AnonymousUser, User
from src.security.auth import get_current_user

router = APIRouter()


class IdiomaUpdate(BaseModel):
    idioma: Literal["pt", "es", "en"]


@router.get("/me")
async def get_idioma_me(
    db_session: AsyncSession = Depends(get_db_session),
    current_user=Depends(get_current_user),
):
    user_id = getattr(current_user, "id", None)
    if isinstance(current_user, AnonymousUser) or not user_id or user_id == 0:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Autenticação necessária",
        )

    user = await db_session.get(User, user_id)
    return {"idioma": user.idioma if user else None}


@router.put("/me")
async def put_idioma_me(
    body: IdiomaUpdate,
    db_session: AsyncSession = Depends(get_db_session),
    current_user=Depends(get_current_user),
):
    user_id = getattr(current_user, "id", None)
    if isinstance(current_user, AnonymousUser) or not user_id or user_id == 0:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Autenticação necessária",
        )

    user = await db_session.get(User, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuário não encontrado",
        )

    user.idioma = body.idioma
    await db_session.commit()
    await db_session.refresh(user)

    ru._invalidate_session_cache(user.id)
    return {"idioma": user.idioma}
