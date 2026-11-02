"""Selos que se provam sozinhos (428-B, dia zero dos Apps — aprovado pelo André em 12/10).

Hoje o único selo com código próprio é a "Primeira conexão" (1ª sinapse). Neuroestrategista e cada app
instalado já se provam pelo certificado (/certificado/{code}).
"""

import calendar
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


# 662 · validade em meses (padrão Open Badges 3.0, campo validUntil). Selo sem entrada aqui não vence.
VALIDADE_MESES: dict[str, int] = {SELO_WIFI_HUMANO: 12}
MOTIVO_MAX = 200
# Mesmo mínimo do Desafio e do feedback dos colegas: abaixo de 3, o número não aparece (protege quem respondeu).
MINIMO_COLEGAS_SELO = 3
VALIDO, VENCIDO, REVOGADO = "valido", "vencido", "revogado"


def url_da_prova(codigo: str) -> str:
    return f"https://hub.souanticaos.app/selo/{codigo}"


def gerar_codigo() -> str:
    """AC-XXXX-XXXX, sem 0, O, 1 e I (mesmo alfabeto dos certificados)."""
    parte = lambda: "".join(secrets.choice(CERTIFICATE_CODE_ALPHABET) for _ in range(4))  # noqa: E731
    return f"AC-{parte()}-{parte()}"


def _utc(dt: datetime) -> datetime:
    return dt.replace(tzinfo=UTC) if dt.tzinfo is None else dt.astimezone(UTC)


def somar_meses(dt: datetime, meses: int) -> datetime:
    total = dt.month - 1 + meses
    ano, mes = dt.year + total // 12, total % 12 + 1
    return dt.replace(year=ano, month=mes, day=min(dt.day, calendar.monthrange(ano, mes)[1]))


def validade_do_selo(s: AppsSelo) -> datetime | None:
    """Data em que o selo vence. Selo antigo (sem a coluna preenchida) usa a regra da validade a partir do ganho."""
    if s.valido_ate is not None:
        return _utc(s.valido_ate)
    meses = VALIDADE_MESES.get(s.selo)
    return somar_meses(_utc(s.ganho_em), meses) if meses else None


def estado_do_selo(s: AppsSelo, agora: datetime | None = None) -> str:
    if s.revogado_em is not None:
        return REVOGADO
    ate = validade_do_selo(s)
    if ate is not None and _utc(agora or datetime.now(UTC)) > ate:
        return VENCIDO
    return VALIDO


async def garantir_selo(
    db: AsyncSession, user_id: int, selo: str, ganho_em: datetime, n_colegas: int | None = None
) -> AppsSelo:
    """Cria o selo uma vez só (idempotente). O código nunca muda depois de criado."""
    stmt = select(AppsSelo).where(AppsSelo.user_id == user_id, AppsSelo.selo == selo)
    existente = (await db.execute(stmt)).scalars().first()
    if existente:
        return existente
    for _ in range(5):
        meses = VALIDADE_MESES.get(selo)
        novo = AppsSelo(
            user_id=user_id,
            selo=selo,
            codigo=gerar_codigo(),
            ganho_em=_utc(ganho_em),
            valido_ate=somar_meses(_utc(ganho_em), meses) if meses else None,
            n_colegas=n_colegas,
        )
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
    ate = validade_do_selo(s)
    return {
        "selo": s.selo,
        "nome": info.get("nome", s.selo),
        "ganho_em": _utc(s.ganho_em).isoformat(),
        "codigo": s.codigo,
        "url_prova": url_da_prova(s.codigo),
        "valido_ate": ate.isoformat() if ate else None,
        "estado": estado_do_selo(s),
    }


async def revogar_selo(db: AsyncSession, codigo: str, motivo: str, agora: datetime | None = None) -> AppsSelo | None:
    """662 · revoga com motivo (só admin chama). Revogar de novo não muda a data nem o motivo da 1ª vez."""
    s = (await db.execute(select(AppsSelo).where(AppsSelo.codigo == codigo.strip().upper()))).scalars().first()
    if s is None:
        return None
    if s.revogado_em is None:
        s.revogado_em = _utc(agora or datetime.now(UTC))
        s.motivo_revogacao = motivo.strip()[:MOTIVO_MAX]
        db.add(s)
        await db.commit()
        await db.refresh(s)
    return s
