"""Tarefa 722 · Respostas anônimas às 2 perguntas da VSL do Combo e resumo para o admin."""

from __future__ import annotations

from datetime import date, datetime
from typing import Any

from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.combo_vsl import ComboVslEvento, ComboVslResposta
from src.services.combo.painel_combo import VISITANTE_MAX_LEN, _agora_utc

OPCOES: dict[str, dict[str, str]] = {
    "quatro_coisas": {
        "dependam": "Dependerem de mim",
        "defendam": "Me defenderem",
        "pauta": "Chegar com a pauta pronta",
        "caos": "Enxergar o caos",
    },
    "cenas": {
        "reuniao": "A reunião em que ninguém se entende",
        "outra_area": "A outra área que não responde",
        "relatorio": "O relatório que volta pela metade",
        "lista": "A lista que nunca acaba",
    },
}


async def registrar_resposta_vsl(
    db_session: AsyncSession,
    visitante: str,
    pergunta: str,
    resposta: str,
    agora: datetime | date | None = None,
) -> bool:
    if not isinstance(visitante, str):
        raise ValueError("Visitante inválido")
    visitante_limpo = visitante.strip()
    if not visitante_limpo or len(visitante_limpo) > VISITANTE_MAX_LEN:
        raise ValueError("Visitante inválido")

    if not isinstance(pergunta, str) or pergunta not in OPCOES:
        raise ValueError("Pergunta inválida")
    opcoes_pergunta = OPCOES[pergunta]
    if not isinstance(resposta, str) or resposta not in opcoes_pergunta:
        raise ValueError("Resposta inválida")

    ja_existe = (
        await db_session.execute(
            select(ComboVslResposta.id).where(
                ComboVslResposta.visitante == visitante_limpo,
                ComboVslResposta.pergunta == pergunta,
            )
        )
    ).scalars().first()
    if ja_existe is not None:
        return False

    agora_utc = _agora_utc(agora)
    registro = ComboVslResposta(
        visitante=visitante_limpo,
        pergunta=pergunta,
        resposta=resposta,
        criado_em=agora_utc,
    )
    db_session.add(registro)
    try:
        await db_session.commit()
        return True
    except IntegrityError:
        await db_session.rollback()
        return False


async def resumo_perguntas_vsl(
    db_session: AsyncSession,
) -> dict[str, Any]:
    contagem_respostas: dict[tuple[str, str], int] = {}
    stmt_resp = select(
        ComboVslResposta.pergunta,
        ComboVslResposta.resposta,
        func.count(ComboVslResposta.id),
    ).group_by(ComboVslResposta.pergunta, ComboVslResposta.resposta)

    for perg, resp, qtd in (await db_session.execute(stmt_resp)).all():
        contagem_respostas[(str(perg), str(resp))] = int(qtd or 0)

    sub_cliques = (
        select(ComboVslEvento.visitante)
        .where(ComboVslEvento.tipo == "clique_comprar")
        .distinct()
    )
    contagem_cliques: dict[tuple[str, str], int] = {}
    stmt_cliques = (
        select(
            ComboVslResposta.pergunta,
            ComboVslResposta.resposta,
            func.count(ComboVslResposta.id),
        )
        .where(ComboVslResposta.visitante.in_(sub_cliques))
        .group_by(ComboVslResposta.pergunta, ComboVslResposta.resposta)
    )
    for perg, resp, qtd in (await db_session.execute(stmt_cliques)).all():
        contagem_cliques[(str(perg), str(resp))] = int(qtd or 0)

    resultado: dict[str, Any] = {}
    for pergunta_cod, mapa_opcoes in OPCOES.items():
        total = sum(
            contagem_respostas.get((pergunta_cod, cod), 0)
            for cod in mapa_opcoes
        )
        lista_opcoes: list[dict[str, Any]] = []
        for cod, rotulo in mapa_opcoes.items():
            respostas = contagem_respostas.get((pergunta_cod, cod), 0)
            clicaram = contagem_cliques.get((pergunta_cod, cod), 0)
            pct = round((respostas * 100.0) / total, 1) if total > 0 else 0.0
            pct_clicaram = (
                round((clicaram * 100.0) / respostas, 1)
                if respostas > 0
                else None
            )
            lista_opcoes.append(
                {
                    "codigo": cod,
                    "rotulo": rotulo,
                    "respostas": respostas,
                    "pct": pct,
                    "clicaram_comprar": clicaram,
                    "pct_clicaram": pct_clicaram,
                }
            )
        resultado[pergunta_cod] = {
            "total": total,
            "opcoes": lista_opcoes,
        }

    return resultado
