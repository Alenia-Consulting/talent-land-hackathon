"""add_step_sound_path

The path in the bucket of each step's ambience (the recording's audio, low-pass filtered so voices
cannot be understood). The contract already says whether a sound exists; this is where it is, so
the API can answer `sound_url` like it does `clip_url`. Reviewed by hand.

Revision ID: a9c3e5f7b124
Revises: f2b4d6a8c013
Create Date: 2026-11-25 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'a9c3e5f7b124'
down_revision: Union[str, Sequence[str], None] = 'f2b4d6a8c013'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column("steps", sa.Column("sound_path", sa.Text(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("steps", "sound_path")
