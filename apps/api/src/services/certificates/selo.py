"""Confere no porteiro do canvas (Cloudflare) se o aluno SELOU o Kit — Opção C (tarefa 085 / 099)."""

import os
from typing import Optional

import httpx

CANVAS_GATE_URL_PADRAO = "https://canvas.souanticaos.app/api/gate"


class SeloIndisponivel(Exception):
    """Não deu para conferir o selo (rede, status != 200 ou resposta inválida). Falha fechada."""


async def kit_selado(token: str, kit: str, *, transport: Optional[httpx.AsyncBaseTransport] = None) -> bool:
    url = os.getenv("CANVAS_GATE_URL") or CANVAS_GATE_URL_PADRAO
    try:
        async with httpx.AsyncClient(timeout=5.0, transport=transport) as c:
            r = await c.post(
                url,
                headers={"Authorization": f"Bearer {token}"},
                json={"action": "load", "kit": kit},
            )
    except httpx.HTTPError as e:
        raise SeloIndisponivel(f"canvas-gate inacessível: {e}") from e
    if r.status_code != 200:
        raise SeloIndisponivel(f"canvas-gate respondeu {r.status_code}")
    try:
        data = r.json()
    except ValueError as e:
        raise SeloIndisponivel("canvas-gate devolveu resposta inválida") from e
    return isinstance(data, dict) and data.get("sealed") is True
