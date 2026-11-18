from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import Column, DateTime, ForeignKey, Integer, Text, UniqueConstraint
from sqlmodel import Field, SQLModel


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class NeuroSinapse(SQLModel, table=True):
    __tablename__ = "neuro_sinapse"
    __table_args__ = (
        UniqueConstraint("user_id", "aula", name="uq_neuro_sinapse_user_aula"),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(
        sa_column=Column(
            Integer,
            ForeignKey("user.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        )
    )
    aula: int = Field(sa_column=Column(Integer, nullable=False))
    caso: str = Field(sa_column=Column(Text, nullable=False))
    acesa_em: datetime = Field(
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )
    atualizada_em: datetime = Field(
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )
