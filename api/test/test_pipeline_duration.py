"""Why a step can have no image: the file is shorter than the recorder said."""

import pytest

from media import pipeline, video_io
from media_fixtures import make_video


def test_the_real_length_of_the_file_is_read(tmp_path):
    video = make_video(tmp_path / "v.mp4", seconds=2)

    assert video_io.duration(video) == pytest.approx(2, abs=0.5)


def test_a_step_past_the_end_says_how_long_the_video_really_is(tmp_path):
    video = make_video(tmp_path / "v.mp4", seconds=2)
    steps = [pipeline.StepTiming(position=3, start_seconds=5.0, end_seconds=8.0, photo_second=6.0)]

    with pytest.raises(pipeline.ProcessingFailed) as error:
        pipeline.process(video, steps)

    assert "el paso 3 no tiene imagen" in str(error.value)
    assert "empieza en 5.0 s" in str(error.value)
    assert "dura 2" in str(error.value)


def test_an_unreadable_file_has_no_duration(tmp_path):
    broken = tmp_path / "x.mp4"
    broken.write_bytes(b"nope" * 50)

    assert video_io.duration(broken) is None


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
