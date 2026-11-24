"""Repository for guides and their steps.

Routes and business logic call this module; they never touch the ORM session or raw SQL. That keeps
the database mockable in the CI, which runs without PostgreSQL.

Nothing here commits: the caller owns the transaction (in FastAPI, the get_session dependency).
"""

import re
import unicodedata
import uuid
from collections.abc import Iterable
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from db.models import Guide, Step

DEFAULT_PAGE_SIZE = 20


def create(
    session: Session,
    *,
    venue_name: str,
    steps: Iterable[dict],
    language: str = "es",
) -> Guide:
    """Store a new guide as a draft. Only a human publishes it later."""
    guide = Guide(venue_name=venue_name, language=language, status="draft")
    guide.steps = [Step(**step) for step in steps]
    session.add(guide)
    session.flush()
    return guide


def get(session: Session, guide_id: uuid.UUID) -> Guide | None:
    """Fetch any guide, draft included. For the review panel, never for the public link."""
    return session.get(Guide, guide_id)


def get_published(session: Session, slug: str) -> Guide | None:
    """Fetch a guide for the public link.

    Drafts are invisible here on purpose: nothing reaches a visitor without human review.
    """
    statement = select(Guide).where(Guide.public_slug == slug, Guide.status == "published")
    return session.scalars(statement).one_or_none()


def list_guides(
    session: Session, *, limit: int = DEFAULT_PAGE_SIZE, offset: int = 0
) -> list[Guide]:
    """One page of guides, most recent first. Never the whole table."""
    statement = (
        select(Guide).order_by(Guide.created_at.desc()).limit(limit).offset(offset)
    )
    return list(session.scalars(statement))


def publish(session: Session, guide: Guide) -> Guide:
    """Mark a reviewed guide as published and stamp the review date.

    The public guide always shows that date, so visitors know how fresh the route is.
    """
    if guide.public_slug is None:
        guide.public_slug = _unique_slug(session, guide.venue_name)
    guide.status = "published"
    guide.reviewed_at = datetime.now(UTC)
    session.flush()
    return guide


def _slugify(venue_name: str) -> str:
    plain = unicodedata.normalize("NFKD", venue_name).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", plain.lower()).strip("-")


def _unique_slug(session: Session, venue_name: str) -> str:
    base = _slugify(venue_name) or "guia"
    slug, suffix = base, 1
    while session.scalars(select(Guide.id).where(Guide.public_slug == slug)).first():
        suffix += 1
        slug = f"{base}-{suffix}"
    return slug
