"""Offline acoustic echo cancellation for the microphone track (#174).

Pure numpy. The system track (what the speakers played) is the reference; the
microphone track picks it up again as a delayed, filtered echo. Pipeline:

1. Delay estimation with GCC-PHAT, re-estimated per segment (~20 s) so clock
   drift between both tracks is observed. The reference is aligned a little
   ahead of the earliest estimate so the adaptive filter covers the drift.
2. Partitioned-block frequency-domain adaptive filter (overlap-save) with a
   foreground/background pair for double-talk control: the background filter
   always adapts, the foreground (the one producing output) only takes its
   coefficients when the background clearly performs better.
3. Residual echo suppression (`echo_res.py`): a per-bin, frequency-domain gain
   for what the linear filter cannot predict (loudspeaker distortion, browser
   AEC/AGC). Smoothed in time and frequency, it protects near-end speech.
4. Warm start: the filter starts from zero, so the first system-audio
   intervention would be barely cancelled while it converges. Offline we can
   afford a short pre-pass over the first seconds of active reference and start
   the real pass (from t=0) with those weights (`warm_up`).
5. Echo gain tracking: the mic path may have a time-varying gain (browser AGC),
   which a static filter cannot follow, so a fast scalar gain is applied to the
   filter output.
6. Safeguards: a global gate (no coherent echo or silent reference -> the mic
   is returned untouched) and a local per-block fallback to the mic, with
   crossfades, whenever the processed block would be louder than the mic.

Processing is block based (`EchoCanceller`), so streamed and whole-array runs
produce the same samples and memory stays bounded.
"""

import numpy as np

from echo_res import RES_PARAMS, ResidualSuppressor

DEFAULT_PARAMS = {
    # Adaptive filter
    "block_size": 1024,
    "filter_ms": 256.0,
    "step_size": 0.5,
    "power_smoothing": 0.9,
    "regularization": 1e-6,
    # Foreground/background double-talk control
    "copy_ratio": 0.8,  # copy background -> foreground when e_b < ratio * e_f
    "reset_ratio": 4.0,  # reset background when e_b > ratio * e_f ...
    "reset_blocks": 8,  # ... for this many consecutive blocks
    # Delay estimation
    "segment_seconds": 20.0,
    "max_delay_ms": 1000.0,
    # GCC-PHAT band: bins outside the speech band carry mostly noise and
    # interpolation artefacts, and PHAT would give them full weight.
    "gcc_low_hz": 100.0,
    "gcc_high_hz": 6000.0,
    "pre_margin_ms": 10.0,
    "min_drift_ppm": 2.0,  # below this, drift is left to the adaptive filter
    "max_drift_ppm": 1000.0,
    "min_drift_segments": 3,
    # Global gate
    "coherence_threshold": 12.0,  # GCC-PHAT peak / correlation spread
    "ref_silence_rms": 1e-5,
    "ref_active_rms": 1e-3,
    "min_erle_db": 3.0,
    # Local fallback
    "fallback_margin_db": 0.0,
    # Echo gain tracking (scalar LS gain between the mic and the filter output)
    "gain_tracking": True,
    "gain_smoothing": 0.6,
    "gain_min": 0.5,
    "gain_max": 3.0,
    # Warm start pre-pass: stops after this much active reference (or EOF)
    "warm_active_seconds": 20.0,
    # Residual echo suppression (frequency domain, see echo_res.py)
    **RES_PARAMS,
}


def _params(params):
    merged = dict(DEFAULT_PARAMS)
    if params:
        merged.update(params)
    return merged


def gcc_phat(mic, ref, sr, max_delay_ms=1000.0, low_hz=100.0, high_hz=6000.0):
    """GCC-PHAT between two equal-length segments.

    Returns (lag_samples, coherence): lag > 0 when mic lags ref; coherence is
    the peak height relative to the spread of the correlation (high for a real
    echo, low for unrelated signals).
    """
    mic = np.asarray(mic, dtype=np.float64)
    ref = np.asarray(ref, dtype=np.float64)
    n = min(len(mic), len(ref))
    if n == 0:
        return 0, 0.0
    size = 1 << (2 * n - 1).bit_length()
    cross = np.fft.rfft(mic[:n], size) * np.conj(np.fft.rfft(ref[:n], size))
    freqs = np.fft.rfftfreq(size, 1.0 / sr)
    band = (freqs >= low_hz) & (freqs <= min(high_hz, 0.45 * sr))
    cross = np.where(band, cross / (np.abs(cross) + 1e-12), 0.0)
    corr = np.fft.irfft(cross, size)
    max_lag = min(int(sr * max_delay_ms / 1000), n - 1)
    lags = np.concatenate([corr[size - max_lag:], corr[: max_lag + 1]])
    idx = int(np.argmax(lags))
    peak = lags[idx]
    spread = np.std(lags) + 1e-12
    return idx - max_lag, float(peak / spread)


