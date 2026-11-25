"""The whole pipeline on a real (synthetic) recording: cut, blur, and nothing left behind."""

import pathlib

import cv2
import pytest

from conftest import encode_seconds
from media import faces, pipeline, video_io
from media_fixtures import make_video

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
        assert 2 * video_io.FPS - 3 <= len(frames) <= 2 * video_io.FPS + 3  # 2 s
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


def test_a_rescued_step_keeps_its_neighbours(tmp_path):
    """Step 2 is past the end: it is rescued and step 1 is untouched, both come back."""
    video = make_video(tmp_path / "in.mp4", seconds=2)
    steps = [
        pipeline.StepTiming(position=1, start_seconds=0.0, end_seconds=1.0, photo_second=0.5),
        pipeline.StepTiming(position=2, start_seconds=30.0, end_seconds=31.0, photo_second=30.5),
    ]

    assert [item.position for item in pipeline.process(video, steps)] == [1, 2]


def test_a_step_past_the_end_uses_the_last_frame_instead_of_failing(tmp_path):
    """Las guías ya grabadas tienen marcas posteriores al final real del fichero."""
    video = encode_seconds(tmp_path, 2.0)
    steps = [pipeline.StepTiming(position=1, start_seconds=5.0, end_seconds=6.0, photo_second=5.5)]

    processed = pipeline.process(video, steps)

    assert len(processed[0].photo) > 0


def test_a_file_with_no_frames_at_all_is_still_a_failure(tmp_path):
    empty = tmp_path / "vacio.mp4"
    empty.write_bytes(b"")
    with pytest.raises(pipeline.ProcessingFailed):
        pipeline.process(empty, [pipeline.StepTiming(1, 0.0, 1.0, 0.5)])


def test_a_rescued_step_gets_a_clip_with_frames_in_it(tmp_path):
    """Un mp4 de cero fotogramas es una tarjeta rota en el reproductor."""
    video = encode_seconds(tmp_path, 2.0)
    steps = [pipeline.StepTiming(position=1, start_seconds=5.0, end_seconds=6.0, photo_second=5.5)]

    assert len(frames_of(pipeline.process(video, steps)[0].clip, tmp_path)) > 0
