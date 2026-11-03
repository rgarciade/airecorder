"""`audio_sync_analyzer.py echo-cancel` subcommand (#174).

    echo-cancel --mic <in> --ref <in> --out <out.webm> [--ffmpeg <ffmpeg>]

Both inputs are decoded by ffmpeg to mono float32 at 48 kHz and streamed in
blocks (bounded memory) through two passes:
  1. Segment analysis (delay, drift, coherence gate) -> decides whether to act.
  2. Echo cancellation, encoded to webm/opus in a temporary file next to --out.
The temporary file only becomes --out when the result passes the final check.

The last stdout line is always `ECHO_RESULT {json}` on success (exit 0).
On errors the process prints `ECHO_ERROR <message>` to stderr, exits 1 and
leaves no --out file behind.
"""

import argparse
import json
import os
import subprocess
import sys
import tempfile

import numpy as np

from echo_canceller import DEFAULT_PARAMS, EchoCanceller, SegmentAnalyzer

SAMPLE_RATE = 48000
READ_SECONDS = 1.0
OPUS_BITRATE = "96k"


class EchoCancelError(Exception):
    pass


class _ArgumentParser(argparse.ArgumentParser):
    def error(self, message):
        raise EchoCancelError(f"invalid arguments: {message}")


class Decoder:
    """Streams an audio file as mono float32 blocks through ffmpeg."""

    def __init__(self, ffmpeg, path):
        if not os.path.isfile(path):
            raise EchoCancelError(f"input not found: {path}")
        self.path = path
        self.stderr = tempfile.TemporaryFile()
        self.proc = subprocess.Popen(
            [ffmpeg, "-v", "error", "-nostdin", "-i", path, "-vn", "-ac", "1",
             "-ar", str(SAMPLE_RATE), "-f", "f32le", "-"],
            stdout=subprocess.PIPE, stderr=self.stderr,
        )
        self.done = False
        self.total = 0

    def read(self, samples):
        if self.done:
            return np.zeros(0, dtype=np.float32)
        data = self.proc.stdout.read(samples * 4)
        if len(data) < samples * 4:
            self.done = True
        data = data[: len(data) - len(data) % 4]
        block = np.frombuffer(data, dtype="<f4").astype(np.float32)
        self.total += len(block)
        return block

    def close(self):
        self.proc.stdout.close()
        code = self.proc.wait()
        self.stderr.seek(0)
        message = self.stderr.read().decode("utf-8", "replace").strip()
        self.stderr.close()
        if code != 0:
            raise EchoCancelError(f"cannot decode {os.path.basename(self.path)}: {message[-300:]}")
        if self.total == 0:
            raise EchoCancelError(f"no audio in {os.path.basename(self.path)}")


def _stream_pairs(ffmpeg, mic_path, ref_path, block):
    """Yields (mic_block, ref_block); ref is zero-padded/trimmed to the mic."""
    mic, ref = Decoder(ffmpeg, mic_path), Decoder(ffmpeg, ref_path)
    try:
        while True:
            m = mic.read(block)
            if len(m) == 0:
                break
            r = ref.read(len(m))
            if len(r) < len(m):
                r = np.concatenate([r, np.zeros(len(m) - len(r), dtype=np.float32)])
            yield m, r
        while not ref.done:  # drain so ffmpeg exits cleanly
            ref.read(block)
    finally:
        try:
            mic.close()
        finally:
            ref.close()


def _analyze(ffmpeg, mic_path, ref_path, params):
    analyzer = SegmentAnalyzer(SAMPLE_RATE, params)
    segment = int(SAMPLE_RATE * params["segment_seconds"])
    for m, r in _stream_pairs(ffmpeg, mic_path, ref_path, segment):
        analyzer.add(m, r)
    return analyzer.decision()


def _cancel(ffmpeg, mic_path, ref_path, decision, params, tmp_out):
    canceller = EchoCanceller(SAMPLE_RATE, decision["align"], params, drift_ratio=decision["drift_ratio"])
    encoder_log = tempfile.TemporaryFile()
    encoder = subprocess.Popen(
        [ffmpeg, "-y", "-v", "error", "-nostdin", "-f", "f32le", "-ar", str(SAMPLE_RATE), "-ac", "1",
         "-i", "-", "-c:a", "libopus", "-b:a", OPUS_BITRATE, "-f", "webm", tmp_out],
        stdin=subprocess.PIPE, stderr=encoder_log,
    )
    try:
        block = int(SAMPLE_RATE * READ_SECONDS)
        for m, r in _stream_pairs(ffmpeg, mic_path, ref_path, block):
            encoder.stdin.write(canceller.process(m, r).astype("<f4").tobytes())
        encoder.stdin.write(canceller.flush().astype("<f4").tobytes())
    finally:
        encoder.stdin.close()
        code = encoder.wait()
        encoder_log.seek(0)
        err = encoder_log.read().decode("utf-8", "replace").strip()
        encoder_log.close()
    if code != 0:
        raise EchoCancelError(f"encoder failed: {err[-300:]}")
    return canceller


def run(argv):
    parser = _ArgumentParser(prog="audio_sync_analyzer echo-cancel")
    parser.add_argument("--mic", required=True)
    parser.add_argument("--ref", required=True)
    parser.add_argument("--out", required=True)
    parser.add_argument("--ffmpeg", default="ffmpeg")
    args = parser.parse_args(argv)
    params = dict(DEFAULT_PARAMS)

    decision = _analyze(args.ffmpeg, args.mic, args.ref, params)
    if decision["reason"]:
        return {"applied": False, "reason": decision["reason"], "delay_ms": None}

    delay_ms = round(1000.0 * decision["delay"] / SAMPLE_RATE, 2)
    out_dir = os.path.dirname(os.path.abspath(args.out))
    fd, tmp_out = tempfile.mkstemp(prefix=".echo-", suffix=".webm", dir=out_dir)
    os.close(fd)
    try:
        canceller = _cancel(args.ffmpeg, args.mic, args.ref, decision, params, tmp_out)
        erle = canceller.erle_db()
        report = {
            "applied": erle >= params["min_erle_db"],
            "reason": None if erle >= params["min_erle_db"] else "low_erle",
            "delay_ms": delay_ms,
            "erle_db": round(erle, 2),
            "drift_ppm": round(decision["drift_ratio"] * 1e6, 2),
            "segment_delays_ms": [float(d) for d in decision["delays_ms"]],
            "fallback_blocks": canceller.stats["fallback_blocks"],
        }
        if report["applied"]:
            os.replace(tmp_out, args.out)
        return report
    finally:
        if os.path.exists(tmp_out):
            os.remove(tmp_out)


def main(argv):
    try:
        report = run(argv)
    except EchoCancelError as error:
        print(f"ECHO_ERROR {error}", file=sys.stderr, flush=True)
        return 1
    except Exception as error:  # noqa: BLE001 - always report with the ECHO tag
        print(f"ECHO_ERROR unexpected {type(error).__name__}: {error}", file=sys.stderr, flush=True)
        return 1
    print("ECHO_RESULT " + json.dumps(report), flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