def estimate_delay(mic, ref, sr, params=None):
    """Delay of the echo in mic relative to ref, in milliseconds."""
    p = _params(params)
    lag, _ = gcc_phat(mic, ref, sr, p["max_delay_ms"], p["gcc_low_hz"], p["gcc_high_hz"])
    return 1000.0 * lag / sr


def _rms(x):
    x = np.asarray(x, dtype=np.float64)
    return float(np.sqrt(np.mean(x * x))) if len(x) else 0.0


class SegmentAnalyzer:
    """Accumulates per-segment delay estimates (bounded memory)."""

    def __init__(self, sr, params=None):
        self.sr = sr
        self.p = _params(params)
        self.segments = []  # (center_sample, delay_samples, coherence), coherent only
        self.ref_peak_rms = 0.0
        self.position = 0

    def add(self, mic_seg, ref_seg):
        n = min(len(mic_seg), len(ref_seg))
        center = self.position + n / 2.0
        self.position += len(mic_seg)
        if n < self.sr:  # less than a second: not worth estimating
            return
        ref_rms = _rms(ref_seg[:n])
        self.ref_peak_rms = max(self.ref_peak_rms, ref_rms)
        if ref_rms < self.p["ref_active_rms"]:
            return
        lag, coherence = gcc_phat(mic_seg[:n], ref_seg[:n], self.sr, self.p["max_delay_ms"],
                                  self.p["gcc_low_hz"], self.p["gcc_high_hz"])
        if coherence >= self.p["coherence_threshold"]:
            self.segments.append((center, lag, coherence))

    def decision(self):
        """Returns a dict: reason, delay (median, samples), align (samples at
        t=0 fed to EchoCanceller), drift_ratio and the per-segment delays."""
        result = {"reason": None, "delay": None, "align": None, "drift_ratio": 0.0, "delays_ms": []}
        if self.ref_peak_rms < self.p["ref_silence_rms"]:
            result["reason"] = "ref_silent"
            return result
        if not self.segments:
            result["reason"] = "no_echo"
            return result
        centers = np.array([c for c, _, _ in self.segments])
        lags = np.array([lag for _, lag, _ in self.segments], dtype=np.float64)
        margin = self.sr * self.p["pre_margin_ms"] / 1000
        result["delay"] = int(np.median(lags))
        result["delays_ms"] = [round(1000.0 * lag / self.sr, 2) for lag in lags]
        result["align"] = int(lags.min() - margin)
        if len(lags) >= self.p["min_drift_segments"]:
            slope, intercept = np.polyfit(centers, lags, 1)
            ppm = abs(slope) * 1e6
            if self.p["min_drift_ppm"] <= ppm <= self.p["max_drift_ppm"]:
                # lag(t) = intercept + slope * t  =>  x[t] = ref[t * (1 - slope) - (intercept - margin)]
                result["drift_ratio"] = -float(slope)
                result["align"] = float(intercept - margin)
        return result


