"""Repository for guides and their steps.

Routes and business logic call this module; they never touch the ORM session or raw SQL. That keeps
the database mockable in the CI, which runs without PostgreSQL.

The route is not detected by the AI. The person picks the parts before recording and taps
"Llegue a: X" when reaching each one; those marks are what this module turns into steps.

Nothing here commits: the caller owns the transaction (in FastAPI, the get_session dependency).
"""

import re
import unicodedata
import uuid
from collections.abc import Iterable
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session, object_session

from db.models import Guide, Route, Step

DEFAULT_PAGE_SIZE = 20

# The recording screen asks the person to stand still for 3 seconds on arrival. The clearest frame
# is in the middle of that pause, and that is also the stretch where the noise is measured.
PAUSE_SECONDS = 3.0
MIN_MARKS = 1
# The shortest clip a step keeps when its mark lands past the end of the file.
MIN_STEP_SECONDS = 1.0


def create(
    session: Session,
    *,
    title: str,
    venue_name: str,
    marks: Iterable[dict],
    video_duration_seconds: float,
    language: str = "es",
    route_title: str | None = None,
) -> Guide:
    """Store a new guide as a draft, with one step per mark.

    The steps have no text yet: Gemini writes it afterwards and a person reviews it. Only a human
    publishes the result. The first route is named after its part when `route_title` comes, and
    after the guide otherwise.
    """
    steps = _steps_from_marks(marks, video_duration_seconds)
    guide = Guide(
        title=title,
        venue_name=venue_name,
        language=language,
        status="draft",
        video_duration_seconds=video_duration_seconds,
    )
    route = Route(position=1, title=route_title or title,
                  video_duration_seconds=video_duration_seconds)
    route.steps = [Step(**step) for step in steps]
    guide.routes = [route]
    guide.steps = list(route.steps)
    session.add(guide)
    session.flush()
    return guide


def add_route(
    session: Session,
    guide: Guide,
    *,
    title: str,
    marks: Iterable[dict],
    video_duration_seconds: float,
    position: int | None = None,
) -> Route:
    """Add another recording to a guide, with one step per mark.

    Without a position it goes last. With one it enters there and the routes after it move down;
    either way the steps of the whole guide are renumbered, so "paso 3 de 7" keeps meaning
    something. The guide goes back to waiting for a video: the new route has none yet.
    """
    if not guide.routes:
        latest_route(guide)  # a guide older than routes keeps its steps in route 1
    steps = _steps_from_marks(marks, video_duration_seconds)
    # Positions are unique per guide and the new rows start at 1: nothing may be flushed until
    # _renumber has moved every row out of the way.
    with session.no_autoflush:
        last = max((one.position for one in guide.routes), default=0) + 1
        place = last if position is None else min(position, last)
        for one in guide.routes:
            if one.position >= place:
                one.position += 1
        route = Route(
            guide_id=guide.id,
            position=place,
            title=title,
            video_duration_seconds=video_duration_seconds,
        )
        route.steps = [Step(**step) for step in steps]
        guide.routes.append(route)
        guide.steps.extend(route.steps)
    _renumber(guide)
    guide.processing_status = "pending"
    guide.video_duration_seconds = sum(
        one.video_duration_seconds or 0.0 for one in guide.routes
    )
    session.flush()
    return route


def _renumber(guide: Guide) -> None:
    """Number the routes 1..n and, following that order, the steps of the guide 1..m.

    Only numbers: durations and everything else stay where they are. The positions are unique per
    guide, so they first move out of the way (to negatives) and are flushed; otherwise two rows
    would briefly share a number and the database would refuse.
    """
    session = object_session(guide)  # a guide being renumbered always lives in one
    with session.no_autoflush:
        routes = sorted(guide.routes, key=lambda one: one.position)
        steps = [step for one in routes for step in sorted(one.steps, key=lambda s: s.position)]
    for index, row in enumerate([*routes, *steps], start=1):
        row.position = -index
    session.flush()
    for number, one in enumerate(routes, start=1):
        one.position = number
    for number, step in enumerate(steps, start=1):
        step.position = number


def retime_route(route: Route, measured_seconds: float) -> None:
    """Move the route's steps onto the real timeline of the file that was uploaded.

    The phone sends the wall-clock time between Record and Stop, which is not the length of the
    file: the encoder usually ends earlier. Each step still starts where its mark says and runs
    until the next one; the last runs to the end of the file, and nothing goes past it. No step
    is shorter than MIN_STEP_SECONDS (or the whole file, if that is shorter).
    """
    steps = sorted(route.steps, key=lambda step: step.position)
    floor = min(MIN_STEP_SECONDS, measured_seconds)
    for step, following in zip(steps, [*steps[1:], None], strict=False):
        step.start_seconds = min(step.start_seconds, measured_seconds)
        step.end_seconds = (
            measured_seconds if following is None
            else min(following.start_seconds, measured_seconds)
        )
        if step.end_seconds - step.start_seconds < floor:
            # A mark past the real end keeps a short clip at the tail; the end never moves.
            step.start_seconds = max(0.0, step.end_seconds - floor)
        step.photo_second = (step.start_seconds + step.end_seconds) / 2
    route.video_duration_seconds = measured_seconds
    route.guide.video_duration_seconds = sum(
        one.video_duration_seconds or 0.0 for one in route.guide.routes
    )


