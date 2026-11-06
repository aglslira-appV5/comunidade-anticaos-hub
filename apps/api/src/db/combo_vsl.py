"""Tarefa 709 · Eventos do vídeo de vendas na LP do Combo (lp.souanticaos.app/combo/).

Cada visitante conta no máximo 1 vez por dia (horário de Brasília) em cada passo:
play · trinta_por_cento · clique_comprar.
"""

from datetime import date, datetime, timezone
from typing import Optional

from sqlalchemy import Column, Date, DateTime, Index, String, UniqueConstraint
from sqlmodel import Field, SQLModel


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class ComboVslEvento(SQLModel, table=True):
    __tablename__ = "combo_vsl_evento"
    __table_args__ = (
        UniqueConstraint(
            "tipo",
            "visitante",
            "dia",
            name="uq_combo_vsl_evento_tipo_visitante_dia",
        ),
        Index("ix_combo_vsl_evento_dia", "dia"),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    tipo: str = Field(sa_column=Column(String(32), nullable=False))
    visitante: str = Field(sa_column=Column(String(64), nullable=False))
    dia: date = Field(sa_column=Column(Date, nullable=False))
    criado_em: datetime = Field(
        default_factory=_utcnow,
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )
