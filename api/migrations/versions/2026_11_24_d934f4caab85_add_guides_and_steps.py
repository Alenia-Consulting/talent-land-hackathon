"""add_guides_and_steps

First schema: a guide and the ordered steps of its route. Reviewed by hand.

Revision ID: d934f4caab85
Revises: 
Create Date: 2026-11-24 14:10:42.446334

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'd934f4caab85'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table('guides',
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('venue_name', sa.String(length=200), nullable=False),
    sa.Column('status', sa.String(length=16), server_default='draft', nullable=False),
    sa.Column('language', sa.String(length=10), server_default='es', nullable=False),
    sa.Column('public_slug', sa.String(length=100), nullable=True),
    sa.Column('qr_url', sa.Text(), nullable=True),
    sa.Column('reviewed_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.CheckConstraint("status IN ('draft', 'published')", name=op.f('ck_guides_status_is_known')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_guides')),
    sa.UniqueConstraint('public_slug', name=op.f('uq_guides_public_slug'))
    )
    op.create_table('steps',
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('guide_id', sa.Uuid(), nullable=False),
    sa.Column('position', sa.Integer(), nullable=False),
    sa.Column('title', sa.String(length=60), nullable=False),
    sa.Column('start_seconds', sa.Float(), nullable=False),
    sa.Column('end_seconds', sa.Float(), nullable=False),
    sa.Column('photo_second', sa.Float(), nullable=False),
    sa.Column('easy_read_text', sa.Text(), nullable=False),
    sa.Column('what_to_expect', sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), 'postgresql'), nullable=False),
    sa.Column('who_to_ask_for_help', sa.Text(), nullable=True),
    sa.Column('category', sa.String(length=20), nullable=False),
    sa.Column('clip_url', sa.Text(), nullable=True),
    sa.Column('photo_url', sa.Text(), nullable=True),
    sa.Column('sound_available', sa.Boolean(), server_default=sa.text('false'), nullable=False),
    sa.Column('noise_level', sa.String(length=10), nullable=True),
    sa.Column('pictogram_url', sa.Text(), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.CheckConstraint("category IN ('entrance', 'reception', 'waiting', 'corridor', 'appointment', 'restroom', 'exit', 'other')", name=op.f('ck_steps_category_is_known')),
    sa.CheckConstraint("noise_level IS NULL OR noise_level IN ('quiet', 'medium', 'noisy')", name=op.f('ck_steps_noise_level_is_known')),
    sa.CheckConstraint('end_seconds > start_seconds', name=op.f('ck_steps_clip_lasts_a_positive_time')),
    sa.ForeignKeyConstraint(['guide_id'], ['guides.id'], name=op.f('fk_steps_guide_id_guides'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_steps')),
    sa.UniqueConstraint('guide_id', 'position', name='uq_steps_guide_id_position')
    )
    op.create_index(op.f('ix_steps_guide_id'), 'steps', ['guide_id'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_steps_guide_id'), table_name='steps')
    op.drop_table('steps')
    op.drop_table('guides')
