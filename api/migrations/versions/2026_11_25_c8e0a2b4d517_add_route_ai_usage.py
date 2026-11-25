"""add_route_ai_usage

Keeps the tokens Gemini billed for each video, so what a recording costs can be read from the
database instead of guessed. Reviewed by hand.

Revision ID: c8e0a2b4d517
Revises: b5d7f9a1c346
Create Date: 2026-11-25 14:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'c8e0a2b4d517'
down_revision: Union[str, Sequence[str], None] = 'b5d7f9a1c346'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column("routes", sa.Column("ai_usage", postgresql.JSONB(astext_type=sa.Text()), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("routes", "ai_usage")
