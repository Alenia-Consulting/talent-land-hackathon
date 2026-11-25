"""Guide endpoints.

Mounted under root_path="/api", so these routes are served as /api/guides and /api/public/{slug}.

Routes never touch the ORM: every read and write goes through db.guides.
"""

import pathlib
import tempfile
import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from sqlalchemy.orm import Session

from db import guides
from db.models import Guide
from db.session import get_session
from ai import gemini
from media import pipeline, storage
from schemas import GuideCreate, GuideOut, GuideSummary, Pending, StepPatch

router = APIRouter(tags=["guides"])

# Same text whether the guide does not exist or is still a draft: a visitor who guesses a slug
# learns nothing about work in progress.
NOT_FOUND = "guide not found"

# Supabase Storage refuses files over 50 MB, and two minutes at 2.5 Mbps is roughly 37 MB. The
# recorder checks the same limit (RECORDING.maxUploadBytes in client/lib/config.ts).
MAX_VIDEO_BYTES = 50 * 1024 * 1024
UPLOAD_DIR = pathlib.Path(tempfile.gettempdir()) / "antesala-uploads"
CHUNK_BYTES = 1024 * 1024


def _save_upload(video: UploadFile, target: pathlib.Path) -> None:
    """Stream the upload to disk, refusing it as soon as it goes over the limit.

    Read in chunks rather than all at once: a single large upload should not be able to exhaust
    the memory of the Pod.
    """
    written = 0
    with target.open("wb") as handle:
        while chunk := video.file.read(CHUNK_BYTES):
            written += len(chunk)
            if written > MAX_VIDEO_BYTES:
                raise HTTPException(
                    status_code=413,
                    detail=f"el vídeo supera el límite de {MAX_VIDEO_BYTES // (1024 * 1024)} MB",
                )
            handle.write(chunk)


def _with_pending(guide: Guide) -> GuideOut:
    """The panel's view of a guide: the route plus what is still missing before publishing."""
    detail = GuideOut.model_validate(guide)
    detail.pending = Pending(**guides.pending_before_publishing(guide))
    return detail


def _write_texts(by_position: dict, processed: list[pipeline.ProcessedStep]) -> None:
    """Gemini drafts the text of each step from its blurred clip.

    A step Gemini cannot describe keeps its text empty, which already blocks publishing until
    the venue writes it: the media is what matters here, so this never fails the upload.
    """
    requests = [
        gemini.StepRequest(
            position=item.position,
            title=by_position[item.position].title,
            category=by_position[item.position].category,
            clip=item.clip,
            photo=item.photo,
        )
        for item in processed
        if item.position in by_position
    ]
    for position, text in gemini.describe_steps(requests).items():
        if text is None:
            continue
        step = by_position[position]
        step.easy_read_text = text.easy_read_text
        step.what_to_expect = text.what_to_expect
        step.who_to_ask_for_help = text.who_to_ask_for_help
        step.duration_text = text.duration_text
        step.interests = text.interests
        step.points_of_interest = text.points_of_interest
        step.missing_fields = text.missing_fields
        step.ai_draft = {
            "model": gemini.model_name(),
            "generated_at": datetime.now(UTC).isoformat(),
            **text.as_draft(),
        }


def _set_processing_status(session: Session, guide: Guide, status: str) -> None:
    """Save where the recording is, dropping whatever half-done work is still pending."""
    session.rollback()
    guide.processing_status = status
    session.commit()


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


@router.post("/guides/{guide_id}/video", response_model=GuideOut)
def upload_video(
    guide_id: uuid.UUID,
    video: UploadFile = File(description="The recording, as taken by the phone."),
    session: Session = Depends(get_session),
) -> GuideOut:
    """Receive the recording, blur the faces and store only the processed media.

    The original never reaches storage and is deleted from this server either way: it shows the
    faces of patients and staff who did not agree to be filmed. Answers 503 while the blurring is
    not implemented, rather than storing a recording nobody has cleaned.
    """
    guide = _load(session, guide_id)

    if not (video.content_type or "").startswith("video/"):
        raise HTTPException(status_code=415, detail="el fichero debe ser un vídeo")
    if guide.processing_status == "processing":
        raise HTTPException(status_code=409, detail="este vídeo ya se está procesando")

    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    target = UPLOAD_DIR / f"{guide_id}-{uuid.uuid4().hex}"
    try:
        _save_upload(video, target)
        _set_processing_status(session, guide, "processing")

        timings = [
            pipeline.StepTiming(
                position=step.position,
                start_seconds=step.start_seconds,
                end_seconds=step.end_seconds,
                photo_second=step.photo_second,
            )
            for step in guide.steps
        ]
        processed = pipeline.process(target, timings)

        config = storage.config_from_env()
        by_position = {step.position: step for step in guide.steps}
        for item in processed:
            step = by_position.get(item.position)
            if step is None:
                continue
            # Always the id: the slug only exists once published, and the path must not move then.
            base = f"{guide.id}/paso-{item.position}"
            step.clip_path = storage.upload(config, f"{base}.mp4", item.clip, "video/mp4")
            step.photo_path = storage.upload(config, f"{base}.jpg", item.photo, "image/jpeg")
            if item.sound is not None:
                step.sound_path = storage.upload(config, f"{base}.mp3", item.sound, "audio/mpeg")
                step.sound_available = True
            if item.noise_level is not None:
                step.noise_level = item.noise_level
                step.noise_level_source = "measured"
        _write_texts(by_position, processed)
        guide.processing_status = "done"
        session.commit()
    except pipeline.ProcessingUnavailable as error:
        # Nothing was tried, so the guide goes back to waiting for a recording.
        _set_processing_status(session, guide, "pending")
        raise HTTPException(status_code=503, detail=str(error)) from error
    except pipeline.ProcessingFailed as error:
        _set_processing_status(session, guide, "failed")
        raise HTTPException(status_code=422, detail=str(error)) from error
    except storage.StorageError as error:
        _set_processing_status(session, guide, "failed")
        raise HTTPException(status_code=502, detail=str(error)) from error
    finally:
        # The recording never stays on the server, whatever happened above.
        target.unlink(missing_ok=True)

    return _with_pending(guide)
