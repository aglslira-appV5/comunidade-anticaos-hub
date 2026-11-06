from datetime import UTC, datetime
import logging

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String
from sqlmodel import Field, SQLModel

# Evita que o aiosqlite despeje parâmetros SQL (e-mail e texto do avaliador) no log DEBUG.
logging.getLogger("aiosqlite").setLevel(logging.WARNING)


def _utcnow() -> datetime:
    return datetime.now(UTC)


class AppsAvaliacao(SQLModel, table=True):
    __tablename__ = "apps_avaliacao"

    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(
        sa_column=Column(
            Integer,
            ForeignKey("user.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        )
    )
    token: str = Field(
        sa_column=Column(
            String(64),
            nullable=False,
            unique=True,
        )
    )
    token_expira_em: datetime = Field(
        sa_column=Column(
            DateTime(timezone=True),
            nullable=False,
        )
    )
    status: str = Field(
        default="pedido",
        sa_column=Column(
            String(24),
            nullable=False,
            default="pedido",
        ),
    )
    avaliador_nome: str | None = Field(
        default=None,
        sa_column=Column(
            String(80),
            nullable=True,
        ),
    )
    avaliador_email: str | None = Field(
        default=None,
        sa_column=Column(
            String(254),
            nullable=True,
        ),
    )
    papel: str | None = Field(
        default=None,
        sa_column=Column(
            String(20),
            nullable=True,
        ),
    )
    estrelas: int | None = Field(
        default=None,
        sa_column=Column(
            Integer,
            nullable=True,
        ),
    )
    texto: str | None = Field(
        default=None,
        sa_column=Column(
            String(300),
            nullable=True,
        ),
    )
    codigo_confirmacao: str | None = Field(
        default=None,
        sa_column=Column(
            String(64),
            nullable=True,
            unique=True,
        ),
    )
    codigo_expira_em: datetime | None = Field(
        default=None,
        sa_column=Column(
            DateTime(timezone=True),
            nullable=True,
        ),
    )
    confirmada_em: datetime | None = Field(
        default=None,
        sa_column=Column(
            DateTime(timezone=True),
            nullable=True,
        ),
    )
    publicada: bool = Field(
        default=False,
        sa_column=Column(
            Boolean,
            nullable=False,
            default=False,
        ),
    )
    created_at: datetime = Field(
        default_factory=_utcnow,
        sa_column=Column(
            DateTime(timezone=True),
            nullable=False,
            default=_utcnow,
        ),
    )
    updated_at: datetime = Field(
        default_factory=_utcnow,
        sa_column=Column(
            DateTime(timezone=True),
            nullable=False,
            default=_utcnow,
        ),
    )
