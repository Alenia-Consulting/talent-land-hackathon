"""Finding and blurring the faces in one frame.

Detection is the CenterFace model shipped with the `deface` package, run through OpenCV's dnn
module, so it needs nothing beyond cv2 and numpy. Only `deface.centerface` is imported: the rest of
the package is a command line tool with dependencies this API does not need.

Privacy is the point, so every choice here errs towards blurring too much:
  · a low score threshold: a blurred wall is harmless, a missed face is not (see SCORE_THRESHOLD)
  · the box is grown, to cover forehead, chin and ears, and a face that moves between frames
  · the boxes of the last few frames are blurred too, so one frame where the detector blinks does
    not show a face
  · the face is reduced to a handful of cells and scaled back up: the detail is thrown away, not
    just smeared, so it cannot be recovered the way a plain blur partly can
"""

from collections import deque
from collections.abc import Callable
from functools import lru_cache

import cv2
import numpy as np

# Frames are at most 720 on the short side, so 1280 means "do not downscale". Measured on a phone
# recording with people at a distance: detecting at 0.89x (the old 640 px) left 14% of the faces
# uncovered, at 1.0x only 1.5% for 20% more time, at 1.5x none but 2.7x the time.
DETECTION_WIDTH = 1280
# Measured on a real 10 s phone recording with several people (3 faces per frame on average): at 0.3
# a turned head with a hand over the face and a profile cut by the edge of the frame were missed;
# at 0.15 both are covered and the blurred area only grows from 9.2% to 10.8% of the frame (the
# extra boxes are lights and textures). Profiles and motion blur are what a frontal detector loses.
SCORE_THRESHOLD = 0.15
BOX_GROWTH = 1.5
# Detection runs on EVERY frame. It is most of the cost, but skipping frames was measured on a real
# recording: detecting every 2nd frame left 7% of the faces uncovered in some frame, every 3rd 12%.
# Speed is bought with CPU, not by looking less.
HOLD_FRAMES = 4
PIXELS_ACROSS = 8  # cells left across the longest side of a face

Box = tuple[int, int, int, int]
Detector = Callable[..., tuple[np.ndarray, np.ndarray]]


@lru_cache(maxsize=1)
def _default_detector() -> Detector:
    from deface.centerface import CenterFace

    return CenterFace(backend="opencv")


def find_faces(frame: np.ndarray, detect: Detector | None = None) -> list[Box]:
    """Boxes (x1, y1, x2, y2, in frame pixels) of the faces in a BGR frame."""
    detect = detect or _default_detector()
    height, width = frame.shape[:2]
    scale = min(1.0, DETECTION_WIDTH / width)
    small = cv2.resize(frame, (round(width * scale), round(height * scale))) if scale < 1 else frame
    # CenterFace wants RGB.
    detections, _ = detect(np.ascontiguousarray(small[:, :, ::-1]), threshold=SCORE_THRESHOLD)
    return [tuple(int(value / scale) for value in det[:4]) for det in detections]


def _grow(box: Box, shape: tuple[int, ...]) -> Box:
    x1, y1, x2, y2 = box
    half_w, half_h = (x2 - x1) * BOX_GROWTH / 2, (y2 - y1) * BOX_GROWTH / 2
    cx, cy = (x1 + x2) / 2, (y1 + y2) / 2
    return (
        max(0, int(cx - half_w)),
        max(0, int(cy - half_h)),
        min(shape[1], int(cx + half_w)),
        min(shape[0], int(cy + half_h)),
    )


@lru_cache(maxsize=32)
def _soft_ellipse(width: int, height: int) -> np.ndarray:
    """Alpha (height, width, 1) of an ellipse with a soft edge. Faces keep their size from frame to
    frame, so the same mask is reused instead of being drawn and blurred every time."""
    mask = np.zeros((height, width), np.uint8)
    cv2.ellipse(mask, (width // 2, height // 2), (width // 2, height // 2), 0, 0, 360, 255, -1)
    sigma = max(1.0, max(width, height) / (PIXELS_ACROSS * 2))
    return (cv2.GaussianBlur(mask, (0, 0), sigmaX=sigma).astype(np.float32) / 255.0)[:, :, None]


def _overlap(a: Box, b: Box) -> bool:
    return a[0] < b[2] and b[0] < a[2] and a[1] < b[3] and b[1] < a[3]


def merge_overlapping(boxes: list[Box]) -> list[Box]:
    """One box for each group of overlapping ones. The same face seen in the last few frames would
    otherwise be blurred over and over, which is what makes this step slow."""
    merged = list(boxes)
    changed = True
    while changed:
        changed = False
        for i, first in enumerate(merged):
            for j in range(i + 1, len(merged)):
                if _overlap(first, merged[j]):
                    other = merged.pop(j)
                    merged[i] = (min(first[0], other[0]), min(first[1], other[1]),
                                 max(first[2], other[2]), max(first[3], other[3]))  # fmt: skip
                    changed = True
                    break
            if changed:
                break
    return merged


def blur_faces(frame: np.ndarray, boxes: list[Box]) -> None:
    """Blur each box in place, inside an ellipse with a soft edge."""
    for box in merge_overlapping(boxes):
        x1, y1, x2, y2 = _grow(box, frame.shape)
        region = frame[y1:y2, x1:x2]
        height, width = region.shape[:2]
        if height < 2 or width < 2:
            continue
        cells = max(1, PIXELS_ACROSS * min(width, height) // max(width, height))
        small = cv2.resize(region, (max(1, PIXELS_ACROSS if width >= height else cells),
                                    max(1, PIXELS_ACROSS if height > width else cells)),
                           interpolation=cv2.INTER_AREA)  # fmt: skip
        blurred = cv2.resize(small, (width, height), interpolation=cv2.INTER_LINEAR)
        alpha = _soft_ellipse(width, height)
        region[:] = (blurred * alpha + region * (1 - alpha)).astype(np.uint8)


class FaceBlurrer:
    """Blurs the faces of consecutive frames of ONE clip. Make a new one for every clip."""

    def __init__(self, detect: Detector | None = None) -> None:
        self._detect = detect
        self._recent: deque[list[Box]] = deque(maxlen=HOLD_FRAMES)

    def __call__(self, frame: np.ndarray) -> int:
        """Blur the frame in place and answer how many boxes were blurred."""
        self._recent.append(find_faces(frame, self._detect))
        boxes = [box for found in self._recent for box in found]
        blur_faces(frame, boxes)
        return len(boxes)
