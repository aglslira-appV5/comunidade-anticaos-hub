"""add_apps_perfil

Revision ID: d4e5f6a7b801
Revises: c3d4e5f6a708
Create Date: 2026-10-01 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel  # noqa: F401


# revision identifiers, used by Alembic.
revision: str = "d4e5f6a7b801"
down_revision: Union[str, None] = "c3d4e5f6a708"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if "apps_perfil" in inspector.get_table_names():
        return

    op.create_table(
        "apps_perfil",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("user.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("slug", sa.String(length=40), nullable=False),
        sa.Column("nome_exibido", sa.String(length=12), nullable=False),
        sa.Column("artigo", sa.String(length=2), nullable=False, server_default="de"),
        sa.Column("publico", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("trocas_nome", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("user_id", name="uq_apps_perfil_user_id"),
        sa.UniqueConstraint("slug", name="uq_apps_perfil_slug"),
    )
    op.create_index(
        "ix_apps_perfil_user_id", "apps_perfil", ["user_id"]
    )
    op.create_index(
        "ix_apps_perfil_slug", "apps_perfil", ["slug"]
    )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if "apps_perfil" in inspector.get_table_names():
        op.drop_table("apps_perfil")
