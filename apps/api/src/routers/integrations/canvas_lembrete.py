"""
Lembrete semanal da folha de sexta do P10 novo (tarefa 748, PRD aprovado pelo André em 12/11 23h02).

POST /api/v1/integrations/canvas/lembrete-sexta  ·  salva a escolha do aluno (ligado, dia, hora).
GET  /api/v1/integrations/canvas/lembrete-sexta?user_uuid=  ·  lê a escolha do aluno.
Autenticado por X-Canvas-Secret ou Authorization: Bearer (CANVAS_GATE_SECRET / CANVAS_TOKEN_SECRET),
mesma regra de canvas_licenca._exigir_segredo. Nada de e-mail, nome ou dado pessoal em log.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlmodel.ext.asyncio.session import AsyncSession

from src.core.events.database import get_db_session
from src.routers.integrations.canvas_licenca import _exigir_segredo
from src.services.email.comece_aqui_emails import buscar_lembrete_sexta, salvar_lembrete_sexta

router = APIRouter()


class PedidoLembreteSexta(BaseModel):
    user_uuid: str = Field(..., min_length=1, max_length=120)
    ligado: bool
    dia: str = Field(..., min_length=1, max_length=16)
    hora: int


@router.post("", dependencies=[Depends(_exigir_segredo)])
async def salvar_lembrete(
    corpo: PedidoLembreteSexta,
    db_session: AsyncSession = Depends(get_db_session),
) -> dict[str, Any]:
    try:
        res = await salvar_lembrete_sexta(
            db_session,
            user_uuid=corpo.user_uuid,
            ligado=corpo.ligado,
            dia=corpo.dia,
            hora=corpo.hora,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Dia ou hora inválidos") from exc
    if res is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Aluno não encontrado")
    return res


@router.get("", dependencies=[Depends(_exigir_segredo)])
async def ler_lembrete(
    user_uuid: str = Query(default="", max_length=120),
    db_session: AsyncSession = Depends(get_db_session),
) -> dict[str, Any]:
    res = await buscar_lembrete_sexta(db_session, user_uuid=user_uuid)
    if res is None:
        return {"ligado": False, "dia": None, "hora": None}
    return res
