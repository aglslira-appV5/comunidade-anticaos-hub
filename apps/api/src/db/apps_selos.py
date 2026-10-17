"""Selos que se provam sozinhos (428-B): cada selo ganho tem um código único e uma página de prova."""

from datetime import UTC, datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlmodel import Field, SQLModel


def _utcnow() -> datetime:
    return datetime.now(UTC)


class AppsSelo(SQLModel, table=True):
    __tablename__ = "apps_selo"
    __table_args__ = (UniqueConstraint("user_id", "selo", name="uq_apps_selo_user_selo"),)

    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(
        sa_column=Column(Integer, ForeignKey("user.id", ondelete="CASCADE"), nullable=False, index=True)
    )
    selo: str = Field(sa_column=Column(String(30), nullable=False))
    codigo: str = Field(sa_column=Column(String(12), nullable=False, unique=True, index=True))
    ganho_em: datetime = Field(sa_column=Column(DateTime(timezone=True), nullable=False))
    created_at: datetime = Field(
        default_factory=_utcnow,
        sa_column=Column(DateTime(timezone=True), nullable=False, default=_utcnow),
    )
