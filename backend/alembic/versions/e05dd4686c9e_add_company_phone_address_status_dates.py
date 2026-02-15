"""add company phone address status dates

Revision ID: e05dd4686c9e
Revises: brand_final
Create Date: 2026-01-11 19:11:53.385994

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e05dd4686c9e'
down_revision: Union[str, Sequence[str], None] = 'brand_final'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
