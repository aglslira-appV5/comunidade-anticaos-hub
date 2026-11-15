"""Serviço de busca e cache de resumo do aluno (sinal e online) junto ao canvas."""

import asyncio
import logging
import os
import time
from typing import Any

import httpx
import jwt

logger = logging.getLogger(__name__)

CACHE_SEGUNDOS = 300
# 685: o mesmo jeito da 675 e da 676, agora no resumo (sinal e online). O último resultado bom fica guardado até
# 24 h; passados os 5 min, a página usa ele na hora e pergunta de novo ao canvas por trás. Cada pergunta deixa no
# log da Railway quanto o canvas levou ("canvas resumo N ms"); acima de 1 s vira aviso ("lento").
ULTIMO_BOM_SEGUNDOS = 24 * 60 * 60
MAXIMO_GUARDADOS = 5000
LIMITE_LENTO_MS = 1000

_CACHE: dict[str, tuple[float, dict[str, Any]]] = {}
_ATUALIZANDO: dict[str, asyncio.Task[Any]] = {}


def _agora() -> float:
    return time.time()


def _cronometro() -> float:
    return time.monotonic()


def _anotar_tempo(inicio: float, resultado: str) -> int:
    ms = int(round((_cronometro() - inicio) * 1000))
    if ms > LIMITE_LENTO_MS:
        logger.warning("[APPS_RESUMO] canvas resumo lento: %d ms (%s)", ms, resultado)
    else:
        logger.info("[APPS_RESUMO] canvas resumo %d ms (%s)", ms, resultado)
    return ms


def limpar_cache_resumo() -> None:
    """Limpa o cache em memória de resumo do aluno (usado nos testes)."""
    _CACHE.clear()
    for tarefa in list(_ATUALIZANDO.values()):
        tarefa.cancel()
    _ATUALIZANDO.clear()


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


def _filtrar(raw: Any) -> dict[str, Any]:
    """Só as chaves permitidas de sinal e online; qualquer outra coisa fica de fora."""
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

    return {"sinal": sinal, "online": online}


async def _perguntar(user_uuid: str) -> dict[str, Any] | None:
    """Uma pergunta ao canvas. Guarda só resposta que chegou. None = não deu agora. Nunca levanta erro."""
    inicio = _cronometro()
    try:
        raw = await _chamar_canvas(user_uuid)
    except Exception as exc:
        _anotar_tempo(inicio, "falhou")
        logger.warning(f"[APPS_RESUMO_FALHOU] {exc}")
        return None
    _anotar_tempo(inicio, "ok")
    resultado = _filtrar(raw)
    if user_uuid not in _CACHE and len(_CACHE) >= MAXIMO_GUARDADOS:
        mais_velho = min(_CACHE, key=lambda k: _CACHE[k][0])
        _CACHE.pop(mais_velho, None)
    _CACHE[user_uuid] = (_agora(), resultado)
    return resultado


def _atualizar_por_tras(user_uuid: str) -> None:
    """Pergunta de novo ao canvas sem a página esperar. Uma pergunta por aluno de cada vez."""
    if user_uuid in _ATUALIZANDO:
        return
    try:
        tarefa = asyncio.get_running_loop().create_task(_perguntar(user_uuid))
    except RuntimeError:  # pragma: no cover - sem loop rodando
        return
    _ATUALIZANDO[user_uuid] = tarefa
    tarefa.add_done_callback(lambda _t: _ATUALIZANDO.pop(user_uuid, None))


async def buscar_resumo(user_uuid: str) -> dict[str, Any] | None:
    """Busca o resumo do aluno no canvas (sinal e online).

    Até 5 min: usa o guardado. De 5 min a 24 h: usa o último resultado bom na hora e atualiza por trás (685).
    Sem nada guardado: espera o canvas; se ele falhar, usa o último bom que houver, mesmo velho.
    Retorna apenas as chaves permitidas de sinal e online, descartando qualquer outra.
    Em caso de falha, emite warning [APPS_RESUMO_FALHOU], não guarda a falha e devolve None (ou o último bom).
    """
    if not user_uuid:
        return None

    guardado = _CACHE.get(user_uuid)
    if guardado is not None:
        idade = _agora() - guardado[0]
        if idade < CACHE_SEGUNDOS:
            return guardado[1]
        if idade < ULTIMO_BOM_SEGUNDOS:
            _atualizar_por_tras(user_uuid)
            return guardado[1]

    resultado = await _perguntar(user_uuid)
    if resultado is not None:
        return resultado
    return guardado[1] if guardado is not None else None


def obter_resumo_em_cache(user_uuid: str) -> dict[str, Any] | None:
    """Retorna o resumo do aluno se já estiver em cache válido, sem chamar o canvas."""
    if not user_uuid or user_uuid not in _CACHE:
        return None
    cached_at, cached_val = _CACHE[user_uuid]
    if _agora() - cached_at < CACHE_SEGUNDOS:
        return cached_val
    return None
