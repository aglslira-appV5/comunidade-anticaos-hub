"""Tarefa 722 · Respostas anônimas às perguntas da VSL do Combo e resumo para o admin.

Tarefa 739: as perguntas de múltipla escolha (MULTIPLA) guardam cada opção marcada como
uma linha com pergunta "<pergunta>.<código>", até o limite por visitante."""

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
    "corte": {
        "dependem": "Acho que não... recebo feedbacks positivos",
        "nao_sei": "Não sei... meus feedbacks são confusos",
        "acho_que_sim": "Acho que sim",
    },
    "urubus": {
        "anjos": "Mais anjos",
        "meio": "Meio a meio",
        "urubus": "Mais urubus",
    },
    "skills": {
        "produtividade": "Produtividade",
        "acabativa": "Acabativa",
        "iniciativa": "Iniciativa",
        "planejamento": "Planejamento",
        "persuasao": "Persuasão",
        "acelera": "Acelera",
        "empurra": "Empurra ou é empurrado",
    },
    "direcao": {
        "cima": "Pra cima: o meu chefe",
        "lado": "Pro lado: os meus pares",
        "baixo": "Pra baixo: o meu time",
        "dentro": "Pra dentro: a minha rotina",
    },
}

# Tarefa 739: perguntas em que a pessoa marca várias opções, com o limite por visitante.
MULTIPLA: dict[str, int] = {"skills": 3}


def _chave_gravada(pergunta: str, resposta: str) -> str:
    return f"{pergunta}.{resposta}" if pergunta in MULTIPLA else pergunta


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

    chave = _chave_gravada(pergunta, resposta)
    ja_existe = (
        await db_session.execute(
            select(ComboVslResposta.id).where(
                ComboVslResposta.visitante == visitante_limpo,
                ComboVslResposta.pergunta == chave,
            )
        )
    ).scalars().first()
    if ja_existe is not None:
        return False

    if pergunta in MULTIPLA:
        marcadas = (
            await db_session.execute(
                select(func.count(ComboVslResposta.id)).where(
                    ComboVslResposta.visitante == visitante_limpo,
                    ComboVslResposta.pergunta.in_(
                        [f"{pergunta}.{c}" for c in opcoes_pergunta]
                    ),
                )
            )
        ).scalar_one()
        if int(marcadas or 0) >= MULTIPLA[pergunta]:
            return False

    agora_utc = _agora_utc(agora)
    registro = ComboVslResposta(
        visitante=visitante_limpo,
        pergunta=chave,
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


def _pergunta_base(gravada: str) -> str:
    base = gravada.split(".", 1)[0]
    return base if base in MULTIPLA else gravada


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
        contagem_respostas[(_pergunta_base(str(perg)), str(resp))] = int(qtd or 0)

    pessoas_multipla: dict[str, int] = {}
    for pergunta_multi in MULTIPLA:
        chaves = [f"{pergunta_multi}.{c}" for c in OPCOES[pergunta_multi]]
        pessoas_multipla[pergunta_multi] = int(
            (
                await db_session.execute(
                    select(
                        func.count(func.distinct(ComboVslResposta.visitante))
                    ).where(ComboVslResposta.pergunta.in_(chaves))
                )
            ).scalar_one()
            or 0
        )

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
        contagem_cliques[(_pergunta_base(str(perg)), str(resp))] = int(qtd or 0)

    resultado: dict[str, Any] = {}
    for pergunta_cod, mapa_opcoes in OPCOES.items():
        if pergunta_cod in MULTIPLA:
            # Tarefa 739: total = pessoas que responderam; o % de cada opção é sobre elas.
            total = pessoas_multipla.get(pergunta_cod, 0)
        else:
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
