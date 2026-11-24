"""Tarefa 709 · Router FastAPI do painel "Combo: vídeo e compra" (/api/v1/combo).

- POST /eventos: público, restrito a Origin: https://lp.souanticaos.app, até 1 KB,
  limite por IP no Redis, aceita JSON em text/plain (navigator.sendBeacon).
- GET /painel: exclusivo para administrador (_exigir_admin da Calibração).
"""

from __future__ import annotations

import json
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from sqlmodel.ext.asyncio.session import AsyncSession

from src.core.events.database import get_db_session
from src.routers.calibracao import _exigir_admin, _exigir_usuario_autenticado
from src.security.auth import get_current_user
from src.services.combo.painel_combo import (
    registrar_evento_combo,
    resumo_painel_combo,
)
from src.services.combo.perguntas_vsl import (
    registrar_resposta_vsl,
    resumo_perguntas_vsl,
)
from src.services.combo.retencao_vsl import (
    registrar_progresso_vsl,
    resumo_retencao_vsl,
)
from src.services.security.rate_limiting import check_rate_limit, get_client_ip

router = APIRouter()

ORIGEM_LP_COMBO = "https://lp.souanticaos.app"
MAX_CORPO_BYTES = 1024
LIMITE_EVENTOS_IP = 60
JANELA_EVENTOS_SEGUNDOS = 5 * 60


def _checar_limite_ip(request: Request) -> None:
    ip = get_client_ip(request)
    try:
        permitido, _, espera = check_rate_limit(
            key=f"combo_eventos:{ip}",
            max_attempts=LIMITE_EVENTOS_IP,
            window_seconds=JANELA_EVENTOS_SEGUNDOS,
        )
    except Exception:
        return
    if not permitido:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Muitas requisições",
            headers={"Retry-After": str(max(1, int(espera)))},
        )


@router.post("/eventos")
async def post_evento_combo(
    request: Request,
    response: Response,
    db_session: AsyncSession = Depends(get_db_session),
) -> dict[str, bool]:
    origem = (request.headers.get("origin") or "").strip().rstrip("/")
    if origem != ORIGEM_LP_COMBO:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Origem não autorizada",
        )

    response.headers["Access-Control-Allow-Origin"] = ORIGEM_LP_COMBO
    response.headers["Vary"] = "Origin"

    content_length = request.headers.get("content-length")
    if content_length is not None:
        try:
            if int(content_length) > MAX_CORPO_BYTES:
                raise HTTPException(
                    status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                    detail="Corpo muito grande",
                )
        except ValueError:
            pass

    raw = await request.body()
    if len(raw) > MAX_CORPO_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Corpo muito grande",
        )
    if not raw:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Corpo inválido",
        )

    _checar_limite_ip(request)

    try:
        dados = json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Corpo inválido",
        ) from exc

    if not isinstance(dados, dict):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Corpo inválido",
        )

    tipo = dados.get("tipo")
    visitante = dados.get("visitante")
    try:
        if tipo == "resposta":
            pergunta = dados.get("pergunta")
            resposta = dados.get("resposta")
            await registrar_resposta_vsl(
                db_session,
                visitante=visitante if isinstance(visitante, str) else "",
                pergunta=pergunta if isinstance(pergunta, str) else "",
                resposta=resposta if isinstance(resposta, str) else "",
            )
        elif tipo == "progresso":
            marco = dados.get("marco")
            await registrar_progresso_vsl(
                db_session,
                visitante=visitante if isinstance(visitante, str) else "",
                marco=marco,  # type: ignore[arg-type]
            )
        else:
            await registrar_evento_combo(
                db_session,
                tipo=tipo if isinstance(tipo, str) else "",
                visitante=visitante if isinstance(visitante, str) else "",
            )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Evento inválido",
        ) from exc

    return {"ok": True}


@router.get("/painel")
async def get_painel_combo(
    dias: int = Query(default=30, ge=1, le=365),
    db_session: AsyncSession = Depends(get_db_session),
    current_user: Any = Depends(get_current_user),
) -> dict[str, Any]:
    user_id = _exigir_usuario_autenticado(current_user)
    await _exigir_admin(user_id, db_session)
    return await resumo_painel_combo(db_session, dias=dias)


@router.get("/painel/perguntas")
async def get_painel_perguntas_combo(
    db_session: AsyncSession = Depends(get_db_session),
    current_user: Any = Depends(get_current_user),
) -> dict[str, Any]:
    user_id = _exigir_usuario_autenticado(current_user)
    await _exigir_admin(user_id, db_session)
    return await resumo_perguntas_vsl(db_session)


@router.get("/painel/retencao")
async def get_painel_retencao_combo(
    db_session: AsyncSession = Depends(get_db_session),
    current_user: Any = Depends(get_current_user),
) -> dict[str, Any]:
    user_id = _exigir_usuario_autenticado(current_user)
    await _exigir_admin(user_id, db_session)
    return await resumo_retencao_vsl(db_session)
