"""The sound of each place: a version to listen to, and how loud the place is.

Both come from the original recording, before it is deleted, and both are about privacy and
honesty as much as about sound:

  · The version to listen to goes through a low-pass filter, so the murmur, the beeps and the
    doors are there but a conversation cannot be understood. The recording is never played back
    as it was captured.
  · The noise level is RELATIVE: how much louder or quieter a place is than the rest of the same
    recording. A phone microphone is not calibrated, so decibels would be a made-up number. Every
    step is measured with the same gain; normalising each clip would make a quiet room and a loud
    one sound alike, which is exactly the thing this level exists to tell apart.

A recording without an audio track, or with a silent one, gives no sound and no level: nothing is
invented. None of this ever fails the processing of the video itself.
"""

import math
import pathlib
import subprocess

import numpy as np

from media import video_io

SAMPLE_RATE = 16000
# Voices live above this; the murmur and the beeps that tell a place apart mostly do not. One
# ffmpeg low-pass falls 12 dB per octave, which leaves speech understandable at 1-2 kHz, so it is
# applied twice (24 dB per octave).
LOWPASS_HZ = 700
LOWPASS = f"lowpass=f={LOWPASS_HZ},lowpass=f={LOWPASS_HZ}"
MP3_BITRATE = "48k"
# A step's sound is for listening before a visit, not for archiving it.
MAX_SOUND_SECONDS = 30.0
# The noise is measured while the person stands still on arrival (the 3 s pause), not while they
# walk: footsteps and the phone rubbing against a sleeve would measure the person, not the place.
NOISE_WINDOW_SECONDS = 3.0
# Below this the track is silence (a muted microphone), not a quiet room.
SILENCE_RMS = 1e-4
# Distance from the recording's average, in dB, past which a place is called quiet or noisy.
BAND_DB = 2.5


def _decode(video: pathlib.Path, start: float, duration: float, extra: list[str]) -> bytes | None:
    """The first audio track of [start, start + duration) through `extra`, or None without one."""
    command = [
        video_io.ffmpeg_exe(), "-v", "error", "-ss", str(max(0.0, start)), "-t", str(duration),
        "-i", str(video), "-map", "0:a:0", "-vn", "-ac", "1", "-ar", str(SAMPLE_RATE), *extra, "pipe:1",
    ]  # fmt: skip
    try:
        done = subprocess.run(command, capture_output=True, timeout=120, check=False)
    except (OSError, subprocess.TimeoutExpired):
        return None
    return done.stdout if done.returncode == 0 and done.stdout else None


def sound_for_listening(video: pathlib.Path, start: float, end: float) -> bytes | None:
    """An mp3 of the step with the voices filtered out, or None when there is no usable audio."""
    duration = min(end - start, MAX_SOUND_SECONDS)
    mp3 = _decode(
        video, start, duration,
        ["-af", LOWPASS, "-c:a", "libmp3lame", "-b:a", MP3_BITRATE, "-f", "mp3"],
    )  # fmt: skip
    return mp3


def mean_power(video: pathlib.Path, start: float, end: float) -> float | None:
    """Mean power of the step's arrival pause, unfiltered and unnormalised; None for silence."""
    window = min(end - start, NOISE_WINDOW_SECONDS)
    raw = _decode(video, start, window, ["-f", "f32le"])
    if raw is None:
        return None
    samples = np.frombuffer(raw, dtype="<f4")
    power = float(np.mean(np.square(samples))) if samples.size else 0.0
    return power if math.sqrt(power) >= SILENCE_RMS else None


def classify(powers: dict[int, float | None]) -> dict[int, str | None]:
    """quiet / medium / noisy for each step, against the average of the same recording.

    Needs two measured places at least: one place alone has nothing to be louder or quieter than,
    so it gets no level rather than an arbitrary "medium".
    """
    measured = {position: 10 * math.log10(power) for position, power in powers.items() if power}
    if len(measured) < 2:
        return {position: None for position in powers}
    average = sum(measured.values()) / len(measured)

    def level(db: float) -> str:
        if db - average > BAND_DB:
            return "noisy"
        return "quiet" if db - average < -BAND_DB else "medium"

    return {position: level(measured[position]) if position in measured else None for position in powers}
