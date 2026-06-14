---
title: Technical Architecture
description: Internal architecture and data flow of AIRecorder.
---

# Technical Architecture

AIRecorder is built on four technological pillars that work together to provide a complete recording, transcription, and audio analysis experience.

## The Four Pillars

| Technology | Role |
|------------|------|
| **Electron** | Desktop window and process management |
| **React** | User interface and state |
| **Python** | Audio processing and transcription |
| **SQLite** | Local data storage |

## Communication Flow (IPC)

AIRecorder follows Electron's process model:

### Main Process (`electron/main.js`)

Manages:
- Windows and browser
- File system
- Python processes
- Database communication

### Renderer Process (React App)

The user interface that interacts with the end user.

### Preload (`electron/preload.js`)

Intermediate file that exposes IPC channels to the renderer securely using `contextBridge`.

### Main IPC Channels

| Channel | Function |
|---------|----------|
| `recording:start` | Starts audio capture |
| `recording:stop` | Stops and saves the WAV file |
| `transcription:process` | Launches Python Whisper process |
| `ai:analyze` | Sends text to AI provider |
| `db:*` | SQLite read/write operations |

## Database (SQLite)

Transcription, project, speaker and configuration metadata are stored in a local SQLite database managed by `better-sqlite3`.

Features:
- Embedded database (no server required)
- Everything lives in a single `.db` file
- Location: `~/Library/Application Support/AIRecorder`

## Transcription Manager

The `electron/transcriptionManager.js` module orchestrates the transcription pipeline:

1. Receives the WAV file
2. Invokes the Python script (`python/audio_sync_analyzer.py`)
3. Captures the JSON output with transcribed segments
4. Stores data in the database
5. If diarization is enabled, runs pyannote to identify speakers