class RefResampler:
    """Streaming windowed-sinc resampler: x[t] = ref[t * (1 + ratio) - delay].

    Compensates clock drift between the mic and system tracks so the adaptive
    filter only has to model the room, not a moving delay.
    """

    def __init__(self, delay, ratio, half_taps=32, beta=8.0):
        self.delay = float(delay)
        self.ratio = float(ratio)
        self.H = half_taps
        self.beta = beta
        self.buf = np.zeros(0)
        self.base = 0  # absolute ref index of buf[0]
        self.t = 0  # next output index
        self.offsets = np.arange(-self.H + 1, self.H + 1)

    def _positions(self, count):
        t = np.arange(self.t, self.t + count, dtype=np.float64)
        return t * (1.0 + self.ratio) - self.delay

    def _render(self, count, batch=4096):
        parts = []
        while count > 0:
            step = min(batch, count)
            parts.append(self._render_batch(step))
            count -= step
        return np.concatenate(parts) if parts else np.zeros(0)

    def _render_batch(self, count):
        pos = self._positions(count)
        i0 = np.floor(pos).astype(np.int64)
        idx = i0[:, None] + self.offsets[None, :]
        dist = pos[:, None] - idx
        window = np.kaiser(2 * self.H + 1, self.beta)
        w = np.sinc(dist) * np.interp(dist, np.arange(-self.H, self.H + 1), window)
        rel = idx - self.base
        valid = (idx >= 0) & (rel >= 0) & (rel < len(self.buf))
        samples = np.where(valid, self.buf[np.clip(rel, 0, max(len(self.buf) - 1, 0))] if len(self.buf) else 0.0, 0.0)
        self.t += count
        return np.sum(samples * w, axis=1)

    def push(self, ref_block):
        self.buf = np.concatenate([self.buf, np.asarray(ref_block, dtype=np.float64)])
        # Outputs whose whole kernel is already buffered.
        last_needed = lambda t: int(np.floor(t * (1.0 + self.ratio) - self.delay)) + self.H
        available = self.base + len(self.buf)
        lo, hi = self.t, self.t + int(len(self.buf) / max(1e-9, 1.0 + self.ratio)) + 2 * self.H + 2
        while lo < hi:  # first t whose kernel is not fully available
            mid = (lo + hi) // 2
            if last_needed(mid) < available:
                lo = mid + 1
            else:
                hi = mid
        out = self._render(lo - self.t) if lo > self.t else np.zeros(0)
        self._trim()
        return out

    def flush(self, count):
        return self._render(count) if count > 0 else np.zeros(0)

    def _trim(self):
        first = int(np.floor(self.t * (1.0 + self.ratio) - self.delay)) - self.H
        drop = min(max(0, first - self.base), len(self.buf))
        if drop:
            self.buf = self.buf[drop:]
            self.base += drop


