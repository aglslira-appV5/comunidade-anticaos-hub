"""Serviço de gerenciamento dos Casos Reais de Apps do Aluno."""

from datetime import UTC, datetime
from typing import Any

from fastapi import HTTPException
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.apps_casos import AppsCaso
from src.services.apps.perfil import origens_do_aluno


def validar_texto_e_resultado(texto: Any, resultado: Any) -> tuple[str, str]:
    if not isinstance(texto, str):
        raise HTTPException(status_code=422, detail="Texto inválido")
    t = texto.strip()
    if len(t) < 20 or len(t) > 280:
        raise HTTPException(
            status_code=422,
            detail="Texto deve ter entre 20 e 280 caracteres",
        )

    if resultado is None:
        r = ""
    elif isinstance(resultado, str):
        r = resultado.strip()
    else:
        raise HTTPException(status_code=422, detail="Resultado inválido")

    if len(r) > 140:
        raise HTTPException(
            status_code=422,
            detail="Resultado deve ter no máximo 140 caracteres",
        )

    return t, r


async def listar_casos_e_origens(
    user_id: int,
    db: AsyncSession,
) -> dict[str, Any]:
    origens = await origens_do_aluno(user_id, db)
    origens_map = {o["origem"]: o["rotulo"] for o in origens}

    stmt = select(AppsCaso).where(AppsCaso.user_id == user_id).order_by(AppsCaso.ordem.asc())
    casos = (await db.execute(stmt)).scalars().all()

    casos_resp = [
        {
            "id": c.id,
            "origem": c.origem,
            "rotulo": origens_map.get(c.origem, c.origem),
            "texto": c.texto,
            "resultado": c.resultado,
            "ordem": c.ordem,
        }
        for c in casos
    ]

    return {
        "casos": casos_resp,
        "origens": origens,
        "maximo": 3,
    }


async def criar_caso(
    user_id: int,
    origem: str,
    texto: str,
    resultado: str,
    db: AsyncSession,
) -> dict[str, Any]:
    t, r = validar_texto_e_resultado(texto, resultado)

    origens = await origens_do_aluno(user_id, db)
    origens_map = {o["origem"]: o["rotulo"] for o in origens}
    origem_clean = (origem or "").strip()
    if origem_clean not in origens_map:
        raise HTTPException(status_code=422, detail="Origem inválida")

    stmt = select(AppsCaso).where(AppsCaso.user_id == user_id).order_by(AppsCaso.ordem.asc())
    casos_existentes = (await db.execute(stmt)).scalars().all()

    if len(casos_existentes) >= 3:
        raise HTTPException(
            status_code=422,
            detail="Você já tem 3 casos. Apague um para escrever outro.",
        )

    proxima_ordem = len(casos_existentes) + 1

    novo_caso = AppsCaso(
        user_id=user_id,
        origem=origem_clean,
        texto=t,
        resultado=r,
        ordem=proxima_ordem,
    )
    db.add(novo_caso)
    await db.commit()
    await db.refresh(novo_caso)

    return {
        "id": novo_caso.id,
        "origem": novo_caso.origem,
        "rotulo": origens_map[novo_caso.origem],
        "texto": novo_caso.texto,
        "resultado": novo_caso.resultado,
        "ordem": novo_caso.ordem,
    }


async def atualizar_caso(
    caso_id: int,
    user_id: int,
    origem: str,
    texto: str,
    resultado: str,
    db: AsyncSession,
) -> dict[str, Any]:
    t, r = validar_texto_e_resultado(texto, resultado)

    stmt = select(AppsCaso).where(AppsCaso.id == caso_id)
    caso = (await db.execute(stmt)).scalars().first()
    if not caso or caso.user_id != user_id:
        raise HTTPException(status_code=404, detail="Caso não encontrado")

    origens = await origens_do_aluno(user_id, db)
    origens_map = {o["origem"]: o["rotulo"] for o in origens}
    origem_clean = (origem or "").strip()
    if origem_clean not in origens_map:
        raise HTTPException(status_code=422, detail="Origem inválida")

    caso.origem = origem_clean
    caso.texto = t
    caso.resultado = r
    caso.updated_at = datetime.now(UTC)
    db.add(caso)
    await db.commit()
    await db.refresh(caso)

    return {
        "id": caso.id,
        "origem": caso.origem,
        "rotulo": origens_map[caso.origem],
        "texto": caso.texto,
        "resultado": caso.resultado,
        "ordem": caso.ordem,
    }


async def apagar_caso(
    caso_id: int,
    user_id: int,
    db: AsyncSession,
) -> None:
    stmt = select(AppsCaso).where(AppsCaso.id == caso_id)
    caso = (await db.execute(stmt)).scalars().first()
    if not caso or caso.user_id != user_id:
        raise HTTPException(status_code=404, detail="Caso não encontrado")

    await db.delete(caso)
    await db.flush()

    stmt_restantes = select(AppsCaso).where(AppsCaso.user_id == user_id).order_by(AppsCaso.ordem.asc())
    restantes = (await db.execute(stmt_restantes)).scalars().all()
    for idx, c in enumerate(restantes, start=1):
        c.ordem = idx
        db.add(c)

    await db.commit()
