from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import (
    Column,
    DateTime,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlmodel import Field, SQLModel


class DiagEmailSupressao(SQLModel, table=True):
    """Lista de supressão LGPD (guarda apenas o hash SHA-256 do e-mail normalizado)."""

    __tablename__ = "diag_email_supressao"
    __table_args__ = (
        UniqueConstraint("email_hash", name="uq_diag_email_supressao_hash"),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    email_hash: str = Field(sa_column=Column(String(64), nullable=False, index=True))
    motivo: str = Field(
        default="recusado", sa_column=Column(String(32), nullable=False)
    )
    criado_em: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )


class DiagEmailConvite(SQLModel, table=True):
    """Registro de convite (colega ou liderado) na fila de e-mails do hub."""

    __tablename__ = "diag_email_convite"
    __table_args__ = (
        UniqueConstraint("convite_id", name="uq_diag_email_convite_id"),
        Index("ix_diag_email_convite_token", "token"),
        Index("ix_diag_email_convite_status_criado", "status", "criado_em"),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    convite_id: str = Field(sa_column=Column(String(120), nullable=False))
    token: str = Field(sa_column=Column(String(120), nullable=False))
    tipo: str = Field(sa_column=Column(String(24), nullable=False))  # colega | liderado
    remetente_nome: str = Field(sa_column=Column(String(120), nullable=False))
    nome: Optional[str] = Field(default=None, sa_column=Column(String(200), nullable=True))
    email: Optional[str] = Field(default=None, sa_column=Column(String(320), nullable=True))
    email_hash: str = Field(sa_column=Column(String(64), nullable=False, index=True))
    link_url: str = Field(sa_column=Column(Text, nullable=False))
    status: str = Field(
        default="enviado", sa_column=Column(String(24), nullable=False, default="enviado")
    )  # enviado | respondido | recusado | expurgado
    lembretes_enviados: int = Field(
        default=0, sa_column=Column(Integer, nullable=False, default=0)
    )
    provider_id: Optional[str] = Field(
        default=None, sa_column=Column(String(120), nullable=True)
    )
    criado_em: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )
    respondido_em: Optional[datetime] = Field(
        default=None, sa_column=Column(DateTime(timezone=True), nullable=True)
    )
    recusado_em: Optional[datetime] = Field(
        default=None, sa_column=Column(DateTime(timezone=True), nullable=True)
    )
    expurgado_em: Optional[datetime] = Field(
        default=None, sa_column=Column(DateTime(timezone=True), nullable=True)
    )


class DiagEmailLembrete(SQLModel, table=True):
    """Lembretes agendados (+12 h, +24 h e +36 h) de um convite de diagnóstico."""

    __tablename__ = "diag_email_lembrete"
    __table_args__ = (
        UniqueConstraint(
            "convite_id", "passo", name="uq_diag_email_lembrete_convite_passo"
        ),
        Index("ix_diag_email_lembrete_status_agendado", "status", "agendado_para"),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    convite_id: str = Field(sa_column=Column(String(120), nullable=False, index=True))
    passo: int = Field(sa_column=Column(Integer, nullable=False))  # 1, 2 ou 3
    horas: int = Field(sa_column=Column(Integer, nullable=False))  # 12, 24 ou 36
    agendado_para: datetime = Field(
        sa_column=Column(DateTime(timezone=True), nullable=False)
    )
    status: str = Field(
        default="pendente",
        sa_column=Column(String(24), nullable=False, default="pendente"),
    )  # pendente | enviado | cancelado
    enviado_em: Optional[datetime] = Field(
        default=None, sa_column=Column(DateTime(timezone=True), nullable=True)
    )
    provider_id: Optional[str] = Field(
        default=None, sa_column=Column(String(120), nullable=True)
    )


class DiagEmailLembrete30d(SQLModel, table=True):
    """Lembrete de 30 dias do plano do Mapa Wi-Fi Humano (421-D3)."""

    __tablename__ = "diag_email_lembrete_30d"
    __table_args__ = (
        UniqueConstraint("chave", name="uq_diag_email_lembrete_30d_chave"),
        Index("ix_diag_email_lembrete_30d_status_lembrar", "status", "lembrar_em"),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    chave: str = Field(sa_column=Column(String(160), nullable=False))
    resposta_id: Optional[str] = Field(
        default=None, sa_column=Column(String(120), nullable=True)
    )
    nome: str = Field(sa_column=Column(String(200), nullable=False))
    email: Optional[str] = Field(
        default=None, sa_column=Column(String(320), nullable=True)
    )
    email_hash: str = Field(sa_column=Column(String(64), nullable=False, index=True))
    mapa_url: Optional[str] = Field(default=None, sa_column=Column(Text, nullable=True))
    lembrar_em: datetime = Field(
        sa_column=Column(DateTime(timezone=True), nullable=False)
    )
    status: str = Field(
        default="pendente",
        sa_column=Column(String(24), nullable=False, default="pendente"),
    )  # pendente | enviado | cancelado
    criado_em: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )
    enviado_em: Optional[datetime] = Field(
        default=None, sa_column=Column(DateTime(timezone=True), nullable=True)
    )
    provider_id: Optional[str] = Field(
        default=None, sa_column=Column(String(120), nullable=True)
    )
