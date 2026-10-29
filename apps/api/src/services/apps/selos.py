"""Selos que se provam sozinhos (428-B, dia zero dos Apps — aprovado pelo André em 12/10).

Hoje o único selo com código próprio é a "Primeira conexão" (1ª sinapse). Neuroestrategista e cada app
instalado já se provam pelo certificado (/certificado/{code}).
"""

import secrets
from datetime import UTC, datetime
from typing import Any

from sqlalchemy.exc import IntegrityError
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.apps_selos import AppsSelo
from src.services.certificates.constants import CERTIFICATE_CODE_ALPHABET

EMISSOR = "Comunidade anticaos"
PRIMEIRA_CONEXAO = "primeira-conexao"
SELO_WIFI_HUMANO = "wifi-humano"
SELOS: dict[str, dict[str, str]] = {
    PRIMEIRA_CONEXAO: {
        "nome": "Primeira conexão",
        "criterio": "Acender a 1ª sinapse da Neuroacabativa.",
    },
    # 519 · Desafio Wi-Fi Humano: Dia 1 completo, Mapa feito, 1º app instalado e 3 colegas responderam.
    SELO_WIFI_HUMANO: {
        "nome": "Wi-Fi Humano",
        "criterio": "Completar o Dia 1, fazer o Mapa Wi-Fi Humano, instalar o 1º app e ter 3 colegas respondendo.",
    },
}


def url_da_prova(codigo: str) -> str:
    return f"https://hub.souanticaos.app/selo/{codigo}"


def gerar_codigo() -> str:
    """AC-XXXX-XXXX, sem 0, O, 1 e I (mesmo alfabeto dos certificados)."""
    parte = lambda: "".join(secrets.choice(CERTIFICATE_CODE_ALPHABET) for _ in range(4))  # noqa: E731
    return f"AC-{parte()}-{parte()}"


def _utc(dt: datetime) -> datetime:
    return dt.replace(tzinfo=UTC) if dt.tzinfo is None else dt.astimezone(UTC)


async def garantir_selo(db: AsyncSession, user_id: int, selo: str, ganho_em: datetime) -> AppsSelo:
    """Cria o selo uma vez só (idempotente). O código nunca muda depois de criado."""
    stmt = select(AppsSelo).where(AppsSelo.user_id == user_id, AppsSelo.selo == selo)
    existente = (await db.execute(stmt)).scalars().first()
    if existente:
        return existente
    for _ in range(5):
        novo = AppsSelo(user_id=user_id, selo=selo, codigo=gerar_codigo(), ganho_em=_utc(ganho_em))
        db.add(novo)
        try:
            await db.commit()
            await db.refresh(novo)
            return novo
        except IntegrityError:
            await db.rollback()
            existente = (await db.execute(stmt)).scalars().first()
            if existente:
                return existente
    raise RuntimeError("não foi possível gerar um código de selo único")


def selo_publico(s: AppsSelo) -> dict[str, Any]:
    info = SELOS.get(s.selo, {})
    return {
        "selo": s.selo,
        "nome": info.get("nome", s.selo),
        "ganho_em": _utc(s.ganho_em).isoformat(),
        "codigo": s.codigo,
        "url_prova": url_da_prova(s.codigo),
    }
