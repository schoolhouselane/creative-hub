"""add chat_history and brand_dna to brand_profiles

Revision ID: b1c4e8f92a3d
Revises: ae7b026378e6
Create Date: 2026-06-04

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'b1c4e8f92a3d'
down_revision: Union[str, Sequence[str], None] = 'ae7b026378e6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('brand_profiles', sa.Column('brand_dna', sa.Text(), nullable=True))
    op.add_column('brand_profiles', sa.Column('chat_history', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('brand_profiles', 'chat_history')
    op.drop_column('brand_profiles', 'brand_dna')
