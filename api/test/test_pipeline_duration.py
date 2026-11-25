"""Why a step can have no image: the file is shorter than the recorder said."""

import pytest

from media import pipeline, video_io
from media_fixtures import make_video

# The autouse fixture swaps video_io.duration for the tests; these want the real one.
real_duration = video_io.duration


def test_the_real_length_of_the_file_is_read(tmp_path):
    video = make_video(tmp_path / "v.mp4", seconds=2)

    assert real_duration(video) == pytest.approx(2, abs=0.5)


def test_a_step_with_no_image_even_after_the_rescue_says_how_long_the_video_is(monkeypatch, tmp_path):
    video = make_video(tmp_path / "v.mp4", seconds=2)
    monkeypatch.setattr(video_io, "read_frames", lambda *args, **kwargs: iter(()))
    steps = [pipeline.StepTiming(position=3, start_seconds=5.0, end_seconds=8.0, photo_second=6.0)]

    with pytest.raises(pipeline.ProcessingFailed) as error:
        pipeline.process(video, steps)

    assert "el paso 3 no tiene imagen" in str(error.value)
    assert "empieza en 5.0 s" in str(error.value)
    assert "dura 2" in str(error.value)


def test_an_unreadable_file_has_no_duration(tmp_path):
    broken = tmp_path / "x.mp4"
    broken.write_bytes(b"nope" * 50)

    with pytest.raises(pipeline.ProcessingFailed):
        real_duration(broken)


def test_a_hung_ffmpeg_does_not_block_the_request(monkeypatch, tmp_path):
    import subprocess

    def hang(*args, **kwargs):
        raise subprocess.TimeoutExpired(args[0], kwargs["timeout"])

    monkeypatch.setattr(video_io.subprocess, "run", hang)

    with pytest.raises(pipeline.ProcessingFailed, match="tardó demasiado"):
        real_duration(tmp_path / "v.mp4")


def test_a_file_ffmpeg_only_decodes_in_part_is_not_given_a_length(monkeypatch, tmp_path):
    class Partial:
        returncode = 1
        stderr = "frame=  5 time=00:00:03.20 bitrate=N/A"

    monkeypatch.setattr(video_io.subprocess, "run", lambda *a, **k: Partial())

    with pytest.raises(pipeline.ProcessingFailed):
        real_duration(tmp_path / "v.mp4")


def test_a_jump_that_finds_nothing_falls_back_to_decoding_from_the_start(monkeypatch, tmp_path):
    import numpy as np

    calls = []

    def decode(video, size, start, duration, *, jump):
        calls.append(jump)
        if jump:
            return iter(())
        return iter([np.zeros((2, 2, 3), np.uint8)])

    monkeypatch.setattr(video_io, "_decode", decode)

    frames = list(video_io.read_frames(tmp_path / "v.mp4", (2, 2), 27.1, 5.0))

    assert calls == [True, False]
    assert len(frames) == 1


def test_a_jump_that_works_is_not_repeated(monkeypatch, tmp_path):
    import numpy as np

    calls = []

    def decode(video, size, start, duration, *, jump):
        calls.append(jump)
        return iter([np.zeros((2, 2, 3), np.uint8)])

    monkeypatch.setattr(video_io, "_decode", decode)

    list(video_io.read_frames(tmp_path / "v.mp4", (2, 2), 5.0, 2.0))

    assert calls == [True]
