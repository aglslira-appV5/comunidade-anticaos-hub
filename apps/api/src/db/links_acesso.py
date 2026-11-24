"""Tarefa 741 · Tabelas de Links de acesso (cortesia do admin)."""

from datetime import date, datetime, timezone
from typing import Optional

from sqlalchemy import (
    JSON,
    Boolean,
    Column,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
)
from sqlmodel import Field, SQLModel


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class LinkAcesso(SQLModel, table=True):
    __tablename__ = "link_acesso"

    id: Optional[int] = Field(default=None, primary_key=True)
    org_id: int = Field(
        sa_column=Column(
            Integer,
            ForeignKey("organization.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        )
    )
    codigo: str = Field(
        sa_column=Column(String(16), nullable=False, unique=True, index=True)
    )
    nome: str = Field(sa_column=Column(String(120), nullable=False))
    produtos: list[str] = Field(
        default_factory=list,
        sa_column=Column(JSON, nullable=False),
    )
    vagas: int = Field(sa_column=Column(Integer, nullable=False))
    valido_ate: date = Field(sa_column=Column(Date, nullable=False))
    prazo_dias: int = Field(default=0, sa_column=Column(Integer, nullable=False))
    ativo: bool = Field(default=True, sa_column=Column(Boolean, nullable=False))
    criado_por: int = Field(sa_column=Column(Integer, nullable=False))
    criado_em: datetime = Field(
        default_factory=_utcnow,
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )
    desligado_em: Optional[datetime] = Field(
        default=None,
        sa_column=Column(DateTime(timezone=True), nullable=True),
    )


class LinkAcessoUso(SQLModel, table=True):
    __tablename__ = "link_acesso_uso"
    __table_args__ = (
        UniqueConstraint("link_id", "user_id", name="uq_link_acesso_uso_link_user"),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    link_id: int = Field(
        sa_column=Column(
            Integer,
            ForeignKey("link_acesso.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        )
    )
    user_id: int = Field(
        sa_column=Column(
            Integer,
            ForeignKey("user.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        )
    )
    kits_concedidos: list[str] = Field(
        default_factory=list,
        sa_column=Column(JSON, nullable=False),
    )
    criado_em: datetime = Field(
        default_factory=_utcnow,
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )
