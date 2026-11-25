"""video_io: measuring a recording by decoding it, not by trusting its header or the phone."""

import pathlib

import pytest

from conftest import encode_seconds
from media import video_io
from media.errors import ProcessingFailed

# The conftest fixture swaps video_io.duration for upload tests; these tests need the real one.
real_duration = video_io.duration


def test_duration_measures_the_file_and_not_its_header(tmp_path):
    """Un webm de MediaRecorder suele venir sin duración en la cabecera."""
    video = encode_seconds(tmp_path, 2.0)
    assert real_duration(video) == pytest.approx(2.0, abs=0.2)


def test_duration_refuses_a_file_it_cannot_decode(tmp_path):
    broken = tmp_path / "roto.mp4"
    broken.write_bytes(b"no soy un video")
    with pytest.raises(ProcessingFailed):
        real_duration(broken)
