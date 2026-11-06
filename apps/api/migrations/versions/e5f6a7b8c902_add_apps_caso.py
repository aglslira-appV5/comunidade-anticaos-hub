"""add_apps_caso

Revision ID: e5f6a7b8c902
Revises: d4e5f6a7b801
Create Date: 2026-10-01 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel  # noqa: F401


# revision identifiers, used by Alembic.
revision: str = "e5f6a7b8c902"
down_revision: Union[str, None] = "d4e5f6a7b801"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if "apps_caso" in inspector.get_table_names():
        return

    op.create_table(
        "apps_caso",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("user.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("origem", sa.String(length=12), nullable=False),
        sa.Column("texto", sa.String(length=280), nullable=False),
        sa.Column("resultado", sa.String(length=140), nullable=False, server_default=""),
        sa.Column("ordem", sa.Integer(), nullable=False, server_default=sa.text("1")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index(
        "ix_apps_caso_user_id", "apps_caso", ["user_id"]
    )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if "apps_caso" in inspector.get_table_names():
        op.drop_table("apps_caso")
