"""Turning one recording into the media of a guide.

For every step, using the seconds the marks already produced:

  1. Trim the clip        from `start_seconds` to `end_seconds`, no audio track, 15 fps, at most
                          720p on the short side.
  2. Blur the faces       every frame goes through media.faces. The still frame at `photo_second`
                          is one of those already-blurred frames, never a second, unblurred read.
  3. Answer               One ProcessedStep per step, with the bytes ready to upload.

NOT DONE YET, and answered as "not there" rather than invented: the ambience. `sound` and
`noise_level` stay None. When it is added, two product rules apply: the audio goes through a
low-pass filter (~500-800 Hz) so no voice stays intelligible, and the noise level is relative
(`quiet` / `medium` / `noisy`), never decibels, with the same gain for the whole video.

Two product rules constrain this module and are not negotiable:

  · Faces are blurred in both the clip and the still, and the original recording is deleted after
    processing. The caller does the deleting; this module leaves no copies: its temporary
    directory goes away before it returns.
  · If anything fails, nothing is returned: no half-blurred clip ever reaches storage.
"""

import pathlib
import tempfile
import threading
from collections.abc import Sequence
from dataclasses import dataclass, replace

import cv2

from media import audio, video_io
from media.errors import ProcessingFailed, ProcessingUnavailable
from media.faces import FaceBlurrer

__all__ = ["ProcessedStep", "ProcessingFailed", "ProcessingUnavailable", "StepTiming", "process"]

JPEG_QUALITY = 85

# The face detector is a single OpenCV network, which is not safe to share between threads, and one
# recording already uses a whole core: processing happens one recording at a time.
_processing = threading.Lock()


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
    """Cut and blur one recording.

    Raises ProcessingFailed when the recording cannot be read or a step has no image, and
    ProcessingUnavailable when ffmpeg or the detector is missing.
    """
    with _processing, tempfile.TemporaryDirectory() as workdir:
        size = video_io.target_size(video)
        processed = [_process_step(video, size, step, pathlib.Path(workdir)) for step in steps]
        # The level of a place only means something next to the others of the same recording.
        levels = audio.classify(
            {step.position: audio.mean_power(video, step.start_seconds, step.end_seconds) for step in steps}
        )
        return [replace(item, noise_level=levels[item.position]) for item in processed]


def _process_step(video: pathlib.Path, size: video_io.Size, step: StepTiming, workdir: pathlib.Path) -> ProcessedStep:
    clip_path = workdir / f"paso-{step.position}.mp4"
    # A new blurrer per clip: faces seen at the end of one step say nothing about the next.
    blur = FaceBlurrer()
    photo_index = max(0, round((step.photo_second - step.start_seconds) * video_io.FPS))
    photo_frame = None

    with video_io.clip_writer(clip_path, size) as write:
        frames = video_io.read_frames(video, size, step.start_seconds, step.end_seconds - step.start_seconds)
        for index, frame in enumerate(frames):
            blur(frame)
            write(frame)
            # The frame at photo_second, or the last one when the clip ends before it.
            if photo_frame is None or index <= photo_index:
                photo_frame = frame

    if photo_frame is None:
        real = video_io.duration(video)
        detail = (
            f": empieza en {step.start_seconds:.1f} s y el vídeo dura {real:.1f} s"
            if real is not None
            else ""
        )
        raise ProcessingFailed(f"el paso {step.position} no tiene imagen en el vídeo{detail}")
    encoded, jpeg = cv2.imencode(".jpg", photo_frame, [cv2.IMWRITE_JPEG_QUALITY, JPEG_QUALITY])
    if not encoded:
        raise ProcessingFailed(f"no se pudo guardar la foto del paso {step.position}")

    return ProcessedStep(
        position=step.position,
        clip=clip_path.read_bytes(),
        photo=jpeg.tobytes(),
        sound=audio.sound_for_listening(video, step.start_seconds, step.end_seconds),
        noise_level=None,
    )
