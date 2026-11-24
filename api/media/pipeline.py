"""Turning one recording into the media of a guide.

NOT IMPLEMENTED YET. `process()` refuses every call, which is what keeps recognisable faces out
of the bucket while this is a hole. Fill it in; do not route around it.

What it has to do, per step, using the seconds the marks already produced:

  1. Trim the clip        ffmpeg, from `start_seconds` to `end_seconds`, dropping the audio track.
  2. Blur the faces       Read the clip frame by frame, detect faces (MediaPipe) and apply a
                          gaussian blur to each (OpenCV). Do the same to the still frame taken at
                          `photo_second`. Work at 720p/15 fps so it finishes in minutes, not hours.
  3. Ambience             Extract the audio of the stretch, run it through a low-pass filter
                          (~500-800 Hz) so no voice stays intelligible, and measure RMS to get a
                          noise level relative to the rest of the video.
  4. Answer               One ProcessedStep per step, with the bytes ready to upload.

Two product rules constrain this and are not negotiable:

  · Faces are blurred in both the clip and the still, and the original recording is deleted after
    processing. The caller does the deleting; this module must not leave copies behind.
  · The noise level is relative (`quiet` / `medium` / `noisy`), never decibels, because a phone
    microphone is not calibrated. Do not normalise the gain clip by clip: use the same gain for
    the whole video, or a quiet room will sound like a busy one.
"""

import pathlib
from collections.abc import Sequence
from dataclasses import dataclass


class ProcessingUnavailable(RuntimeError):
    """Raised while the media pipeline is not implemented."""


@dataclass(frozen=True)
class StepTiming:
    """Where a step sits in the recording. Comes straight from the marks."""

    position: int
    start_seconds: float
    end_seconds: float
    photo_second: float


@dataclass(frozen=True)
class ProcessedStep:
    """What one step looks like once the video has been cut and cleaned."""

    position: int
    clip: bytes
    photo: bytes
    sound: bytes | None
    noise_level: str | None


def process(video: pathlib.Path, steps: Sequence[StepTiming]) -> list[ProcessedStep]:
    """Cut, blur and measure one recording.

    Raises ProcessingUnavailable until the blurring exists, so a recording with recognisable
    faces can never be uploaded by accident.
    """
    raise ProcessingUnavailable(
        "el procesado de vídeo todavía no está disponible: falta difuminar las caras, "
        "y sin eso el vídeo no puede guardarse"
    )
