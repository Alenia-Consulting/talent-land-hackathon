"""A real face, as a video: skimage ships a photo of an astronaut, which the detector recognises."""

import pathlib
import subprocess

import cv2
import numpy as np
from skimage import data

from media import video_io


def face_frame(width: int = 640, height: int = 360) -> np.ndarray:
    """One BGR frame with a single, clearly visible face."""
    frame = cv2.cvtColor(data.astronaut(), cv2.COLOR_RGB2BGR)
    return cv2.resize(frame, (width, height), interpolation=cv2.INTER_AREA)


def make_video(
    path: pathlib.Path, *, seconds: int = 4, size: tuple[int, int] = (640, 360), rotate: bool = False
) -> pathlib.Path:
    """An mp4 of that face standing still. `rotate` stores a 90 degree rotation, like a phone does."""
    still = path.with_suffix(".png")
    cv2.imwrite(str(still), face_frame(*size))
    straight = path if not rotate else path.with_name(path.stem + "-straight.mp4")
    ffmpeg = video_io.ffmpeg_exe()
    subprocess.run(
        [ffmpeg, "-y", "-loglevel", "error", "-loop", "1", "-i", str(still), "-t", str(seconds),
         "-r", "15", "-pix_fmt", "yuv420p", "-c:v", "libx264", str(straight)],
        check=True,
    )  # fmt: skip
    if rotate:
        subprocess.run(
            [ffmpeg, "-y", "-loglevel", "error", "-display_rotation", "90", "-i", str(straight),
             "-c", "copy", str(path)],
            check=True,
        )  # fmt: skip
    return path
