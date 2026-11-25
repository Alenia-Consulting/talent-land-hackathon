"""add_step_points_of_interest

Up to three things to point at on the photo of each step (exits, doors, windows, tables, counters,
restrooms, ramps, places to rest), as relative boxes, so the front can draw them over the clip
paused at the photo second and read their description aloud. Reviewed by hand.

Revision ID: f2b4d6a8c013
Revises: e7a1b3c5d902
Create Date: 2026-11-25 11:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'f2b4d6a8c013'
down_revision: Union[str, Sequence[str], None] = 'e7a1b3c5d902'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # NOT NULL with a default, so old Pods that do not know the column keep inserting steps.
    op.add_column(
        "steps",
        sa.Column("points_of_interest", postgresql.JSONB(astext_type=sa.Text()),
                  nullable=False, server_default="[]"),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("steps", "points_of_interest")
