"""store_media_paths_and_processing_status

Steps keep the path of their clip and photo inside the bucket instead of the full public URL,
which the API builds on the way out. Guides gain the state of their recording, so the panel can
show "processing" or "failed". Reviewed by hand.

Revision ID: c4d8e2f6a913
Revises: 3c5e7a9f1b24
Create Date: 2026-11-24 19:10:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'c4d8e2f6a913'
down_revision: Union[str, Sequence[str], None] = '3c5e7a9f1b24'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# "https://<project>.supabase.co/storage/v1/object/public/<bucket>/" in front of the path.
PUBLIC_PREFIX = r"^.*/storage/v1/object/public/[^/]+/"


def upgrade() -> None:
    """Upgrade schema."""
    op.alter_column("steps", "clip_url", new_column_name="clip_path")
    op.alter_column("steps", "photo_url", new_column_name="photo_path")
    for column in ("clip_path", "photo_path"):
        op.execute(
            f"UPDATE steps SET {column} = regexp_replace({column}, '{PUBLIC_PREFIX}', '') "
            f"WHERE {column} IS NOT NULL"
        )

    op.add_column(
        "guides",
        sa.Column("processing_status", sa.String(length=12), nullable=False,
                  server_default="pending"),
    )
    op.create_check_constraint(
        op.f("ck_guides_processing_status_is_known"),
        "guides",
        "processing_status IN ('pending', 'processing', 'done', 'failed')",
    )
    # A guide that already has its clips was processed before this column existed.
    op.execute(
        "UPDATE guides SET processing_status = 'done' "
        "WHERE id IN (SELECT guide_id FROM steps WHERE clip_path IS NOT NULL)"
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint(op.f("ck_guides_processing_status_is_known"), "guides", type_="check")
    op.drop_column("guides", "processing_status")
    op.alter_column("steps", "photo_path", new_column_name="photo_url")
    op.alter_column("steps", "clip_path", new_column_name="clip_url")
