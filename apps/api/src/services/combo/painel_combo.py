"""Tarefa 709 · Serviço do painel "Combo: vídeo e compra".

Registra os 3 passos da LP do Combo (play, trinta_por_cento, clique_comprar),
contando cada visitante no máximo 1 vez por dia (horário de Brasília) em cada passo,
e consolida por dia com as vendas reais do Combo na Maisfy (KitEntitlement).
"""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from typing import Any

from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.combo_vsl import ComboVslEvento
from src.db.kit_entitlements import KitEntitlement

BRT = timezone(timedelta(hours=-3))
TIPOS_EVENTO = ("play", "trinta_por_cento", "clique_comprar")
VISITANTE_MAX_LEN = 64


def _agora_utc(agora: datetime | date | None) -> datetime:
    if agora is None:
        return datetime.now(timezone.utc)
    if isinstance(agora, datetime):
        if agora.tzinfo is None:
            return agora.replace(tzinfo=timezone.utc)
        return agora.astimezone(timezone.utc)
    return datetime(agora.year, agora.month, agora.day, 12, 0, tzinfo=BRT).astimezone(
        timezone.utc
    )


def _dia_brasilia(dt_ou_data: datetime | date | None) -> date:
    if dt_ou_data is None:
        return datetime.now(BRT).date()
    if isinstance(dt_ou_data, datetime):
        if dt_ou_data.tzinfo is None:
            dt_ou_data = dt_ou_data.replace(tzinfo=timezone.utc)
        return dt_ou_data.astimezone(BRT).date()
    return dt_ou_data


def _taxa(parte: int, base: int) -> float | None:
    if base <= 0:
        return None
    return round((parte * 100.0) / base, 1)


def _montar_linha(
    dia_str: str,
    plays: int,
    chegaram_30: int,
    cliques: int,
    vendas: int,
) -> dict[str, Any]:
    return {
        "dia": dia_str,
        "plays": plays,
        "chegaram_30": chegaram_30,
        "cliques": cliques,
        "vendas": vendas,
        "taxa_30": _taxa(chegaram_30, plays),
        "taxa_clique": _taxa(cliques, chegaram_30),
        "taxa_venda": _taxa(vendas, cliques),
    }


async def registrar_evento_combo(
    db_session: AsyncSession,
    tipo: str,
    visitante: str,
    agora: datetime | date | None = None,
) -> bool:
    if not isinstance(tipo, str) or tipo not in TIPOS_EVENTO:
        raise ValueError("Tipo de evento inválido")
    if not isinstance(visitante, str):
        raise ValueError("Visitante inválido")
    visitante_limpo = visitante.strip()
    if not visitante_limpo or len(visitante_limpo) > VISITANTE_MAX_LEN:
        raise ValueError("Visitante inválido")

    agora_utc = _agora_utc(agora)
    dia_brt = agora_utc.astimezone(BRT).date()

    ja_existe = (
        await db_session.execute(
            select(ComboVslEvento.id).where(
                ComboVslEvento.tipo == tipo,
                ComboVslEvento.visitante == visitante_limpo,
                ComboVslEvento.dia == dia_brt,
            )
        )
    ).scalars().first()
    if ja_existe is not None:
        return False

    evento = ComboVslEvento(
        tipo=tipo,
        visitante=visitante_limpo,
        dia=dia_brt,
        criado_em=agora_utc,
    )
    db_session.add(evento)
    try:
        await db_session.commit()
        return True
    except IntegrityError:
        await db_session.rollback()
        return False


async def resumo_painel_combo(
    db_session: AsyncSession,
    dias: int = 30,
    hoje: datetime | date | None = None,
) -> dict[str, Any]:
    n_dias = max(1, min(int(dias or 30), 365))
    hoje_brt = _dia_brasilia(hoje)
    inicio_brt = hoje_brt - timedelta(days=n_dias - 1)

    contagem_eventos: dict[tuple[date, str], int] = {}
    stmt_ev = (
        select(ComboVslEvento.dia, ComboVslEvento.tipo, func.count(ComboVslEvento.id))
        .where(ComboVslEvento.dia >= inicio_brt, ComboVslEvento.dia <= hoje_brt)
        .group_by(ComboVslEvento.dia, ComboVslEvento.tipo)
    )
    for d, t, n in (await db_session.execute(stmt_ev)).all():
        contagem_eventos[(d, str(t))] = int(n or 0)

    vendas_por_dia: dict[date, int] = {}
    stmt_vendas = select(KitEntitlement.granted_at).where(
        KitEntitlement.kit == "combo",
        KitEntitlement.source == "maisfy",
        KitEntitlement.revoked_at.is_(None),
    )
    for (granted_at,) in (await db_session.execute(stmt_vendas)).all():
        if granted_at is None:
            continue
        dia_venda = _dia_brasilia(granted_at)
        if inicio_brt <= dia_venda <= hoje_brt:
            vendas_por_dia[dia_venda] = vendas_por_dia.get(dia_venda, 0) + 1

    linhas_dias: list[dict[str, Any]] = []
    tot_plays = 0
    tot_30 = 0
    tot_cliques = 0
    tot_vendas = 0

    for offset in range(n_dias):
        d = hoje_brt - timedelta(days=offset)
        plays = contagem_eventos.get((d, "play"), 0)
        chegaram_30 = contagem_eventos.get((d, "trinta_por_cento"), 0)
        cliques = contagem_eventos.get((d, "clique_comprar"), 0)
        vendas = vendas_por_dia.get(d, 0)

        tot_plays += plays
        tot_30 += chegaram_30
        tot_cliques += cliques
        tot_vendas += vendas

        linhas_dias.append(
            _montar_linha(d.isoformat(), plays, chegaram_30, cliques, vendas)
        )

    total = _montar_linha("total", tot_plays, tot_30, tot_cliques, tot_vendas)
    return {
        "dias": linhas_dias,
        "total": total,
    }
