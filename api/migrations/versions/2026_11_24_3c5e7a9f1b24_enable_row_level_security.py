"""enable_row_level_security

Supabase exposes every table of the public schema through its Data API (PostgREST), reachable with
the publishable key that ships to browsers. Row level security with no policy denies that access.
The API connects as the database owner, which bypasses RLS, so nothing changes for it. On a plain
PostgreSQL (docker compose, Kubernetes) enabling RLS is harmless for the owner as well.

Revision ID: 3c5e7a9f1b24
Revises: b71a09819c0e
Create Date: 2026-11-24 17:05:00.000000

"""
from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = '3c5e7a9f1b24'
down_revision: Union[str, Sequence[str], None] = 'b71a09819c0e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

TABLES = ("guides", "steps")


def upgrade() -> None:
    for table in TABLES:
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")


def downgrade() -> None:
    for table in TABLES:
        op.execute(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY")
