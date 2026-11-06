"""add_kit_certificate

Revision ID: b2c3d4e5f607
Revises: a08cc2a043c8
Create Date: 2026-09-24 14:40:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel  # noqa: F401


# revision identifiers, used by Alembic.
revision: str = 'b2c3d4e5f607'
down_revision: Union[str, None] = 'a08cc2a043c8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if 'kit_certificate' in inspector.get_table_names():
        return

    op.create_table(
        'kit_certificate',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('code', sa.String(length=16), nullable=False),
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
        sa.Column(
            'entitlement_id',
            sa.Integer(),
            sa.ForeignKey('kit_entitlement.id', ondelete='SET NULL'),
            nullable=True,
        ),
        sa.Column('full_name', sa.String(length=255), nullable=False),
        sa.Column('formal_title', sa.String(length=255), nullable=False),
        sa.Column('issued_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('via', sa.String(length=32), nullable=False),
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
        sa.UniqueConstraint('user_id', 'kit', name='uq_kit_certificate_user_kit'),
    )
    op.create_index(
        'ix_kit_certificate_code', 'kit_certificate', ['code'], unique=True
    )
    op.create_index(
        'ix_kit_certificate_user_id', 'kit_certificate', ['user_id']
    )
    op.create_index(
        'ix_kit_certificate_org_id', 'kit_certificate', ['org_id']
    )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if 'kit_certificate' in inspector.get_table_names():
        op.drop_table('kit_certificate')
