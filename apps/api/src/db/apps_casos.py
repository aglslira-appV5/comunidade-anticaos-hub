from datetime import UTC, datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from sqlmodel import Field, SQLModel


def _utcnow() -> datetime:
    return datetime.now(UTC)


class AppsCaso(SQLModel, table=True):
    __tablename__ = "apps_caso"

    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(
        sa_column=Column(
            Integer,
            ForeignKey("user.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        )
    )
    origem: str = Field(
        sa_column=Column(
            String(12),
            nullable=False,
        )
    )
    texto: str = Field(
        sa_column=Column(
            String(280),
            nullable=False,
        )
    )
    resultado: str = Field(
        default="",
        sa_column=Column(
            String(140),
            nullable=False,
            default="",
        ),
    )
    ordem: int = Field(
        default=1,
        sa_column=Column(
            Integer,
            nullable=False,
            default=1,
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
