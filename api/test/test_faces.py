"""The blurring itself: a face that was found must not be findable afterwards."""

import numpy as np

from media import faces
from media_fixtures import face_frame


def test_a_real_face_is_found():
    boxes = faces.find_faces(face_frame())

    assert len(boxes) >= 1
    x1, y1, x2, y2 = boxes[0]
    assert x2 > x1 and y2 > y1


def best_score(frame) -> float:
    """The detector's most confident face, however unsure it is (threshold almost zero)."""
    detections, _ = faces._default_detector()(np.ascontiguousarray(frame[:, :, ::-1]), threshold=0.01)
    return max((float(det[4]) for det in detections), default=0.0)


def test_after_blurring_the_detector_finds_no_face():
    frame = face_frame()
    before = best_score(frame)

    faces.FaceBlurrer()(frame)

    assert faces.find_faces(frame) == []
    # Not just under the threshold by a hair: the confidence collapses from ~0.9 to noise.
    assert before > 0.8
    assert best_score(frame) < 0.15


def test_blurring_changes_the_face_and_leaves_the_rest_alone():
    frame = face_frame()
    original = frame.copy()
    (x1, y1, x2, y2), *_ = faces.find_faces(frame)

    faces.blur_faces(frame, [(x1, y1, x2, y2)])

    centre = (slice((y1 + y2) // 2 - 5, (y1 + y2) // 2 + 5), slice((x1 + x2) // 2 - 5, (x1 + x2) // 2 + 5))
    assert np.abs(frame[centre].astype(int) - original[centre].astype(int)).mean() > 3
    # The top-left corner, far from the face, is byte for byte what it was.
    assert np.array_equal(frame[:20, :20], original[:20, :20])


def test_boxes_at_the_edge_of_the_frame_do_not_crash():
    frame = np.full((100, 160, 3), 128, np.uint8)

    faces.blur_faces(frame, [(-30, -30, 20, 20), (140, 80, 400, 300), (50, 50, 51, 51)])


def fake_detector(*per_call):
    """A detector that answers the given boxes, call after call, then nothing."""
    calls = iter(per_call)

    def detect(image, threshold):
        boxes = next(calls, [])
        dets = np.array([[*box, 0.9] for box in boxes], dtype=np.float32).reshape(-1, 5)
        return dets, np.empty((len(boxes), 10), np.float32)

    return detect


def test_a_frame_where_the_detector_misses_is_still_blurred():
    noise = np.random.default_rng(1).integers(0, 255, (360, 640, 3), dtype=np.uint8)
    blurrer = faces.FaceBlurrer(fake_detector([(200, 100, 300, 220)], [], []))

    first, missed = noise.copy(), noise.copy()
    blurrer(first)
    blurrer(missed)

    # The second frame is not even looked at, yet the face found one frame earlier is hidden in it.
    assert not np.array_equal(missed[120:200, 220:280], noise[120:200, 220:280])


def test_the_hold_expires_so_old_boxes_do_not_blur_forever():
    noise = np.random.default_rng(2).integers(0, 255, (360, 640, 3), dtype=np.uint8)
    blurrer = faces.FaceBlurrer(fake_detector([(200, 100, 300, 220)]))
    blurrer(noise.copy())
    for _ in range(faces.HOLD_DETECTIONS * faces.DETECT_EVERY):
        late = noise.copy()
        blurrer(late)

    assert np.array_equal(late, noise)


def test_overlapping_boxes_become_one_and_apart_ones_stay_apart():
    merged = faces.merge_overlapping([(10, 10, 50, 50), (30, 30, 70, 70), (200, 200, 240, 240)])

    assert sorted(merged) == [(10, 10, 70, 70), (200, 200, 240, 240)]


def test_boxes_that_only_touch_through_a_third_are_still_merged():
    merged = faces.merge_overlapping([(0, 0, 20, 20), (40, 0, 60, 20), (15, 0, 45, 20)])

    assert merged == [(0, 0, 60, 20)]


def test_the_detector_gets_a_downscaled_frame_and_boxes_come_back_in_frame_pixels():
    seen = []

    def spy(image, threshold):
        seen.append(image.shape[:2])
        return np.array([[10, 20, 30, 40, 0.9]], np.float32), np.empty((1, 10), np.float32)

    found = faces.find_faces(np.zeros((720, 1280, 3), np.uint8), spy)

    assert seen == [(360, 640)]
    assert found == [(20, 40, 60, 80)]


def test_frames_between_two_detections_are_not_analysed():
    calls = []

    def spy(image, threshold):
        calls.append(1)
        return np.empty((0, 5), np.float32), np.empty((0, 10), np.float32)

    blurrer = faces.FaceBlurrer(spy)
    for _ in range(4):
        blurrer(np.zeros((360, 640, 3), np.uint8))

    assert len(calls) == 4 // faces.DETECT_EVERY
