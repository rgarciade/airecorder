"""Synthetic signal helpers shared by the echo cancellation tests (numpy only)."""

import numpy as np


def fft_convolve(a, b):
    """Linear convolution via FFT, truncated to len(a)."""
    n = len(a) + len(b) - 1
    size = 1 << (n - 1).bit_length()
    out = np.fft.irfft(np.fft.rfft(a, size) * np.fft.rfft(b, size), size)
    return out[: len(a)]


def speech_like(n, sr, seed, level=0.1):
    """Pink-ish noise band-limited to 100-7000 Hz with a ~4 Hz syllabic envelope."""
    rng = np.random.default_rng(seed)
    white = rng.standard_normal(n)
    spectrum = np.fft.rfft(white)
    freqs = np.fft.rfftfreq(n, 1.0 / sr)
    shaping = np.zeros_like(freqs)
    band = (freqs >= 100) & (freqs <= min(7000, sr / 2 - 1))
    shaping[band] = 1.0 / np.sqrt(freqs[band])
    colored = np.fft.irfft(spectrum * shaping, n)
    t = np.arange(n) / sr
    phase = rng.uniform(0, 2 * np.pi)
    envelope = 0.2 + 0.8 * np.abs(np.sin(2 * np.pi * 2.0 * t + phase))
    signal = colored * envelope
    return (level * signal / (np.sqrt(np.mean(signal**2)) + 1e-12)).astype(np.float64)


def room_impulse_response(sr, seed, length_ms=60.0, gain=0.5):
    """Direct path at tap 0 plus an exponentially decaying random tail."""
    rng = np.random.default_rng(seed)
    length = int(sr * length_ms / 1000)
    t = np.arange(length) / sr
    tail = rng.standard_normal(length) * np.exp(-t / (length_ms / 1000 / 5)) * 0.3
    tail[0] = 1.0
    return gain * tail


def delay(signal, samples):
    """Shift right by `samples` (left when negative), keeping the length."""
    out = np.zeros_like(signal)
    if samples >= 0:
        out[samples:] = signal[: len(signal) - samples]
    else:
        out[: len(signal) + samples] = signal[-samples:]
    return out


def noise(n, seed, level=1e-4):
    return level * np.random.default_rng(seed).standard_normal(n)


def energy_db(x):
    return 10 * np.log10(np.sum(np.asarray(x, dtype=np.float64) ** 2) + 1e-20)


def erle_db(mic, out, start, end):
    """Echo return loss enhancement over [start, end) samples."""
    return energy_db(mic[start:end]) - energy_db(out[start:end])
