"""add_routes

A guide is a place and can have several recordings of it, each with its own video and steps. Every
existing guide gets one route holding all its steps, so nothing changes for what is already there.
Reviewed by hand.

Revision ID: b5d7f9a1c346
Revises: a9c3e5f7b124
Create Date: 2026-11-25 14:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'b5d7f9a1c346'
down_revision: Union[str, Sequence[str], None] = 'a9c3e5f7b124'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "routes",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("guide_id", sa.Uuid(), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=120), nullable=False),
        sa.Column("video_duration_seconds", sa.Float(), nullable=True),
        sa.Column("processing_status", sa.String(length=12), server_default="pending", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint(
            "processing_status IN ('pending', 'processing', 'done', 'failed')",
            name=op.f("ck_routes_processing_status_is_known"),
        ),
        sa.ForeignKeyConstraint(["guide_id"], ["guides.id"], name=op.f("fk_routes_guide_id_guides"), ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_routes")),
        sa.UniqueConstraint("guide_id", "position", name="uq_routes_guide_id_position"),
    )
    op.create_index(op.f("ix_routes_guide_id"), "routes", ["guide_id"], unique=False)
    # Supabase exposes `public` through its Data API: no policies, so nothing is readable there.
    op.execute("ALTER TABLE routes ENABLE ROW LEVEL SECURITY")

    op.add_column("steps", sa.Column("route_id", sa.Uuid(), nullable=True))
    op.create_index(op.f("ix_steps_route_id"), "steps", ["route_id"], unique=False)
    op.create_foreign_key(
        op.f("fk_steps_route_id_routes"), "steps", "routes", ["route_id"], ["id"], ondelete="CASCADE"
    )

    # One route per existing guide, carrying its title, duration and processing state.
    op.execute(
        "INSERT INTO routes (id, guide_id, position, title, video_duration_seconds, processing_status) "
        "SELECT gen_random_uuid(), id, 1, title, video_duration_seconds, processing_status FROM guides"
    )
    op.execute(
        "UPDATE steps SET route_id = routes.id FROM routes WHERE routes.guide_id = steps.guide_id"
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint(op.f("fk_steps_route_id_routes"), "steps", type_="foreignkey")
    op.drop_index(op.f("ix_steps_route_id"), table_name="steps")
    op.drop_column("steps", "route_id")
    op.drop_index(op.f("ix_routes_guide_id"), table_name="routes")
    op.drop_table("routes")
