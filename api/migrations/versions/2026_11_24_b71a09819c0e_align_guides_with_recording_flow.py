"""align_guides_with_recording_flow

The route is marked by a person while recording, so a step can exist before it has
any text. Adds the guide title, the review state of each step and the data the
venue still has to fill in. Reviewed by hand.

Revision ID: b71a09819c0e
Revises: d934f4caab85
Create Date: 2026-11-24 15:19:48.608376

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'b71a09819c0e'
down_revision: Union[str, Sequence[str], None] = 'd934f4caab85'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Existing rows need a value before the column can be NOT NULL, so each one is added with a
    # server default that is dropped right after. Old and new Pods run together during a rollout.
    op.add_column(
        "guides",
        sa.Column("title", sa.String(length=120), nullable=False,
                  server_default="Recorrido principal"),
    )
    op.alter_column("guides", "title", server_default=None)
    op.add_column("guides", sa.Column("video_duration_seconds", sa.Float(), nullable=True))
    op.add_column("guides", sa.Column("walking_minutes", sa.Integer(), nullable=True))
    op.add_column("guides", sa.Column("cover_photo_url", sa.Text(), nullable=True))

    op.add_column("steps", sa.Column("duration_text", sa.String(length=80), nullable=True))
    op.add_column("steps", sa.Column("noise_level_source", sa.String(length=10), nullable=True))
    op.add_column(
        "steps",
        sa.Column("reviewed", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )
    for column in ("interests", "missing_fields"):
        op.add_column(
            "steps",
            sa.Column(
                column,
                sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), "postgresql"),
                nullable=False,
                server_default=sa.text("'[]'::jsonb"),
            ),
        )
        op.alter_column("steps", column, server_default=None)

    # A step is created before Gemini writes its text.
    op.alter_column("steps", "easy_read_text", existing_type=sa.TEXT(), nullable=True)

    # Alembic does not detect CHECK constraint changes: these two are written by hand.
    op.drop_constraint(op.f("ck_guides_status_is_known"), "guides", type_="check")
    op.create_check_constraint(
        "status_is_known", "guides", "status IN ('draft', 'needs_review', 'published')"
    )
    op.create_check_constraint(
        "noise_level_source_is_known",
        "steps",
        "noise_level_source IS NULL OR noise_level_source IN ('measured', 'manual')",
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint(op.f("ck_steps_noise_level_source_is_known"), "steps", type_="check")
    op.drop_constraint(op.f("ck_guides_status_is_known"), "guides", type_="check")
    op.create_check_constraint(
        "status_is_known", "guides", "status IN ('draft', 'published')"
    )

    op.alter_column("steps", "easy_read_text", existing_type=sa.TEXT(), nullable=False)
    op.drop_column("steps", "missing_fields")
    op.drop_column("steps", "interests")
    op.drop_column("steps", "reviewed")
    op.drop_column("steps", "noise_level_source")
    op.drop_column("steps", "duration_text")
    op.drop_column("guides", "cover_photo_url")
    op.drop_column("guides", "walking_minutes")
    op.drop_column("guides", "video_duration_seconds")
    op.drop_column("guides", "title")
