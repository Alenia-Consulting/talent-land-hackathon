"""Guide endpoints.

Mounted under root_path="/api", so these routes are served as /api/guides and /api/public/{slug}.

Routes never touch the ORM: every read and write goes through db.guides.
"""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from db import guides
from db.models import Guide
from db.session import get_session
from schemas import GuideCreate, GuideOut, GuideSummary, Pending, StepPatch

router = APIRouter(tags=["guides"])

# Same text whether the guide does not exist or is still a draft: a visitor who guesses a slug
# learns nothing about work in progress.
NOT_FOUND = "guide not found"


def _with_pending(guide: Guide) -> GuideOut:
    """The panel's view of a guide: the route plus what is still missing before publishing."""
    detail = GuideOut.model_validate(guide)
    detail.pending = Pending(**guides.pending_before_publishing(guide))
    return detail


def _load(session: Session, guide_id: uuid.UUID) -> Guide:
    guide = guides.get(session, guide_id)
    if guide is None:
        raise HTTPException(status_code=404, detail=NOT_FOUND)
    return guide


@router.post("/guides", status_code=201, response_model=GuideOut)
def create_guide(payload: GuideCreate, session: Session = Depends(get_session)) -> GuideOut:
    """Create a guide from the parts the person marked while recording.

    The steps arrive without text: Gemini writes it afterwards and a person reviews it. Nothing is
    published here.
    """
    try:
        guide = guides.create(
            session,
            title=payload.title,
            venue_name=payload.venue_name,
            marks=[mark.model_dump() for mark in payload.marks],
            video_duration_seconds=payload.video_duration_seconds,
            language=payload.language,
        )
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    session.commit()
    return _with_pending(guide)


@router.get("/guides", response_model=list[GuideSummary])
def list_guides(
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    session: Session = Depends(get_session),
) -> list[GuideSummary]:
    """One page of guides for the review panel, most recent first."""
    return guides.list_guides(session, limit=limit, offset=offset)


@router.get("/guides/{guide_id}", response_model=GuideOut)
def read_guide(guide_id: uuid.UUID, session: Session = Depends(get_session)) -> GuideOut:
    """Read any guide, drafts included. For the review panel, not for visitors."""
    return _with_pending(_load(session, guide_id))


@router.patch("/guides/{guide_id}/steps/{step_id}", response_model=GuideOut)
def update_step(
    guide_id: uuid.UUID,
    step_id: uuid.UUID,
    payload: StepPatch,
    session: Session = Depends(get_session),
) -> GuideOut:
    """Apply the venue's corrections to one step."""
    guide = _load(session, guide_id)
    changes = payload.model_dump(exclude_unset=True)
    if guides.update_step(session, guide, step_id, changes) is None:
        raise HTTPException(status_code=404, detail="step not found")
    session.commit()
    return _with_pending(guide)


@router.post("/guides/{guide_id}/publish", response_model=GuideOut)
def publish_guide(guide_id: uuid.UUID, session: Session = Depends(get_session)) -> GuideOut:
    """Approve a reviewed guide and open its public link."""
    guide = _load(session, guide_id)
    try:
        guides.publish(session, guide)
    except ValueError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error
    session.commit()
    return _with_pending(guide)


@router.get("/public/{slug}", response_model=GuideOut)
def read_public_guide(slug: str, session: Session = Depends(get_session)) -> GuideOut:
    """The guide a visitor opens from the link or the QR code. Published guides only."""
    guide = guides.get_published(session, slug)
    if guide is None:
        raise HTTPException(status_code=404, detail=NOT_FOUND)
    return GuideOut.model_validate(guide)
