"""The whole pipeline on a real (synthetic) recording: cut, blur, and nothing left behind."""

import pathlib

import cv2
import pytest

from media import faces, pipeline, video_io
from test.media_fixtures import make_video

STEPS = [
    pipeline.StepTiming(position=1, start_seconds=0.0, end_seconds=2.0, photo_second=1.0),
    pipeline.StepTiming(position=2, start_seconds=2.0, end_seconds=4.0, photo_second=3.0),
]


def frames_of(clip: bytes, tmp_path: pathlib.Path) -> list:
    path = tmp_path / "clip.mp4"
    path.write_bytes(clip)
    capture = cv2.VideoCapture(str(path))
    found = []
    while True:
        ok, frame = capture.read()
        if not ok:
            return found
        found.append(frame)


def test_every_step_becomes_a_clip_and_a_photo_without_faces(tmp_path):
    video = make_video(tmp_path / "in.mp4")

    steps = pipeline.process(video, STEPS)

    assert [step.position for step in steps] == [1, 2]
    for step in steps:
        assert step.clip[4:8] == b"ftyp"  # a real mp4
        frames = frames_of(step.clip, tmp_path)
        assert 25 <= len(frames) <= 35  # 2 s at 15 fps
        # Not just the first frame: the middle and the last are clean too.
        for frame in (frames[0], frames[len(frames) // 2], frames[-1]):
            assert faces.find_faces(frame) == []

        photo = cv2.imdecode(__import__("numpy").frombuffer(step.photo, "uint8"), cv2.IMREAD_COLOR)
        assert photo.shape[:2] == frames[0].shape[:2]
        assert faces.find_faces(photo) == []


def test_ambience_is_not_invented(tmp_path):
    steps = pipeline.process(make_video(tmp_path / "in.mp4"), STEPS[:1])

    assert steps[0].sound is None
    assert steps[0].noise_level is None


def test_a_portrait_recording_comes_out_upright(tmp_path):
    video = make_video(tmp_path / "phone.mp4", rotate=True)

    (step,) = pipeline.process(video, STEPS[:1])

    height, width = frames_of(step.clip, tmp_path)[0].shape[:2]
    assert height > width


def test_big_recordings_are_scaled_down_to_720p(tmp_path):
    video = make_video(tmp_path / "big.mp4", seconds=1, size=(1920, 1080))

    assert video_io.target_size(video) == (1280, 720)


def test_something_that_is_not_a_video_fails_cleanly(tmp_path):
    garbage = tmp_path / "garbage.mp4"
    garbage.write_bytes(b"this is not a video" * 100)

    with pytest.raises(pipeline.ProcessingFailed):
        pipeline.process(garbage, STEPS)


def test_a_step_beyond_the_end_of_the_video_fails_instead_of_returning_nothing(tmp_path):
    video = make_video(tmp_path / "in.mp4", seconds=2)
    late = [pipeline.StepTiming(position=1, start_seconds=30.0, end_seconds=40.0, photo_second=31.0)]

    with pytest.raises(pipeline.ProcessingFailed):
        pipeline.process(video, late)


def test_a_failure_returns_nothing_at_all(tmp_path):
    """Step 1 is fine, step 2 is past the end: the caller must not get step 1 alone."""
    video = make_video(tmp_path / "in.mp4", seconds=2)
    steps = [
        pipeline.StepTiming(position=1, start_seconds=0.0, end_seconds=1.0, photo_second=0.5),
        pipeline.StepTiming(position=2, start_seconds=30.0, end_seconds=31.0, photo_second=30.5),
    ]

    with pytest.raises(pipeline.ProcessingFailed):
        pipeline.process(video, steps)
