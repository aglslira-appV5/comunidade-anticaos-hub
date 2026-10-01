from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlmodel import Field, SQLModel


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class KitCertificate(SQLModel, table=True):
    __tablename__ = "kit_certificate"
    __table_args__ = (
        UniqueConstraint("user_id", "kit", name="uq_kit_certificate_user_kit"),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    code: str = Field(
        sa_column=Column(String(16), nullable=False, unique=True, index=True)
    )
    user_id: int = Field(
        sa_column=Column(
            Integer,
            ForeignKey("user.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        )
    )
    org_id: int = Field(
        sa_column=Column(
            Integer,
            ForeignKey("organization.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        )
    )
    kit: str = Field(sa_column=Column(String(64), nullable=False))
    entitlement_id: Optional[int] = Field(
        default=None,
        sa_column=Column(
            Integer,
            ForeignKey("kit_entitlement.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    full_name: str = Field(sa_column=Column(String(255), nullable=False))
    formal_title: str = Field(sa_column=Column(String(255), nullable=False))
    issued_at: datetime = Field(
        sa_column=Column(DateTime(timezone=True), nullable=False)
    )
    via: str = Field(sa_column=Column(String(32), nullable=False))
    created_at: datetime = Field(
        default_factory=_utcnow,
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )
    updated_at: datetime = Field(
        default_factory=_utcnow,
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )
