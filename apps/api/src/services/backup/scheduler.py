"""603 · O relógio da cópia diária do banco, dentro do próprio hub (o mesmo jeito do nudges/scheduler.py).

Roda às 06:00 UTC (03h em Brasília) e também logo depois de cada deploy; a trava do dia no Redis
garante uma cópia por dia. Desligado até as 4 variáveis ANTICAOS_BACKUP_R2_* existirem. Nunca derruba
o hub: qualquer erro vira log e a próxima tentativa é no dia seguinte.
"""

import asyncio
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

logger = logging.getLogger(__name__)

HORA_UTC = 6
TRAVA_SEGUNDOS = 20 * 60 * 60
ESPERA_DEPOIS_DO_BOOT = 120

_task: Optional[asyncio.Task] = None


def _chave_da_trava(dia: datetime) -> str:
    return f"anticaos:backup:diario:{dia.date().isoformat()}"


async def _pegar_o_dia(agora: datetime) -> bool:
    try:
        from src.core.redis import get_redis_client

        cliente = get_redis_client()
        if cliente is None:
            return True
        ok = await asyncio.to_thread(cliente.set, _chave_da_trava(agora), "1", nx=True, ex=TRAVA_SEGUNDOS)
        return bool(ok)
    except Exception as exc:  # pragma: no cover - defensivo
        logger.warning("Trava da cópia do banco indisponível, seguindo: %s", exc)
        return True


def segundos_ate_a_proxima(agora: datetime) -> float:
    alvo = agora.replace(hour=HORA_UTC, minute=0, second=0, microsecond=0)
    if alvo <= agora:
        alvo += timedelta(days=1)
    return (alvo - agora).total_seconds()


async def _tick() -> None:
    try:
        hoje = datetime.now(timezone.utc)
        if not await _pegar_o_dia(hoje):
            logger.info("A cópia do banco de hoje já foi feita")
            return
        from src.services.backup.copia_do_banco import fazer_copia

        await fazer_copia(agora=hoje)
    except asyncio.CancelledError:
        raise
    except Exception as exc:
        logger.error("Cópia do banco falhou, tenta de novo amanhã: %s", exc)


async def _loop() -> None:
    await asyncio.sleep(ESPERA_DEPOIS_DO_BOOT)
    await _tick()
    while True:
        await asyncio.sleep(segundos_ate_a_proxima(datetime.now(timezone.utc)))
        await _tick()


def start_scheduler() -> None:
    """Liga o relógio, se as 4 variáveis existirem. Nunca levanta erro (roda no boot do hub)."""
    global _task
    try:
        from src.services.backup.copia_do_banco import ligado

        if not ligado():
            logger.info("Cópia do banco desligada: faltam as variáveis ANTICAOS_BACKUP_R2_*")
            return
        _task = asyncio.create_task(_loop())
        logger.info("Cópia do banco ligada (todo dia às %02d:00 UTC)", HORA_UTC)
    except Exception as exc:
        logger.warning("Cópia do banco não ligou: %s", exc)


async def stop_scheduler() -> None:
    global _task
    if _task is None:
        return
    _task.cancel()
    try:
        await _task
    except (asyncio.CancelledError, Exception):
        pass
    finally:
        _task = None