class EchoCanceller:
    """Block-based PBFDAF echo canceller with streaming input/output."""

    def __init__(self, sr, delay_samples, params=None, drift_ratio=0.0):
        self.sr = sr
        self.p = _params(params)
        self.B = int(self.p["block_size"])
        self.P = max(1, int(np.ceil(sr * self.p["filter_ms"] / 1000 / self.B)))
        bins = self.B + 1
        self.Wf = np.zeros((self.P, bins), dtype=np.complex128)
        self.Wb = np.zeros((self.P, bins), dtype=np.complex128)
        self.X = np.zeros((self.P, bins), dtype=np.complex128)
        self.power = np.zeros(bins)
        self.prev_ref = np.zeros(self.B)
        self.mic_buf = np.zeros(0)
        integer_delay = 0 if drift_ratio else int(delay_samples)
        self.ref_buf = np.zeros(max(0, integer_delay))
        self.ref_skip = max(0, -integer_delay)
        self.resampler = None
        if drift_ratio:
            self.resampler = RefResampler(delay_samples, drift_ratio)
            self.ref_buf = np.zeros(0)
            self.ref_skip = 0
        self.mic_total = 0
        self.emitted = 0
        self.dtype = None
        self.weight = 1.0
        self.res = ResidualSuppressor(sr, self.B, self.p)
        self.echo_gain = 1.0
        self.gain_num = 0.0
        self.gain_den = 0.0
        self.active_blocks = 0
        self.bad_blocks = 0
        self.stats = {"mic_energy": 0.0, "out_energy": 0.0, "blocks": 0, "fallback_blocks": 0}

    # -- streaming ---------------------------------------------------------
    def process(self, mic_block, ref_block):
        mic_block = np.asarray(mic_block)
        if self.dtype is None:
            self.dtype = mic_block.dtype if mic_block.dtype.kind == "f" else np.dtype(np.float32)
        self.mic_total += len(mic_block)
        self.mic_buf = np.concatenate([self.mic_buf, mic_block.astype(np.float64)])
        ref_block = np.asarray(ref_block, dtype=np.float64)
        if self.resampler is not None:
            ref_block = self.resampler.push(ref_block)
        if self.ref_skip:
            drop = min(self.ref_skip, len(ref_block))
            ref_block = ref_block[drop:]
            self.ref_skip -= drop
        self.ref_buf = np.concatenate([self.ref_buf, ref_block])
        return self._drain()

    def flush(self):
        if self.dtype is None:
            self.dtype = np.dtype(np.float32)
        remaining = self.mic_total - self.emitted
        pending = len(self.mic_buf)
        if pending:
            pad = (-pending) % self.B
            self.mic_buf = np.concatenate([self.mic_buf, np.zeros(pad)])
            need = len(self.mic_buf) - len(self.ref_buf)
            if need > 0:
                tail = self.resampler.flush(need) if self.resampler is not None else np.zeros(need)
                self.ref_buf = np.concatenate([self.ref_buf, tail])
        out = self._drain()
        return out[:remaining]

    def _drain(self):
        blocks = []
        B = self.B
        while len(self.mic_buf) >= B and len(self.ref_buf) >= B:
            d, x = self.mic_buf[:B], self.ref_buf[:B]
            self.mic_buf, self.ref_buf = self.mic_buf[B:], self.ref_buf[B:]
            blocks.append(self._process_block(d, x))
        if not blocks:
            return np.zeros(0, dtype=self.dtype)
        out = np.concatenate(blocks)
        out = out[: max(0, self.mic_total - self.emitted)]
        self.emitted += len(out)
        return out.astype(self.dtype)

    # -- DSP ---------------------------------------------------------------
    def _filter(self, W):
        Y = np.sum(W * self.X, axis=0)
        return np.fft.irfft(Y, 2 * self.B)[self.B:]

    def _adapt(self, W, e):
        p, B = self.p, self.B
        E = np.fft.rfft(np.concatenate([np.zeros(B), e]))
        norm = p["step_size"] / (self.P * self.power + p["regularization"] * 2 * B)
        G = np.conj(self.X) * (E * norm)
        g = np.fft.irfft(G, 2 * B, axis=1)
        g[:, B:] = 0.0
        W += np.fft.rfft(g, axis=1)

    def _process_block(self, d, x):
        p, B = self.p, self.B
        Xk = np.fft.rfft(np.concatenate([self.prev_ref, x]))
        self.prev_ref = x
        self.X = np.roll(self.X, 1, axis=0)
        self.X[0] = Xk
        a = p["power_smoothing"]
        self.power = a * self.power + (1 - a) * np.abs(Xk) ** 2

        y_f = self._filter(self.Wf)
        y_b = self._filter(self.Wb)
        if p["gain_tracking"]:
            a = p["gain_smoothing"]
            # Only learn the gain while the reference is playing; during ref
            # silence d/y_f would be a noise ratio, not an echo gain.
            if _rms(x) >= p["ref_active_rms"]:
                self.gain_num = a * self.gain_num + (1 - a) * float(np.dot(d, y_f))
                self.gain_den = a * self.gain_den + (1 - a) * float(np.dot(y_f, y_f))
            if self.gain_den > 1e-9:
                self.echo_gain = float(np.clip(self.gain_num / self.gain_den, p["gain_min"], p["gain_max"]))
            y_f = y_f * self.echo_gain
        e_f = d - y_f
        e_b = d - y_b
        ef_energy = float(np.dot(e_f, e_f))
        eb_energy = float(np.dot(e_b, e_b))
        mic_energy = float(np.dot(d, d))

        # Background always adapts; foreground follows only when it wins.
        self._adapt(self.Wb, e_b)
        if eb_energy < p["copy_ratio"] * ef_energy:
            self.Wf[:] = self.Wb
            self.bad_blocks = 0
        elif eb_energy > p["reset_ratio"] * ef_energy:
            self.bad_blocks += 1
            if self.bad_blocks >= p["reset_blocks"]:
                self.Wb[:] = self.Wf
                self.bad_blocks = 0
        else:
            self.bad_blocks = 0

        ref_active = _rms(x) >= p["ref_active_rms"]
        self.active_blocks += int(ref_active)
        e = e_f

        # Local fallback to the mic, with a crossfade across the block.
        limit = mic_energy * 10 ** (p["fallback_margin_db"] / 10)
        target_w = 1.0 if float(np.dot(e, e)) <= limit else 0.0
        ramp = np.linspace(self.weight, target_w, B, endpoint=False) if target_w != self.weight else target_w
        out = ramp * e + (1 - ramp) * d
        if float(np.dot(out, out)) > limit:
            out = d.copy()
        self.weight = target_w
        # Also runs on blocks that fell back to the mic: it only attenuates the
        # bins the model sees as echo, so a fallback block is not left untouched.
        out = self.res.process(out, y_f, ref_active)
        if target_w == 0.0:
            self.stats["fallback_blocks"] += 1

        if ref_active:
            self.stats["mic_energy"] += mic_energy
            self.stats["out_energy"] += float(np.dot(out, out))
        self.stats["blocks"] += 1
        return out

    # -- warm start ----------------------------------------------------------
    def active_seconds(self):
        return self.active_blocks * self.B / self.sr

    def warm_up_done(self):
        return self.active_seconds() >= self.p["warm_active_seconds"]

    def export_state(self):
        return {"W": self.Wf.copy(), "power": self.power.copy()}

    def import_state(self, state):
        self.Wf[:] = state["W"]
        self.Wb[:] = state["W"]
        self.power[:] = state["power"]

    def erle_db(self):
        if self.stats["mic_energy"] <= 0:
            return 0.0
        return float(10 * np.log10(self.stats["mic_energy"] / (self.stats["out_energy"] + 1e-20)))


