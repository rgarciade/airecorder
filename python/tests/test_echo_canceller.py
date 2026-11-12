"""Seam S5 of #174: python/echo_canceller.py (pure numpy, offline).

Public API defined by these tests:
    cancel_echo(mic, ref, sr, params=None) -> (out, report)
        mic, ref: 1-D float arrays (mono, same sample rate, lengths may differ).
        out: same length and dtype as mic. When report["applied"] is False,
             out is exactly mic (bit-identical pass-through).
        report: dict with at least "applied" (bool), "reason" (str or None:
                "no_echo", "ref_silent") and "delay_ms" (float or None).
    estimate_delay(mic, ref, sr) -> float
        Delay of the echo in mic relative to ref, in milliseconds.
        Positive when mic lags ref, negative when mic leads.
    EchoCanceller(sr, delay_samples, params=None)
        .process(mic_block, ref_block) -> np.ndarray (samples ready so far)
        .flush() -> np.ndarray (remaining samples)
        Concatenated output is aligned with the mic input and has its length.

Signals are synthetic (speech-like coloured noise, random room impulse
response) at 16 kHz to keep the suite fast; thresholds come from the plan.
"""

import numpy as np
import pytest

from echo_signals import (
    delay,
    energy_db,
    erle_db,
    fft_convolve,
    noise,
    room_impulse_response,
    speech_like,
)

from echo_canceller import EchoCanceller, cancel_echo, estimate_delay

SR = 16000
DELAY_MS = 150


def seconds(s):
    return int(s * SR)


def echo_of(ref, delay_ms=DELAY_MS, seed=7):
    return fft_convolve(delay(ref, int(SR * delay_ms / 1000)), room_impulse_response(SR, seed))


def test_s5a_cancels_delayed_room_echo_in_far_end_only_regions():
    n = seconds(20)
    ref = speech_like(n, SR, seed=1)
    near = np.zeros(n)
    near[seconds(12):seconds(16)] = speech_like(seconds(4), SR, seed=2)
    mic = (echo_of(ref) + near + noise(n, seed=3)).astype(np.float32)
    # The system track is usually a bit longer than the mic track.
    ref_track = np.concatenate([ref, speech_like(seconds(0.5), SR, seed=4)]).astype(np.float32)

    out, report = cancel_echo(mic, ref_track, SR)

    assert report["applied"] is True
    assert report["delay_ms"] == pytest.approx(DELAY_MS, abs=2)
    assert out.shape == mic.shape
    assert out.dtype == mic.dtype
    assert erle_db(mic, out, seconds(5), seconds(12)) >= 15


def test_s5b_headphones_unrelated_reference_is_a_bit_identical_pass_through():
    n = seconds(15)
    ref = speech_like(n, SR, seed=10).astype(np.float32)
    mic = (speech_like(n, SR, seed=11) + noise(n, seed=12, level=1e-3)).astype(np.float32)

    out, report = cancel_echo(mic, ref, SR)

    assert report["applied"] is False
    assert report["reason"] == "no_echo"
    assert out.dtype == mic.dtype
    assert np.array_equal(out, mic)


def test_s5c_silent_reference_is_a_pass_through_with_ref_silent_reason():
    n = seconds(10)
    ref = np.zeros(n, dtype=np.float32)
    mic = (speech_like(n, SR, seed=20) + noise(n, seed=21)).astype(np.float32)

    out, report = cancel_echo(mic, ref, SR)

    assert report["applied"] is False
    assert report["reason"] == "ref_silent"
    assert np.array_equal(out, mic)


def test_s5d_double_talk_preserves_near_end_and_never_amplifies():
    n = seconds(16)
    ref = speech_like(n, SR, seed=30)
    echo = echo_of(ref, seed=31)
    near = np.zeros(n)
    dt_start, dt_end = seconds(10), seconds(16)
    near_level = np.sqrt(np.mean(echo[dt_start:dt_end] ** 2))
    near[dt_start:dt_end] = speech_like(dt_end - dt_start, SR, seed=32, level=near_level)
    mic = (echo + near + noise(n, seed=33)).astype(np.float32)

    out, report = cancel_echo(mic, ref.astype(np.float32), SR)

    assert report["applied"] is True
    # Near-end component kept within 1 dB (projection of the output on the near-end signal).
    segment_near = near[dt_start:dt_end]
    segment_out = out[dt_start:dt_end].astype(np.float64)
    gain = np.dot(segment_out, segment_near) / np.dot(segment_near, segment_near)
    assert 20 * np.log10(gain) == pytest.approx(0.0, abs=1.0)
    # Output never louder than the mic, block by block (0.1 dB tolerance).
    block = 1024
    for start in range(0, n - block + 1, block):
        mic_db = energy_db(mic[start:start + block])
        out_db = energy_db(out[start:start + block])
        assert out_db <= mic_db + 0.1, f"block at {start / SR:.2f}s is louder than the mic"


@pytest.mark.slow
def test_s5e_tracks_50ppm_clock_drift_over_ten_minutes():
    n = seconds(600)
    ref = speech_like(n, SR, seed=40)
    # The mic clock runs 50 ppm faster than the system clock: the echo slowly
    # drifts (30 ms over 10 minutes) relative to the reference.
    drifted_index = np.arange(n) * (1 + 50e-6)
    drifted_ref = np.interp(drifted_index, np.arange(n), ref, right=0.0)
    mic = (echo_of(drifted_ref, seed=41) + noise(n, seed=42)).astype(np.float32)

    out, report = cancel_echo(mic, ref.astype(np.float32), SR)

    assert report["applied"] is True
    assert erle_db(mic, out, seconds(290), seconds(350)) >= 10
    assert erle_db(mic, out, seconds(530), seconds(590)) >= 10


@pytest.mark.parametrize("delay_ms", [DELAY_MS, 0, -20])
def test_s5f_estimate_delay_finds_known_lag_within_one_ms(delay_ms):
    n = seconds(10)
    ref = speech_like(n, SR, seed=50)
    mic = echo_of(ref, delay_ms=delay_ms, seed=51) + noise(n, seed=52)

    estimated = estimate_delay(mic.astype(np.float32), ref.astype(np.float32), SR)

    assert estimated == pytest.approx(delay_ms, abs=1.0)


def test_s5g_streamed_blocks_match_whole_array_processing():
    n = seconds(8)
    ref = speech_like(n, SR, seed=60).astype(np.float32)
    mic = (echo_of(ref, seed=61) + noise(n, seed=62)).astype(np.float32)
    delay_samples = int(SR * DELAY_MS / 1000)

    def run(chunk):
        canceller = EchoCanceller(SR, delay_samples)
        parts = [
            canceller.process(mic[i:i + chunk], ref[i:i + chunk])
            for i in range(0, n, chunk)
        ]
        parts.append(canceller.flush())
        return np.concatenate(parts)

    whole = run(n)
    assert len(whole) == n
    for chunk in (4800, 7777):
        streamed = run(chunk)
        assert len(streamed) == n
        np.testing.assert_allclose(streamed, whole, atol=1e-5)
