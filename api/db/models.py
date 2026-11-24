"""SQLAlchemy models. Alembic autogenerate reads Base.metadata, so every table is declared here.

Add a table, then create its migration from api/:
    alembic revision --autogenerate -m "add_<table>"
and review the generated file in migrations/versions/ before committing it.
"""

import uuid
from datetime import datetime

from sqlalchemy import (
    JSON,
    Boolean,
    CheckConstraint,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    MetaData,
    String,
    Text,
    UniqueConstraint,
    Uuid,
    false,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

# Deterministic constraint / index names, so migrations stay stable across environments.
NAMING_CONVENTION = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}


class Base(DeclarativeBase):
    metadata = MetaData(naming_convention=NAMING_CONVENTION)


class TimestampMixin:
    """created_at / updated_at stored as timestamptz (UTC), for business tables."""

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


GUIDE_STATUSES = ("draft", "published")


class Guide(TimestampMixin, Base):
    """An anticipation guide for one venue.

    A guide stays in "draft" until a human reviews and publishes it: the AI never publishes.
    """

    __tablename__ = "guides"
    __table_args__ = (
        CheckConstraint(
            "status IN ('draft', 'published')", name="status_is_known"
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    venue_name: Mapped[str] = mapped_column(String(200), nullable=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False, server_default="draft")
    language: Mapped[str] = mapped_column(String(10), nullable=False, server_default="es")
    # Null while the guide is a draft: it only gets a public URL once published.
    public_slug: Mapped[str | None] = mapped_column(String(100), unique=True)
    qr_url: Mapped[str | None] = mapped_column(Text)
    # Last human review. The public guide always shows this date.
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    steps: Mapped[list["Step"]] = relationship(
        back_populates="guide",
        cascade="all, delete-orphan",
        order_by="Step.position",
    )


STEP_CATEGORIES = (
    "entrance",
    "reception",
    "waiting",
    "corridor",
    "appointment",
    "restroom",
    "exit",
    "other",
)
NOISE_LEVELS = ("quiet", "medium", "noisy")

# JSONB on PostgreSQL, plain JSON on SQLite so the CI can run without a database.
StringList = JSON().with_variant(JSONB, "postgresql")


class Step(TimestampMixin, Base):
    """One stage of the route, cut from the uploaded video.

    Field names follow contracts/guide.schema.json, except `position`, which the contract calls
    `order` (a reserved SQL word).
    """

    __tablename__ = "steps"
    __table_args__ = (
        UniqueConstraint("guide_id", "position", name="uq_steps_guide_id_position"),
        CheckConstraint("end_seconds > start_seconds", name="clip_lasts_a_positive_time"),
        CheckConstraint(
            "category IN ('entrance', 'reception', 'waiting', 'corridor', 'appointment', "
            "'restroom', 'exit', 'other')",
            name="category_is_known",
        ),
        CheckConstraint(
            "noise_level IS NULL OR noise_level IN ('quiet', 'medium', 'noisy')",
            name="noise_level_is_known",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    guide_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("guides.id", ondelete="CASCADE"), nullable=False, index=True
    )
    position: Mapped[int] = mapped_column(Integer, nullable=False)

    # Written by Gemini, corrected by the venue.
    title: Mapped[str] = mapped_column(String(60), nullable=False)
    start_seconds: Mapped[float] = mapped_column(Float, nullable=False)
    end_seconds: Mapped[float] = mapped_column(Float, nullable=False)
    photo_second: Mapped[float] = mapped_column(Float, nullable=False)
    easy_read_text: Mapped[str] = mapped_column(Text, nullable=False)
    what_to_expect: Mapped[list[str]] = mapped_column(
        StringList, nullable=False, default=list
    )
    # Empty when the video does not show it, so the venue can fill it in. Never invented.
    who_to_ask_for_help: Mapped[str | None] = mapped_column(Text)
    category: Mapped[str] = mapped_column(String(20), nullable=False)

    # Added by the media pipeline.
    clip_url: Mapped[str | None] = mapped_column(Text)
    photo_url: Mapped[str | None] = mapped_column(Text)
    sound_available: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=false()
    )
    # Relative to the rest of the video, never decibels: the phone mic is not calibrated.
    # Null until the audio is measured.
    noise_level: Mapped[str | None] = mapped_column(String(10))
    pictogram_url: Mapped[str | None] = mapped_column(Text)

    guide: Mapped["Guide"] = relationship(back_populates="steps")