def route_of(guide: Guide, route_id: uuid.UUID) -> Route | None:
    return next((route for route in guide.routes if route.id == route_id), None)


def latest_route(guide: Guide) -> Route:
    """The route a video without a route named belongs to: the last one added.

    A guide older than routes has none yet; it gets one holding all its steps, so every guide can
    be handled the same way from here on.
    """
    if not guide.routes:
        route = Route(guide_id=guide.id, position=1, title=guide.title,
                      video_duration_seconds=guide.video_duration_seconds,
                      processing_status=guide.processing_status)
        guide.routes.append(route)
        route.steps = list(guide.steps)
    return guide.routes[-1]


def media_paths(guide: Guide) -> list[str]:
    """Every file this guide keeps in storage."""
    paths = []
    for step in guide.steps:
        paths += [path for path in (step.clip_path, step.photo_path, step.sound_path) if path]
    return paths


def delete(session: Session, guide: Guide) -> None:
    """Remove a guide with its routes and steps. The caller removes the files from storage first."""
    session.delete(guide)
    session.flush()


def _steps_from_marks(
    marks: Iterable[dict], video_duration_seconds: float, first_position: int = 1
) -> list[dict]:
    """Turn the marks into stretches of video: each step runs until the next mark."""
    marks = list(marks)
    if len(marks) < MIN_MARKS:
        raise ValueError("a route needs at least one mark")

    times = [mark["marked_at_seconds"] for mark in marks]
    if any(later <= earlier for earlier, later in zip(times, times[1:], strict=False)):
        raise ValueError("marks must move forward in time")
    if video_duration_seconds <= times[-1]:
        raise ValueError("the video ends before the last mark")

    ends = [*times[1:], video_duration_seconds]
    return [
        {
            "position": position,
            "title": mark["title"],
            "category": mark["category"],
            "start_seconds": mark["marked_at_seconds"],
            "end_seconds": end,
            # Clamped, because a step can be shorter than the pause itself.
            "photo_second": min(mark["marked_at_seconds"] + PAUSE_SECONDS / 2, end),
        }
        for position, (mark, end) in enumerate(zip(marks, ends, strict=False), start=first_position)
    ]


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
    statement = select(Guide).order_by(Guide.created_at.desc()).limit(limit).offset(offset)
    return list(session.scalars(statement))


def list_published(
    session: Session, *, limit: int = DEFAULT_PAGE_SIZE, offset: int = 0
) -> list[Guide]:
    """One page of the public catalogue: the guides a visitor is allowed to browse.

    Alphabetical by venue, not newest first. This is a catalogue somebody reads looking for a
    place they already have in mind, not a feed of what happened lately.

    A guide with no slug cannot be opened, so it stays out instead of becoming a card that leads
    nowhere. Nothing shortens that list but publishing, which always assigns one; the filter is
    here so one bad row cannot take the whole catalogue down with it.
    """
    statement = (
        select(Guide)
        .where(Guide.status == "published", Guide.public_slug.is_not(None))
        .order_by(Guide.venue_name, Guide.title)
        .limit(limit)
        .offset(offset)
    )
    return list(session.scalars(statement))


def pending_before_publishing(guide: Guide) -> dict:
    """What the panel shows as "3 de 5 pasos revisados" and "2 datos por completar"."""
    return {
        "steps_total": len(guide.steps),
        "steps_reviewed": sum(1 for step in guide.steps if step.reviewed),
        "missing_data": sum(1 for step in guide.steps if _data_is_missing(step)),
    }


def _data_is_missing(step: Step) -> bool:
    return bool(step.missing_fields) or not step.easy_read_text


def publish(session: Session, guide: Guide) -> Guide:
    """Approve a reviewed guide and open its public link.

    Refuses while any step is unreviewed or still has blanks: the panel keeps "Aprobar y publicar"
    disabled in that state, and the rule belongs here rather than in the button.
    """
    pending = pending_before_publishing(guide)
    if pending["missing_data"] or pending["steps_reviewed"] < pending["steps_total"]:
        raise ValueError("the guide is not ready to publish")

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


def update_step(
    session: Session, guide: Guide, step_id: uuid.UUID, changes: dict
) -> Step | None:
    """Apply the panel's edits to one step of this guide.

    Setting the noise level by hand marks it as "manual": the panel shows whether the value came
    from the measurement or from a person.
    """
    step = next((candidate for candidate in guide.steps if candidate.id == step_id), None)
    if step is None:
        return None

    if "noise_level" in changes:
        step.noise_level_source = "manual"
    for field, value in changes.items():
        setattr(step, field, value)
    session.flush()
    return step
