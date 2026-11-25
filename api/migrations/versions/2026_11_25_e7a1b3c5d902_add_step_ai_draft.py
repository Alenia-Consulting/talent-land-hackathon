"""add_step_ai_draft

Keeps what the AI wrote for a step, as it wrote it, with the model and the time. The text fields
themselves are what a person edits in the review panel, so without this copy the original draft
is lost. Reviewed by hand.

Revision ID: e7a1b3c5d902
Revises: c4d8e2f6a913
Create Date: 2026-11-25 09:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'e7a1b3c5d902'
down_revision: Union[str, Sequence[str], None] = 'c4d8e2f6a913'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column("steps", sa.Column("ai_draft", postgresql.JSONB(astext_type=sa.Text()), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("steps", "ai_draft")
