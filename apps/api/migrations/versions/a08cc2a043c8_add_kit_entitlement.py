"""add_kit_entitlement

Revision ID: a08cc2a043c8
Revises: b1c2d3e4f5a6
Create Date: 2026-09-23 13:25:48.629025

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel  # noqa: F401


# revision identifiers, used by Alembic.
revision: str = 'a08cc2a043c8'
down_revision: Union[str, None] = 'b1c2d3e4f5a6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if 'kit_entitlement' in inspector.get_table_names():
        return

    op.create_table(
        'kit_entitlement',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column(
            'user_id',
            sa.Integer(),
            sa.ForeignKey('user.id', ondelete='CASCADE'),
            nullable=False,
        ),
        sa.Column(
            'org_id',
            sa.Integer(),
            sa.ForeignKey('organization.id', ondelete='CASCADE'),
            nullable=False,
        ),
        sa.Column('kit', sa.String(length=64), nullable=False),
        sa.Column('source', sa.String(length=32), nullable=False),
        sa.Column('order_code', sa.String(length=128), nullable=True),
        sa.Column('granted_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('revoked_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('revoked_reason', sa.String(length=64), nullable=True),
        sa.Column(
            'created_at',
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            'updated_at',
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.UniqueConstraint('user_id', 'kit', name='uq_kit_entitlement_user_kit'),
    )
    op.create_index(
        'ix_kit_entitlement_user_id', 'kit_entitlement', ['user_id']
    )
    op.create_index(
        'ix_kit_entitlement_org_id', 'kit_entitlement', ['org_id']
    )
    op.create_index(
        'ix_kit_entitlement_order_code', 'kit_entitlement', ['order_code']
    )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if 'kit_entitlement' in inspector.get_table_names():
        op.drop_table('kit_entitlement')
