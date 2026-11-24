"""Tarefa 724 · Retenção do vídeo de vendas do Combo (marcos de 5 em 5%)."""

from __future__ import annotations

from datetime import date, datetime
from typing import Any

from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.combo_vsl import ComboVslEvento, ComboVslProgresso
from src.services.combo.painel_combo import VISITANTE_MAX_LEN, _agora_utc

MARCOS: tuple[int, ...] = tuple(range(5, 101, 5))


async def registrar_progresso_vsl(
    db_session: AsyncSession,
    visitante: str,
    marco: int,
    agora: datetime | date | None = None,
) -> bool:
    if not isinstance(visitante, str):
        raise ValueError("Visitante inválido")
    visitante_limpo = visitante.strip()
    if not visitante_limpo or len(visitante_limpo) > VISITANTE_MAX_LEN:
        raise ValueError("Visitante inválido")

    if isinstance(marco, bool) or not isinstance(marco, int) or marco not in MARCOS:
        raise ValueError("Marco inválido")

    ja_existe = (
        await db_session.execute(
            select(ComboVslProgresso.id).where(
                ComboVslProgresso.visitante == visitante_limpo,
                ComboVslProgresso.marco == marco,
            )
        )
    ).scalars().first()
    if ja_existe is not None:
        return False

    agora_utc = _agora_utc(agora)
    registro = ComboVslProgresso(
        visitante=visitante_limpo,
        marco=marco,
        criado_em=agora_utc,
    )
    db_session.add(registro)
    try:
        await db_session.commit()
        return True
    except IntegrityError:
        await db_session.rollback()
        return False


async def resumo_retencao_vsl(
    db_session: AsyncSession,
) -> dict[str, Any]:
    stmt_plays = select(func.count(func.distinct(ComboVslEvento.visitante))).where(
        ComboVslEvento.tipo == "play"
    )
    plays = int((await db_session.execute(stmt_plays)).scalar() or 0)

    contagem_marcos: dict[int, int] = {}
    stmt_marcos = select(
        ComboVslProgresso.marco,
        func.count(func.distinct(ComboVslProgresso.visitante)),
    ).group_by(ComboVslProgresso.marco)
    for m, qtd in (await db_session.execute(stmt_marcos)).all():
        contagem_marcos[int(m)] = int(qtd or 0)

    lista_marcos: list[dict[str, Any]] = []
    for m in MARCOS:
        visitantes = contagem_marcos.get(m, 0)
        pct = round((visitantes * 100.0) / plays, 1) if plays > 0 else None
        lista_marcos.append(
            {
                "marco": m,
                "visitantes": visitantes,
                "pct": pct,
            }
        )

    return {
        "plays": plays,
        "marcos": lista_marcos,
    }
