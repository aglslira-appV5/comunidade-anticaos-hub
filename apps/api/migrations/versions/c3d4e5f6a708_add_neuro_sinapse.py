"""add_neuro_sinapse

Revision ID: c3d4e5f6a708
Revises: b2c3d4e5f607
Create Date: 2026-09-28 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel  # noqa: F401


# revision identifiers, used by Alembic.
revision: str = 'c3d4e5f6a708'
down_revision: Union[str, None] = 'b2c3d4e5f607'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if 'neuro_sinapse' in inspector.get_table_names():
        return

    op.create_table(
        'neuro_sinapse',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column(
            'user_id',
            sa.Integer(),
            sa.ForeignKey('user.id', ondelete='CASCADE'),
            nullable=False,
        ),
        sa.Column('aula', sa.Integer(), nullable=False),
        sa.Column('caso', sa.Text(), nullable=False),
        sa.Column('acesa_em', sa.DateTime(timezone=True), nullable=False),
        sa.Column('atualizada_em', sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint('user_id', 'aula', name='uq_neuro_sinapse_user_aula'),
    )
    op.create_index(
        'ix_neuro_sinapse_user_id', 'neuro_sinapse', ['user_id']
    )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if 'neuro_sinapse' in inspector.get_table_names():
        op.drop_table('neuro_sinapse')
