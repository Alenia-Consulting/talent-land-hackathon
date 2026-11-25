"""The sound of each place: filtered so voices cannot be understood, and a level that is relative."""

import subprocess

import numpy as np
import pytest

from media import audio, pipeline, video_io
from media_fixtures import make_video

# Loud for the first two seconds, quiet afterwards: two places in one recording.
LOUD_THEN_QUIET = "anoisesrc=c=pink:r=16000:a=0.8:seed=7|volume='if(lt(t,2),1,0.05)':eval=frame"


def spectrum(mp3: bytes, tmp_path):
    """Power in the low band (under 700 Hz) and the high band (over 1.5 kHz) of an mp3."""
    path = tmp_path / "heard.mp3"
    path.write_bytes(mp3)
    raw = subprocess.run(
        [video_io.ffmpeg_exe(), "-v", "error", "-i", str(path), "-ac", "1", "-ar", "16000", "-f", "f32le", "-"],
        capture_output=True, check=True,
    ).stdout  # fmt: skip
    samples = np.frombuffer(raw, dtype="<f4")
    power = np.abs(np.fft.rfft(samples)) ** 2
    freqs = np.fft.rfftfreq(samples.size, 1 / audio.SAMPLE_RATE)
    return power[freqs < 700].sum(), power[freqs > 1500].sum()


def test_a_voice_range_tone_is_filtered_out_of_the_sound_to_listen_to(tmp_path):
    # 300 Hz is the murmur that stays; 3 kHz is where speech becomes understandable.
    video = make_video(tmp_path / "in.mp4", seconds=3, sound="sine=f=300:r=16000|volume=0.5")
    mixed = make_video(tmp_path / "mix.mp4", seconds=3, sound="aevalsrc='0.4*sin(2*PI*300*t)+0.4*sin(2*PI*3000*t)':s=16000")

    low, high = spectrum(audio.sound_for_listening(mixed, 0, 3), tmp_path)

    assert low > 0
    assert high < low * 0.0001  # at least 40 dB down
    assert audio.sound_for_listening(video, 0, 3).startswith((b"ID3", b"\xff"))  # an mp3


def test_a_recording_without_an_audio_track_gives_no_sound_and_no_level(tmp_path):
    video = make_video(tmp_path / "in.mp4", seconds=3)

    assert audio.sound_for_listening(video, 0, 3) is None
    assert audio.mean_power(video, 0, 3) is None


def test_a_silent_track_is_not_a_quiet_room(tmp_path):
    video = make_video(tmp_path / "in.mp4", seconds=3, sound="anullsrc=r=16000:cl=mono")

    assert audio.mean_power(video, 0, 3) is None


def test_the_level_is_relative_to_the_rest_of_the_same_recording(tmp_path):
    video = make_video(tmp_path / "in.mp4", seconds=4, sound=LOUD_THEN_QUIET)

    loud = audio.mean_power(video, 0, 2)
    quiet = audio.mean_power(video, 2, 4)

    # 10 dB apart, four times the +-2.5 dB band. The noise is seeded: unseeded, the ratio wandered
    # around 20 and a strict threshold failed one run in ten.
    assert loud > quiet * 10
    assert audio.classify({1: loud, 2: quiet}) == {1: "noisy", 2: "quiet"}


def test_similar_places_are_both_medium_and_a_lone_place_has_no_level():
    assert audio.classify({1: 0.010, 2: 0.011, 3: 0.0105}) == {1: "medium", 2: "medium", 3: "medium"}
    assert audio.classify({1: 0.01, 2: None}) == {1: None, 2: None}
    assert audio.classify({1: None, 2: None}) == {1: None, 2: None}


def test_the_pipeline_returns_each_places_sound_and_level(tmp_path):
    video = make_video(tmp_path / "in.mp4", seconds=4, sound=LOUD_THEN_QUIET)
    steps = [pipeline.StepTiming(1, 0.0, 2.0, 1.0), pipeline.StepTiming(2, 2.0, 4.0, 3.0)]

    done = pipeline.process(video, steps)

    assert [item.noise_level for item in done] == ["noisy", "quiet"]
    assert all(item.sound for item in done)


def test_a_sound_is_never_longer_than_the_limit(tmp_path, monkeypatch):
    monkeypatch.setattr(audio, "MAX_SOUND_SECONDS", 1.0)
    video = make_video(tmp_path / "in.mp4", seconds=4, sound="sine=f=300:r=16000")

    short = audio.sound_for_listening(video, 0, 4)
    long = audio.sound_for_listening(video, 0, 1)

    assert abs(len(short) - len(long)) < 2000


def test_ffmpeg_failing_to_run_is_not_a_crash(tmp_path, monkeypatch):
    def broken(*_args, **_kwargs):
        raise OSError("no ffmpeg")

    monkeypatch.setattr(subprocess, "run", broken)

    assert audio.sound_for_listening(tmp_path / "x.mp4", 0, 1) is None
