"""add google calendar fields to appointments

Revision ID: 383d15786f72
Revises: 7d54e0d66460
Create Date: 2026-01-05 02:05:00.828978

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '383d15786f72'
down_revision: Union[str, Sequence[str], None] = '7d54e0d66460'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
