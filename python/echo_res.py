"""Frequency-domain residual echo suppressor (RES) for the echo canceller (#174).

The linear adaptive filter cannot remove what is not linearly predictable from
the reference: loudspeaker distortion and the browser's own AEC/AGC leave a
residual whose *magnitude* follows the echo but whose waveform does not. This
stage attenuates that residual per frequency bin, WebRTC-AEC3 / Speex style:

1. Per block, a 2B frame (previous + current block) of the error `e` and of the
   linear echo estimate `y` is transformed to the frequency domain.
2. The residual echo power in each bin is modelled as `leak(band) * |Y(k)|^2`.
   `leak` is the error/echo-estimate power ratio per band, tracked with a
   minimum-follower: it drops immediately when the error is small and rises
   only slowly, so near-end speech (a burst of error energy that is not echo)
   does not teach the suppressor to attenuate it.
3. A Wiener-like gain `1 - over * leak * |Y|^2 / |E|^2` is computed, so bins
   where the error clearly exceeds the modelled echo (near-end speech) keep
   gain ~1, floored at `res_floor_db`.
4. The gain is smoothed across frequency and slewed in time (limited dB change
   per block, faster down than up) so there are no audible steps or pumping.
5. It is applied as a linear time-varying filter through overlap-save, with a
   crossfade between the previous and the current gain inside each block.
"""

import numpy as np

RES_PARAMS = {
    "res_enabled": True,
    "res_floor_db": -15.0,  # maximum attenuation per bin
    "res_overestimate": 2.0,  # scale on the modelled residual echo power
    "res_leak_max": 1.0,  # upper bound of the error/echo power ratio
    "res_leak_rise_db": 0.06,  # min-follower rise per block (dB) ~ 3 dB/s
    "res_leak_smooth": 0.85,  # time smoothing of the per-band power ratio
    "res_power_smooth": 0.5,  # time smoothing of |E|^2 and |Y|^2
    "res_freq_smooth_bins": 5,  # gain smoothing across frequency (odd)
    "res_psd_smooth": True,  # smooth |E|^2 and |Y|^2 across frequency before the gain
    "res_down_db": 1.5,  # max gain decrease per block (dB)
    "res_up_db": 12.0,  # max gain increase per block (dB): near-end speech is never held back
    "res_onset_down_db": 4.0,  # faster decrease right after the reference starts
    "res_onset_blocks": 8,
    "res_low_hz": 80.0,  # below this the gain is left at 1
    "res_bands": 32,  # bands for the leak estimate (log spaced)
}


class ResidualSuppressor:
    def __init__(self, sr, block, params):
        self.p = params
        self.B = block
        self.N = 2 * block
        self.bins = block + 1
        freqs = np.fft.rfftfreq(self.N, 1.0 / sr)
        edges = np.geomspace(max(params["res_low_hz"], 60.0), sr / 2, params["res_bands"] + 1)
        edges[0] = 0.0
        edges[-1] = sr
        self.band = np.clip(np.searchsorted(edges, freqs, side="right") - 1, 0, params["res_bands"] - 1)
        self.band_count = np.maximum(np.bincount(self.band, minlength=params["res_bands"]), 1)
        self.low = freqs < params["res_low_hz"]
        self.window = np.hanning(self.N)
        k = int(params["res_freq_smooth_bins"]) | 1
        kernel = np.hanning(k + 2)[1:-1]
        self.kernel = kernel / kernel.sum()
        self.prev_e = np.zeros(block)
        self.prev_y = np.zeros(block)
        self.E2 = np.zeros(self.bins)
        self.Y2 = np.zeros(self.bins)
        self.ratio = np.full(params["res_bands"], params["res_leak_max"])
        self.leak = np.full(params["res_bands"], params["res_leak_max"])
        self.gain_db = np.zeros(self.bins)
        self.prev_gain = np.ones(self.bins)
        self.floor_db = params["res_floor_db"]
        self.min_gain = 0.0
        self.since_active = 10 ** 6

    def _band_mean(self, x):
        return np.bincount(self.band, weights=x, minlength=self.p["res_bands"]) / self.band_count

    def _smooth_freq(self, x):
        k = len(self.kernel) // 2
        padded = np.concatenate([np.full(k, x[0]), x, np.full(k, x[-1])])
        return np.convolve(padded, self.kernel, mode="valid")

    def process(self, e, y, active):
        """e: error block (post filter), y: linear echo estimate block,
        active: the reference is active. Returns the suppressed block."""
        p, B = self.p, self.B
        frame_e = np.concatenate([self.prev_e, e])
        frame_y = np.concatenate([self.prev_y, y])
        self.prev_e, self.prev_y = e.copy(), y.copy()
        E = np.fft.rfft(frame_e)
        self.since_active = self.since_active + 1 if active else 0
        if not (p["res_enabled"] and active):
            self.E2[:] = 0.0
            self.Y2[:] = 0.0
            return self._apply(E, self._slew(np.zeros(self.bins)))

        a = p["res_power_smooth"]
        Ew = np.fft.rfft(frame_e * self.window)
        Yw = np.fft.rfft(frame_y * self.window)
        self.E2 = a * self.E2 + (1 - a) * np.abs(Ew) ** 2
        self.Y2 = a * self.Y2 + (1 - a) * np.abs(Yw) ** 2

        # Leak: error/echo power ratio per band, minimum-follower.
        s = p["res_leak_smooth"]
        be, by = self._band_mean(self.E2), self._band_mean(self.Y2)
        self.ratio = s * self.ratio + (1 - s) * (be / (by + 1e-12))
        rise = 10 ** (p["res_leak_rise_db"] / 10)
        self.leak = np.minimum(self.ratio, np.minimum(self.leak * rise, p["res_leak_max"]))
        leak = self.leak[self.band]

        e2, y2 = self.E2, self.Y2
        if p["res_psd_smooth"]:  # periodogram bins are noisy: average neighbours
            e2, y2 = self._smooth_freq(e2), self._smooth_freq(y2)
        residual = p["res_overestimate"] * leak * y2
        wiener = np.clip(1.0 - residual / (e2 + 1e-12), 0.0, 1.0)
        target_db = 10 * np.log10(np.maximum(wiener, 1e-12))  # power gain in dB
        target_db = np.maximum(target_db, self.floor_db)
        target_db[self.low] = 0.0
        target_db = self._smooth_freq(target_db)
        return self._apply(E, self._slew(target_db))

    def _slew(self, target_db):
        p = self.p
        down = p["res_onset_down_db"] if self.since_active < p["res_onset_blocks"] else p["res_down_db"]
        step = np.clip(target_db - self.gain_db, -down, p["res_up_db"])
        self.gain_db = self.gain_db + step
        return self.gain_db

    def _apply(self, E, gain_db):
        gain = 10 ** (gain_db / 20)
        self.min_gain = float(gain.min())
        B = self.B
        cur = np.fft.irfft(E * gain, self.N)[B:]
        if np.array_equal(gain, self.prev_gain):
            out = cur
        else:
            old = np.fft.irfft(E * self.prev_gain, self.N)[B:]
            ramp = np.linspace(0.0, 1.0, B, endpoint=False)
            out = ramp * cur + (1 - ramp) * old
        self.prev_gain = gain
        return out
