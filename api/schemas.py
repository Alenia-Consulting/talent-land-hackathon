"""Request and response models.

FastAPI builds contracts/openapi.json from these classes, and client/lib/api-types.ts is
generated from that file; contracts/README.md explains the chain. The only difference with the
database is the step index: the contract calls it `order`, the column is `position`, because
ORDER is a reserved SQL word.
"""

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from db.models import MAX_POINTS, NOISE_LEVELS, POINT_KINDS, STEP_CATEGORIES, STEP_INTERESTS
from media import storage

Category = Literal[STEP_CATEGORIES]
NoiseLevel = Literal[NOISE_LEVELS]
Interest = Literal[STEP_INTERESTS]
PointKind = Literal[POINT_KINDS]


class PointOfInterest(BaseModel):
    """Something on the step's photo worth pointing at, to help a visitor find their way."""

    label: str = Field(min_length=1, max_length=60,
                       description="Two to four words, shown next to the arrow: 'Entrada de cristal'.")
    description: str = Field(
        min_length=1, max_length=160,
        description="One or two short sentences read aloud by the device: 'Busca las puertas de "
                    "cristal. Cruza por la abertura para entrar.'")
    kind: PointKind
    box_2d: list[int] = Field(
        min_length=4, max_length=4,
        description="[ymin, xmin, ymax, xmax], each from 0 to 1000 of the photo's height or "
                    "width. Relative, so it fits any screen size.")

    @field_validator("box_2d")
    @classmethod
    def _box_is_inside_the_photo(cls, box: list[int]) -> list[int]:
        ymin, xmin, ymax, xmax = box
        if not all(0 <= value <= 1000 for value in box) or ymin >= ymax or xmin >= xmax:
            raise ValueError("box_2d must be [ymin, xmin, ymax, xmax] from 0 to 1000, min < max")
        return box


class MarkIn(BaseModel):
    """One part of the route, marked by the person while recording ("Llegue a: Recepcion")."""

    title: str = Field(min_length=1, max_length=60,
                       description="The name the person gave this part, e.g. 'Recepcion'.")
    category: Category = Field(description="Drives the visitor filters and the pictogram.")
    marked_at_seconds: float = Field(ge=0,
                                     description="Second of the video when 'Llegue a: X' was tapped.")


class GuideCreate(BaseModel):
    title: str = Field(min_length=1, max_length=120,
                       description="Name of this guide: 'Recorrido principal', 'Sala de rayos X'.")
    venue_name: str = Field(min_length=1, max_length=200)
    video_duration_seconds: float = Field(gt=0)
    marks: list[MarkIn] = Field(
        min_length=1, max_length=12,
        description="One per part reached, in order. Must move forward in time and all fall "
                    "before video_duration_seconds. Each mark becomes a step running to the next.",
    )
    route_title: str | None = Field(
        default=None, min_length=1, max_length=120,
        description="Name of the first recording, the part it covers: 'Entrada'. Defaults to title.",
    )
    language: str = Field(default="es", max_length=10)


class RouteCreate(BaseModel):
    """Another recording of a guide that already exists."""

    title: str = Field(min_length=1, max_length=120,
                       description="Name of this recording: 'Entrada principal', 'Sala de rayos X'.")
    video_duration_seconds: float = Field(gt=0)
    position: int | None = Field(
        default=None, ge=1,
        description="Place among the guide's routes, 1-based. Omitted: it goes last. The routes "
                    "from there on move down and the steps are renumbered.",
    )
    marks: list[MarkIn] = Field(
        min_length=1, max_length=12,
        description="Same rules as when creating a guide. The steps continue the guide's numbering.",
    )


class RouteOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    order: int = Field(validation_alias="position", description="1-based position among the guide's routes.")
    title: str
    video_duration_seconds: float | None
    processing_status: str = Field(
        description="pending | processing | done | failed: where this recording is.")
    ai_usage: dict | None = Field(
        description="Tokens Gemini billed for this video: calls, prompt, output, thinking, total "
        "and the prompt split by video/image/text. Null when it was not processed with Gemini.")


class StepPatch(BaseModel):
    """The review panel's edits. Only the fields sent are changed."""

    model_config = ConfigDict(extra="forbid")

    title: str | None = Field(default=None, min_length=1, max_length=60)
    start_seconds: float | None = Field(default=None, ge=0)
    end_seconds: float | None = Field(default=None, ge=0)
    photo_second: float | None = Field(default=None, ge=0)
    easy_read_text: str | None = Field(default=None, max_length=300)
    what_to_expect: list[str] | None = None
    who_to_ask_for_help: str | None = None
    duration_text: str | None = Field(default=None, max_length=80)
    interests: list[Interest] | None = None
    points_of_interest: list[PointOfInterest] | None = Field(default=None, max_length=MAX_POINTS)
    noise_level: NoiseLevel | None = None
    missing_fields: list[str] | None = None
    reviewed: bool | None = None


class StepOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    order: int = Field(validation_alias="position",
                       description="1-based position. Stored as `position`: ORDER is reserved in SQL.")
    route_id: uuid.UUID | None = Field(
        description="The recording this step was cut from. Null only on steps older than routes.")
    title: str
    start_seconds: float = Field(description="The mark. Adjustable from the review panel.")
    end_seconds: float = Field(description="The next mark, or the end of the video.")
    photo_second: float = Field(description="Middle of the 3 second pause taken on arrival.")
    easy_read_text: str | None = Field(
        description="Written by Gemini from the clip, then reviewed. Null until it exists: "
                    "nothing is invented.",
    )
    what_to_expect: list[str] = Field(
        description="Short warnings, e.g. 'Suena un pitido cuando llaman'.")
    who_to_ask_for_help: str | None = Field(
        description="Null when the video does not show it, so the venue fills it in.")
    duration_text: str | None = Field(
        description="How long this part takes, in easy-read words: 'Unos 10 minutos'.")
    category: str
    interests: list[str] = Field(
        description="Which of the visitor's \"Que quieres ver antes?\" filters this step answers.")
    points_of_interest: list[PointOfInterest] = Field(
        description="Up to 3 things to point at on `photo_url`, drawn by the front over the clip "
                    "paused at `photo_second`. Drafted by the AI, corrected by the venue.")
    missing_fields: list[str] = Field(
        description="Blanks the venue must still fill in. Publishing is refused while any "
                    "step has one.",
    )
    reviewed: bool = Field(description="Whether a person already checked this step.")
    clip_url: str | None = Field(
        validation_alias="clip_path",
        description="Trimmed, face-blurred clip. No audio track.")
    photo_url: str | None = Field(
        validation_alias="photo_path",
        description="Face-blurred still frame of this part.")
    sound_available: bool = Field(
        description="Whether the low-pass filtered ambience exists. It never plays on its own.")
    sound_url: str | None = Field(
        validation_alias="sound_path",
        description="The ambience of this part, low-pass filtered so voices cannot be understood. "
                    "Null when the recording had no usable audio. It never plays on its own.")
    noise_level: str | None = Field(
        description="Relative to the rest of the video, never decibels: the phone mic is not "
                    "calibrated. Null until measured.",
    )
    noise_level_source: str | None = Field(
        description="'measured' by the pipeline, or 'manual' when the venue corrected it.")
    pictogram_url: str | None = Field(description="ARASAAC pictogram (CC BY-NC-SA).")


    @field_validator("clip_url", "photo_url", "sound_url", mode="after")
    @classmethod
    def _as_public_url(cls, path: str | None) -> str | None:
        return storage.public_url(path)


class Pending(BaseModel):
    """Drives "3 de 5 pasos revisados" and "2 datos por completar" in the panel."""

    steps_total: int
    steps_reviewed: int
    missing_data: int


class GuideSummary(BaseModel):
    """What a list endpoint returns: no steps, so a listing stays small."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    venue_name: str
    status: str = Field(
        description="draft | needs_review | published. Only a human moves it to published.")
    language: str
    processing_status: str = Field(
        description="pending | processing | done | failed: where the recording is. A failed one "
                    "can be sent again.")
    public_slug: str | None = Field(
        description="Segment of the public URL. Null until the guide is published.")
    qr_url: str | None
    reviewed_at: datetime | None = Field(
        description="Last human review. The public guide always shows this date.")
    video_duration_seconds: float | None = Field(description="Length of the recording.")
    walking_minutes: int | None = Field(description="How long the whole route takes on foot.")
    cover_photo_url: str | None
    created_at: datetime
    updated_at: datetime


class PublicGuideSummary(BaseModel):
    """One line of the public catalogue: what somebody looking for a place needs to recognise it.

    Deliberately narrower than GuideSummary. A visitor has nothing to do with `id`, `status` or
    `processing_status`: those belong to the panel, and a catalogue that carried them would tell
    anyone who asked how each venue's work is going.
    """

    model_config = ConfigDict(from_attributes=True)

    title: str
    venue_name: str
    public_slug: str = Field(description="Segment of the public URL, as in /g?slug=...")
    cover_photo_url: str | None
    walking_minutes: int | None = Field(description="How long the whole route takes on foot.")
    reviewed_at: datetime | None = Field(
        description="Last human review. The public guide always shows this date.")
    language: str


class GuideOut(GuideSummary):
    routes: list[RouteOut] = Field(description="The guide's recordings, in order.")
    steps: list[StepOut]
    pending: Pending | None = Field(
        default=None,
        description="Review panel only. The public guide leaves it out.",
    )
