from datetime import UTC, datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String
from sqlmodel import Field, SQLModel


def _utcnow() -> datetime:
    return datetime.now(UTC)


class AppsPerfil(SQLModel, table=True):
    __tablename__ = "apps_perfil"

    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(
        sa_column=Column(
            Integer,
            ForeignKey("user.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
            index=True,
        )
    )
    slug: str = Field(
        sa_column=Column(
            String(40),
            nullable=False,
            unique=True,
            index=True,
        )
    )
    nome_exibido: str = Field(
        sa_column=Column(
            String(12),
            nullable=False,
        )
    )
    artigo: str = Field(
        sa_column=Column(
            String(2),
            nullable=False,
            default="de",
        )
    )
    publico: bool = Field(
        default=False,
        sa_column=Column(
            Boolean,
            nullable=False,
            default=False,
        ),
    )
    mostrar_sinal: bool = Field(
        default=False,
        sa_column=Column(
            Boolean,
            nullable=False,
            default=False,
            server_default="false",
        ),
    )
    mostrar_online: bool = Field(
        default=False,
        sa_column=Column(
            Boolean,
            nullable=False,
            default=False,
            server_default="false",
        ),
    )
    trocas_nome: int = Field(
        default=0,
        sa_column=Column(
            Integer,
            nullable=False,
            default=0,
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
