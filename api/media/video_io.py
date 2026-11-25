"""Reading and writing video through ffmpeg.

The ffmpeg binary comes inside the `imageio-ffmpeg` wheel, so the image needs no system package.
Frames travel through pipes as raw BGR: one process decodes, this module hands the frames to the
caller, and a second process encodes whatever the caller writes back.

ffmpeg applies the rotation stored by phones, so a video recorded in portrait comes out upright
and the sizes below are already the rotated ones.
"""

import pathlib
import re
import subprocess
from collections.abc import Iterator
from contextlib import contextmanager

import numpy as np

from media.errors import ProcessingFailed, ProcessingUnavailable

FPS = 24
MAX_SHORT_SIDE = 720

Size = tuple[int, int]


def ffmpeg_exe() -> str:
    try:
        import imageio_ffmpeg

        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception as error:  # the wheel has no binary for this platform
        raise ProcessingUnavailable("ffmpeg no está disponible en este servidor") from error


def target_size(video: pathlib.Path) -> Size:
    """The size frames are processed at: the video's own, capped at 720p on the short side."""
    import imageio_ffmpeg

    try:
        reader = imageio_ffmpeg.read_frames(str(video), pix_fmt="bgr24")
        try:
            width, height = next(reader)["size"]
        finally:
            reader.close()
    except Exception as error:
        raise ProcessingFailed("no se pudo leer el vídeo") from error

    scale = min(1.0, MAX_SHORT_SIDE / min(width, height))
    # Even sizes: H.264 with yuv420p cannot encode odd ones.
    return (round(width * scale) // 2 * 2, round(height * scale) // 2 * 2)


def duration(video: pathlib.Path) -> float | None:
    """How long the file really is, in seconds, or None when ffmpeg cannot tell.

    Decodes the whole video to nowhere and reads the last timestamp, because a phone recording
    often has no duration in its header. Slow, so only used to explain a failure: the recorder
    measures its own clock, and when the file turns out shorter the steps run past its end.
    """
    try:
        result = subprocess.run(
            [ffmpeg_exe(), "-nostdin", "-i", str(video), "-f", "null", "-"],
            capture_output=True, text=True, timeout=120,
        )
    except (OSError, subprocess.TimeoutExpired):
        return None
    times = re.findall(r"time=(\d+):(\d+):(\d+(?:\.\d+)?)", result.stderr)
    if not times:
        return None
    hours, minutes, seconds = times[-1]
    return int(hours) * 3600 + int(minutes) * 60 + float(seconds)


def read_frames(
    video: pathlib.Path, size: Size, start: float, duration: float | None = None
) -> Iterator[np.ndarray]:
    """Writable BGR frames of [start, start + duration), at FPS, scaled to `size`, no audio.

    Jumps to `start` without decoding what comes before, which is fast. A recording straight from
    a browser has no index to jump with, and on some of them the jump lands past the data and
    yields nothing; then the video is decoded from its beginning instead, slower but exact.
    """
    produced = False
    for jump in (True, False):
        for frame in _decode(video, size, start, duration, jump=jump):
            produced = True
            yield frame
        if produced or start <= 0:
            return


def _decode(
    video: pathlib.Path, size: Size, start: float, duration: float | None, *, jump: bool
) -> Iterator[np.ndarray]:
    width, height = size
    # -ss before -i jumps; after it, ffmpeg decodes and discards up to that point.
    seek = ["-ss", f"{start:.3f}"]
    command = [ffmpeg_exe(), "-loglevel", "error", *(seek if jump else []), "-i", str(video)]
    if not jump:
        command += seek
    if duration is not None:
        command += ["-t", f"{duration:.3f}"]
    command += ["-an", "-vf", f"fps={FPS},scale={width}:{height}", "-pix_fmt", "bgr24", "-f", "rawvideo", "-"]

    process = subprocess.Popen(command, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
    frame_bytes = width * height * 3
    try:
        while len(buffer := process.stdout.read(frame_bytes)) == frame_bytes:
            yield np.frombuffer(buffer, np.uint8).reshape(height, width, 3).copy()
    finally:
        process.stdout.close()
        process.kill()
        process.wait()


@contextmanager
def clip_writer(path: pathlib.Path, size: Size):
    """Yield `write(frame)`; on exit the H.264 file is complete at `path` (no audio, faststart)."""
    width, height = size
    command = [
        ffmpeg_exe(), "-y", "-loglevel", "error",
        "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{width}x{height}", "-r", str(FPS), "-i", "-",
        "-an", "-c:v", "libx264", "-preset", "veryfast", "-crf", "28",
        "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(path),
    ]  # fmt: skip
    process = subprocess.Popen(command, stdin=subprocess.PIPE, stderr=subprocess.DEVNULL)

    def write(frame: np.ndarray) -> None:
        try:
            process.stdin.write(frame.tobytes())
        except BrokenPipeError as error:
            raise ProcessingFailed("ffmpeg dejó de aceptar imágenes") from error

    try:
        yield write
    except BaseException:
        process.kill()
        process.wait()
        raise
    process.stdin.close()
    if process.wait() != 0:
        raise ProcessingFailed("no se pudo codificar el clip")
