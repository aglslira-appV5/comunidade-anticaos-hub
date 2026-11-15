"""add_mostrar_sinal_e_online

Revision ID: f2e023e6def0
Revises: e5f6a7b8c902
Create Date: 2026-10-01 19:36:40.609679

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel  # noqa: F401


# revision identifiers, used by Alembic.
revision: str = "f2e023e6def0"
down_revision: Union[str, None] = "e5f6a7b8c902"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = [c["name"] for c in inspector.get_columns("apps_perfil")]

    if "mostrar_sinal" not in columns:
        op.add_column(
            "apps_perfil",
            sa.Column("mostrar_sinal", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        )
    if "mostrar_online" not in columns:
        op.add_column(
            "apps_perfil",
            sa.Column("mostrar_online", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = [c["name"] for c in inspector.get_columns("apps_perfil")]

    if "mostrar_online" in columns:
        op.drop_column("apps_perfil", "mostrar_online")
    if "mostrar_sinal" in columns:
        op.drop_column("apps_perfil", "mostrar_sinal")
