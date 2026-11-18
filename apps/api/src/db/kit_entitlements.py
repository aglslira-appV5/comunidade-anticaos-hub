from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlmodel import Field, SQLModel


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class KitEntitlement(SQLModel, table=True):
    __tablename__ = "kit_entitlement"
    __table_args__ = (
        UniqueConstraint("user_id", "kit", name="uq_kit_entitlement_user_kit"),
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
    org_id: int = Field(
        sa_column=Column(
            Integer,
            ForeignKey("organization.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        )
    )
    kit: str = Field(sa_column=Column(String(64), nullable=False))
    source: str = Field(sa_column=Column(String(32), nullable=False))
    order_code: Optional[str] = Field(
        default=None,
        sa_column=Column(String(128), nullable=True, index=True),
    )
    granted_at: datetime = Field(
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )
    expires_at: Optional[datetime] = Field(
        default=None,
        sa_column=Column(DateTime(timezone=True), nullable=True),
    )
    revoked_at: Optional[datetime] = Field(
        default=None,
        sa_column=Column(DateTime(timezone=True), nullable=True),
    )
    revoked_reason: Optional[str] = Field(
        default=None,
        sa_column=Column(String(64), nullable=True),
    )
    created_at: datetime = Field(
        default_factory=_utcnow,
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )
    updated_at: datetime = Field(
        default_factory=_utcnow,
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )
