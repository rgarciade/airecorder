# 0001. Cancel system-audio echo in the mic track offline, after recording

- **Status**: accepted
- **Date**: 2026-11-12
- **Task**: #174

## Context

When a meeting plays through the speakers, the mic track also captures the system audio, so the same speech ends up in both tracks and is transcribed twice. Chromium's own echo cancellation on `getUserMedia` does not remove it, because system audio is captured separately and is not its playback reference. The app already records the system audio as its own track, so we have a clean reference for the whole recording.

## Decision

After Stop & Save, the main process runs an `echo-cancel` subcommand of the bundled Python binary. It uses the system track as the reference, in pure numpy, with no new dependencies. The pipeline is:

1. Per-segment delay and drift estimation.
2. A partitioned-block frequency-domain adaptive filter, warmed up on the first seconds of active reference so it is already converged when the first system audio starts.
3. A scalar echo-gain tracker for the mic's automatic gain control.
4. A frequency-domain residual echo suppressor with a gain floor and a limited attack.

It always runs, behind a gate. When the echo is not coherent or the cleaning does not help enough (for example with headphones), the mic file is left byte-identical. When it applies, the original is kept as `{base}-microphone-original.webm` and the cleaned track takes the name `{base}-microphone.webm`, so the database, transcription and UI need no changes. Transcription of that recording waits for the cleaning, and a failed cleaning never blocks saving or transcribing.

## Alternatives considered

- **Real-time AEC at capture (macOS Voice Processing / Chromium system AEC)**: not available the same way on Windows, unverified with our Chromium version, and it would change the capture path that all recordings depend on.
- **Native AEC libraries (speexdsp, WebRTC APM bindings)**: they need native builds for macOS arm64 and Windows inside PyInstaller, and they are designed for streaming, not for an offline pass that can look at the whole file.
- **Overwrite the mic file without a backup**: cheaper on disk, but a bad cleaning could not be undone and re-running would not be idempotent.

## Consequences

- Recordings with echo use more disk, because they keep the original mic track.
- Re-running the cleaning (for example in a later batch task for old recordings) always starts from the original.
- The `-microphone.webm` / `-microphone-original.webm` naming is now a contract: the analyzer glob and the UI regex must not match the backup name.
- With laptop built-in speakers and mic, the echo is partly nonlinear. A small residual remains right when the system audio starts, about -13 dB.
- Cleaning adds roughly a few seconds per minute of audio before transcription starts.
- The DSP thresholds are tuned on a few real recordings and may need adjusting.
