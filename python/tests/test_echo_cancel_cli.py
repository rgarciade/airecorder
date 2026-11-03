"""Seam S6 of #174: `audio_sync_analyzer.py echo-cancel` subcommand.

Contract defined by these tests:
    audio_sync_analyzer.py echo-cancel --mic <in> --ref <in> --out <out.webm> --ffmpeg <ffmpeg>
    - Decodes both inputs (any ffmpeg-readable format) and, when echo is found,
      writes the cleaned mic track to --out as webm/opus.
    - The last stdout line is `ECHO_RESULT {json}` with at least
      "applied" (bool) and "reason" (str or null).
    - Exit 0 on success (applied or not). When not applied, --out is NOT written.
    - Exit != 0 on errors, and --out is not left behind.

Skipped when no ffmpeg binary is available (node_modules/ffmpeg-static or PATH).
"""

import json
import os
import shutil
import subprocess
import sys
import wave

import numpy as np
import pytest

from echo_signals import delay, fft_convolve, noise, room_impulse_response, speech_like

PYTHON_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
REPO_ROOT = os.path.abspath(os.path.join(PYTHON_DIR, ".."))
ANALYZER = os.path.join(PYTHON_DIR, "audio_sync_analyzer.py")
SR = 48000


def find_ffmpeg():
    bundled = os.path.join(REPO_ROOT, "node_modules", "ffmpeg-static", "ffmpeg")
    if os.path.isfile(bundled) and os.access(bundled, os.X_OK):
        return bundled
    return shutil.which("ffmpeg")


FFMPEG = find_ffmpeg()
pytestmark = pytest.mark.skipif(FFMPEG is None, reason="ffmpeg not available")


def write_wav(path, signal):
    pcm = np.clip(signal, -1.0, 1.0)
    with wave.open(str(path), "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(SR)
        wav.writeframes((pcm * 32767).astype("<i2").tobytes())


def to_webm(ffmpeg, wav_path, webm_path):
    subprocess.run(
        [ffmpeg, "-y", "-v", "error", "-i", str(wav_path), "-c:a", "libopus", "-b:a", "96k", str(webm_path)],
        check=True,
    )


def run_echo_cancel(mic, ref, out):
    return subprocess.run(
        [sys.executable, ANALYZER, "echo-cancel", "--mic", str(mic), "--ref", str(ref), "--out", str(out), "--ffmpeg", FFMPEG],
        capture_output=True,
        text=True,
        timeout=600,
    )


def echo_result(stdout):
    lines = [line for line in stdout.splitlines() if line.strip()]
    assert lines, "no stdout"
    assert lines[-1].startswith("ECHO_RESULT "), f"last stdout line was: {lines[-1]!r}"
    return json.loads(lines[-1][len("ECHO_RESULT "):])


def make_echo_recording(tmp_path):
    n = 12 * SR
    ref = speech_like(n, SR, seed=1)
    echo = fft_convolve(delay(ref, int(0.15 * SR)), room_impulse_response(SR, seed=2))
    mic = echo + noise(n, seed=3)
    write_wav(tmp_path / "ref.wav", ref)
    write_wav(tmp_path / "mic.wav", mic)
    return tmp_path / "mic.wav", tmp_path / "ref.wav"


def test_s6a_cleans_wav_inputs_into_decodable_opus_webm(tmp_path):
    mic, ref = make_echo_recording(tmp_path)
    out = tmp_path / "rec-echo-tmp.webm"

    result = run_echo_cancel(mic, ref, out)

    assert result.returncode == 0, result.stderr
    assert echo_result(result.stdout)["applied"] is True
    assert out.is_file()
    probe = subprocess.run([FFMPEG, "-hide_banner", "-i", str(out), "-f", "null", "-"], capture_output=True, text=True)
    assert probe.returncode == 0, probe.stderr
    assert "Audio: opus" in probe.stderr


def test_s6a_accepts_webm_inputs_as_recorded_by_the_app(tmp_path):
    mic_wav, ref_wav = make_echo_recording(tmp_path)
    mic, ref = tmp_path / "rec-microphone.webm", tmp_path / "rec-system.webm"
    to_webm(FFMPEG, mic_wav, mic)
    to_webm(FFMPEG, ref_wav, ref)
    out = tmp_path / "rec-echo-tmp.webm"

    result = run_echo_cancel(mic, ref, out)

    assert result.returncode == 0, result.stderr
    assert echo_result(result.stdout)["applied"] is True
    assert out.is_file()


def test_s6a_without_echo_reports_not_applied_and_writes_nothing(tmp_path):
    n = 10 * SR
    write_wav(tmp_path / "ref.wav", speech_like(n, SR, seed=10))
    write_wav(tmp_path / "mic.wav", speech_like(n, SR, seed=11) + noise(n, seed=12, level=1e-3))
    out = tmp_path / "rec-echo-tmp.webm"

    result = run_echo_cancel(tmp_path / "mic.wav", tmp_path / "ref.wav", out)

    assert result.returncode == 0, result.stderr
    report = echo_result(result.stdout)
    assert report["applied"] is False
    assert report["reason"] == "no_echo"
    assert not out.exists()


def test_s6b_invalid_input_exits_non_zero_without_output(tmp_path):
    bad_mic = tmp_path / "mic.webm"
    bad_mic.write_text("this is not audio")
    _, ref = make_echo_recording(tmp_path)
    out = tmp_path / "rec-echo-tmp.webm"

    result = run_echo_cancel(bad_mic, ref, out)

    combined = result.stdout + result.stderr
    # The failure must come from the echo-cancel path itself, not from missing
    # deps, a missing subcommand or the transcription argparse rejecting argv.
    for noise_marker in (
        "ModuleNotFoundError",
        "ImportError",
        "the following arguments are required",
        "unrecognized arguments",
        "invalid choice",
        "--basename",
    ):
        assert noise_marker not in combined, combined
    assert result.returncode != 0
    assert not out.exists()
    # The CLI must report the rejection with an ECHO-tagged error (e.g. ECHO_ERROR).
    assert "ECHO" in combined, combined
