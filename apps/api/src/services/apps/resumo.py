"""Serviço de busca e cache de resumo do aluno (sinal e online) junto ao canvas."""

import logging
import os
import time
from typing import Any

import httpx
import jwt

logger = logging.getLogger(__name__)

_CACHE: dict[str, tuple[float, dict[str, Any]]] = {}


def limpar_cache_resumo() -> None:
    """Limpa o cache em memória de resumo do aluno (usado nos testes)."""
    _CACHE.clear()


def gerar_cracha_resumo(user_uuid: str) -> str:
    """Gera crachá JWT HS256 curto (120s) com aud canvas-resumo."""
    secret = os.environ.get("CANVAS_TOKEN_SECRET", "").strip()
    if not secret:
        raise RuntimeError("CANVAS_TOKEN_SECRET não configurado")
    iat = int(time.time())
    payload = {
        "sub": str(user_uuid),
        "iss": "anticaos-lms",
        "aud": "canvas-resumo",
        "iat": iat,
        "exp": iat + 120,
    }
    return jwt.encode(payload, secret, algorithm="HS256")


async def _chamar_canvas(user_uuid: str) -> dict[str, Any]:
    """Chama a rota POST /api/resumo do canvas."""
    url = os.environ.get("CANVAS_RESUMO_URL", "https://canvas.souanticaos.app/api/resumo")
    cracha = gerar_cracha_resumo(user_uuid)
    async with httpx.AsyncClient(timeout=3.0) as client:
        resp = await client.post(
            url,
            headers={"Authorization": f"Bearer {cracha}"},
        )
        if resp.status_code != 200:
            raise RuntimeError(f"HTTP {resp.status_code}: {resp.text}")
        return resp.json()


async def buscar_resumo(user_uuid: str) -> dict[str, Any] | None:
    """Busca o resumo do aluno no canvas com cache de 5 minutos.
    
    Retorna apenas as chaves permitidas de sinal e online, descartando qualquer outra.
    Em caso de falha, emite warning [APPS_RESUMO_FALHOU], não guarda a falha e devolve None.
    """
    if not user_uuid:
        return None

    now = time.time()
    if user_uuid in _CACHE:
        cached_at, cached_val = _CACHE[user_uuid]
        if now - cached_at < 300:  # 5 minutos
            return cached_val

    try:
        raw = await _chamar_canvas(user_uuid)
    except Exception as exc:
        logger.warning(f"[APPS_RESUMO_FALHOU] {exc}")
        return None

    sinal = None
    if isinstance(raw, dict) and isinstance(raw.get("sinal"), dict):
        raw_sinal = raw["sinal"]
        sinal = {
            k: raw_sinal[k]
            for k in ("primeiro", "primeiro_em", "hoje", "hoje_em")
            if k in raw_sinal
        }

    online = None
    if isinstance(raw, dict) and isinstance(raw.get("online"), dict):
        raw_online = raw["online"]
        online = {
            k: raw_online[k]
            for k in ("semanas", "no_ano", "seguidas", "trimestres_completos")
            if k in raw_online
        }

    resultado = {
        "sinal": sinal,
        "online": online,
    }
    _CACHE[user_uuid] = (now, resultado)
    return resultado

def obter_resumo_em_cache(user_uuid: str) -> dict[str, Any] | None:
    """Retorna o resumo do aluno se já estiver em cache válido, sem chamar o canvas."""
    if not user_uuid or user_uuid not in _CACHE:
        return None
    cached_at, cached_val = _CACHE[user_uuid]
    if time.time() - cached_at < 300:
        return cached_val
    return None