def _report(applied, reason, delay_ms=None, **extra):
    report = {"applied": applied, "reason": reason, "delay_ms": delay_ms}
    report.update(extra)
    return report


def analyze(mic, ref, sr, params=None):
    """Runs the segment analysis over whole arrays."""
    p = _params(params)
    analyzer = SegmentAnalyzer(sr, p)
    seg = int(sr * p["segment_seconds"])
    n = min(len(mic), len(ref))
    for start in range(0, max(n, 1), seg):
        analyzer.add(mic[start:start + seg], ref[start:start + seg])
    return analyzer


def warm_up_stream(blocks, sr, decision, params=None):
    """Streaming pre-pass shared by the CLI and `warm_up`; returns the converged state.

    `blocks` yields (mic_block, ref_block) pairs of equal length. Runs a
    throwaway canceller (output discarded) and stops consuming as soon as
    `warm_active_seconds` of active reference were seen, or the input ends.
    """
    p = dict(_params(params), res_enabled=False)  # only the filter weights are kept
    canceller = EchoCanceller(sr, decision["align"], p, drift_ratio=decision["drift_ratio"])
    for mic_block, ref_block in blocks:
        canceller.process(mic_block, ref_block)
        if canceller.warm_up_done():
            break
    return canceller.export_state()


def warm_up(mic, ref, sr, decision, params=None):
    """Whole-array wrapper over `warm_up_stream` (see there)."""
    step = int(_params(params)["block_size"]) * 16
    ref_fit = ref[: len(mic)]
    if len(ref_fit) < len(mic):
        ref_fit = np.concatenate([ref_fit, np.zeros(len(mic) - len(ref_fit), dtype=ref.dtype)])
    blocks = ((mic[i:i + step], ref_fit[i:i + step]) for i in range(0, len(mic), step))
    return warm_up_stream(blocks, sr, decision, params)


def cancel_echo(mic, ref, sr, params=None):
    """Cancels the echo of ref in mic. Returns (out, report).

    When report["applied"] is False, out is mic itself (bit-identical).
    """
    p = _params(params)
    mic = np.asarray(mic)
    ref = np.asarray(ref)
    decision = analyze(mic, ref, sr, p).decision()
    if decision["reason"]:
        return mic, _report(False, decision["reason"])
    delay_ms = 1000.0 * decision["delay"] / sr
    delays_ms = decision["delays_ms"]
    canceller = EchoCanceller(sr, decision["align"], p, drift_ratio=decision["drift_ratio"])
    canceller.import_state(warm_up(mic, ref, sr, decision, p))
    ref_fit = ref[: len(mic)]
    if len(ref_fit) < len(mic):
        ref_fit = np.concatenate([ref_fit, np.zeros(len(mic) - len(ref_fit), dtype=ref.dtype)])
    out = np.concatenate([canceller.process(mic, ref_fit), canceller.flush()]).astype(mic.dtype)
    erle = canceller.erle_db()
    extra = {"erle_db": round(erle, 2), "segment_delays_ms": delays_ms,
             "drift_ppm": round(decision["drift_ratio"] * 1e6, 2),
             "fallback_blocks": canceller.stats["fallback_blocks"]}
    if erle < p["min_erle_db"]:
        return mic, _report(False, "low_erle", delay_ms, **extra)
    return out, _report(True, None, delay_ms, **extra)
