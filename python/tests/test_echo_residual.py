"""#174 follow-up: warm start, residual echo suppressor (echo_res.py) and echo gain tracking.

All behaviours are checked through the public `cancel_echo(mic, ref, sr, params)`
seam with synthetic signals at 16 kHz and fixed seeds.
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

from echo_canceller import cancel_echo

SR = 16000
DELAY_MS = 100
BLOCK = 1024  # default block_size: the RES works per block


def seconds(s):
    return int(s * SR)


def linear_echo(ref, gain=1.0):
    rir = room_impulse_response(SR, seed=7)
    return gain * fft_convolve(delay(ref, int(SR * DELAY_MS / 1000)), rir)


def speech_burst(n, start, length, seed):
    out = np.zeros(n)
    first = seconds(start)
    count = seconds(length)
    out[first:first + count] = speech_like(count, SR, seed=seed)
    return out


def f32(x):
    return np.asarray(x, dtype=np.float32)


# -- 1. warm start -----------------------------------------------------------

def test_warm_start_attenuates_the_first_half_second_after_a_late_echo_onset():
    n = seconds(24)
    onset = seconds(10)
    ref = np.zeros(n)
    ref[onset:] = speech_like(n - onset, SR, seed=1)
    near = speech_burst(n, 1.0, 6.0, seed=2)  # user talks during the ref-silent lead-in
    mic = f32(linear_echo(ref) + near + noise(n, seed=3))

    out, report = cancel_echo(mic, f32(ref), SR)

    assert report["applied"] is True
    # The echo is only present from `onset`; a cold filter has not converged yet.
    assert erle_db(mic, out, onset, onset + seconds(0.5)) >= 15


# -- 2. residual suppressor on non-linear echo ---------------------------------

def nonlinear_echo(ref):
    """Loudspeaker-like saturation of the linear echo, normalised to rms 0.05."""
    echo = np.tanh(3.0 * linear_echo(ref))
    return echo * (0.05 / np.std(echo))


def nonlinear_scene():
    n = seconds(24)
    ref = speech_like(n, SR, seed=11, level=0.2)
    return n, ref, nonlinear_echo(ref)


def test_res_attenuates_nonlinear_echo_more_than_the_linear_filter_alone():
    n, ref, echo = nonlinear_scene()
    mic = f32(echo + noise(n, seed=3))
    no_res = {"res_enabled": False}

    out_res, report = cancel_echo(mic, f32(ref), SR)
    out_lin, _ = cancel_echo(mic, f32(ref), SR, no_res)

    assert report["applied"] is True
    start, end = seconds(10), seconds(22)
    assert erle_db(mic, out_res, start, end) >= erle_db(mic, out_lin, start, end) + 5


def test_res_leaves_near_end_only_regions_within_one_db():
    n, ref, echo = nonlinear_scene()
    ref = ref.copy()
    ref[seconds(14):seconds(20)] = 0.0  # far end quiet: only the near end talks there
    echo = nonlinear_echo(ref)
    near = speech_burst(n, 14.2, 5.6, seed=12)
    mic = f32(echo + near + noise(n, seed=3))

    out, report = cancel_echo(mic, f32(ref), SR)

    assert report["applied"] is True
    start, end = seconds(15), seconds(19.5)  # clear of the echo tail
    assert abs(energy_db(out[start:end]) - energy_db(mic[start:end])) <= 1.0


def test_res_preserves_near_end_energy_during_double_talk():
    n, ref, echo = nonlinear_scene()
    near = speech_burst(n, 12.0, 8.0, seed=13)
    base = f32(echo + noise(n, seed=3))
    mixed = f32(echo + near + noise(n, seed=3))

    out_base, _ = cancel_echo(base, f32(ref), SR)
    out_mixed, report = cancel_echo(mixed, f32(ref), SR)

    assert report["applied"] is True
    # What the near end adds to the output, relative to what it put into the mic.
    start, end = seconds(13), seconds(19)
    kept = out_mixed[start:end].astype(np.float64) - out_base[start:end]
    assert abs(energy_db(kept) - energy_db(near[start:end])) <= 1.5


# -- 3. no abrupt level jumps --------------------------------------------------

def test_output_level_changes_between_50ms_frames_are_bounded_in_a_steady_far_end_region():
    n, ref, echo = nonlinear_scene()
    # Steady reference: stationary noise (no syllabic envelope) so level changes
    # come from the suppressor itself, not from the content.
    rng = np.random.default_rng(5)
    ref = 0.1 * rng.standard_normal(n)
    echo = linear_echo(ref)
    mic = f32(echo + noise(n, seed=3))

    out, report = cancel_echo(mic, f32(ref), SR)

    assert report["applied"] is True
    frame = seconds(0.05)
    lo, hi = seconds(6), seconds(22)
    count = (hi - lo) // frame
    levels = np.array([energy_db(out[lo + i * frame:lo + (i + 1) * frame]) for i in range(count)])
    # echo_res.py slews the gain down by at most 1.5 dB per 64 ms block (4 dB in
    # the first 8 blocks after onset, outside this window) and the mic noise
    # itself moves ~1.5 dB between 50 ms frames: above 4 dB would be a step.
    assert np.max(np.abs(np.diff(levels))) <= 4.0


# -- 4. echo gain change (AGC) ---------------------------------------------------

def test_attenuation_holds_while_the_echo_path_gain_jumps_up():
    n = seconds(24)
    ref = speech_like(n, SR, seed=21, level=0.15)
    gain = np.ones(n)
    gain[seconds(14):seconds(18)] = 1.6
    mic = f32(linear_echo(ref) * gain + noise(n, seed=3))

    out, report = cancel_echo(mic, f32(ref), SR)

    assert report["applied"] is True
    assert erle_db(mic, out, seconds(14.5), seconds(18)) >= 25


# -- 5. pass-through invariants ----------------------------------------------------

def test_silent_reference_is_still_a_bit_identical_pass_through():
    n = seconds(10)
    mic = f32(speech_like(n, SR, seed=31) + noise(n, seed=32))

    out, report = cancel_echo(mic, np.zeros(n, dtype=np.float32), SR)

    assert report["applied"] is False
    assert np.array_equal(out, mic)


def test_unrelated_headphones_reference_is_still_a_bit_identical_pass_through():
    n = seconds(15)
    ref = f32(speech_like(n, SR, seed=33))
    mic = f32(speech_like(n, SR, seed=34) + noise(n, seed=35, level=1e-3))

    out, report = cancel_echo(mic, ref, SR)

    assert report["applied"] is False
    assert np.array_equal(out, mic)


def test_frames_where_the_reference_is_silent_inside_an_applied_file_are_unchanged():
    n = seconds(24)
    ref = speech_like(n, SR, seed=41, level=0.15)
    ref[seconds(14):seconds(19)] = 0.0
    near = speech_burst(n, 15.5, 3.0, seed=42)
    mic = f32(linear_echo(ref) + near + noise(n, seed=3))

    out, report = cancel_echo(mic, f32(ref), SR)

    assert report["applied"] is True
    # Skip the first ~0.3 s after the ref stops (echo tail + delay) and stay clear of the end.
    start, end = seconds(14.4), seconds(18.9)
    assert np.allclose(out[start:end], mic[start:end], atol=1e-4)
