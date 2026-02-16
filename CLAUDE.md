# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Language

RESPONDE SIEMPRE EN ESPAÑOL. La UI y logs usan español; los nombres de variables y funciones van en inglés (camelCase/PascalCase).

## What is AIRecorder?

A macOS desktop app (Electron + React + Python) for audio recording with AI-powered transcription and analysis. Records dual-channel audio (microphone + system), transcribes via OpenAI Whisper (Python), and provides AI summaries/chat via Gemini or Ollama.

## Prerequisites

- Node.js v18+
- Python 3.x with virtual environment in `venv/`
- System audio dependencies: ffmpeg, sox

## Commands

| Action | Command |
|--------|---------|
| Dev (frontend + electron) | `npm run dev` |
| Lint | `npm run lint` |
| Build frontend | `npm run build` |
| Build macOS DMG | `npm run electron:build` |
| Reset onboarding | `npm run reset:onboarding` |
| Rebuild native modules | `npm run rebuild` |

No automated tests exist. Manual testing via `npm run dev`. If adding tests, use Vitest.

## Architecture

### Three-layer system

1. **React renderer** (`src/`) — UI with React 18, Redux Toolkit, Tailwind CSS. Navigation is view-based via `currentView` state in `App.jsx` (not URL-based routing despite react-router-dom being installed).
2. **Electron main process** (`electron/`) — CommonJS. Handles IPC, SQLite DB, file system, spawns Python processes. `main.js` is the central hub with all `ipcMain.handle()` registrations.
3. **Python audio processor** (`audio_sync_analyzer.py`) — Whisper transcription, librosa analysis. Spawned via `child_process.spawn`. Reports progress via `PROGRESS:XX` on stdout.

### IPC communication

Frontend calls `window.electronAPI.*` (exposed via `electron/preload.js` context bridge) which maps to `ipcMain.handle()` in `electron/main.js`. All IPC handlers must have try/catch and return `{success, data/error}` pattern. The preload bridge maintains sandbox security — no `require` or `process` exposed to renderer.

### State management

- **Redux Toolkit** (`src/store/recordingSlice.js`): recording state (isRecording, isPaused, duration, audioLevel)
- **React Context** (`src/contexts/AiProcessingContext.jsx`): AI task tracking `{[id]: {type, status, error}}`
- **Component-local state**: everything else
- **Queue updates**: Main process emits `queue-update` via `win.webContents.send()`, listened in `App.jsx` via `window.electronAPI.onQueueUpdate()`

### Database

SQLite via better-sqlite3 (synchronous) in `electron/database/`. WAL mode, foreign keys enabled. Auto-migrations run on startup via `dbService.init()` — creates tables with `IF NOT EXISTS` and adds missing columns with `ALTER TABLE`. Resets stuck `processing` tasks on startup. Tables: recordings, projects, project_recordings, transcription_queue, chats, messages.

### Dual storage pattern

- **DB**: Metadata and state (status, duration, model, timestamps)
- **Filesystem**: Content (WAV audio files, `analysis/` subfolder with JSON/TXT transcriptions, `ai_summary.json`)
- `migrationService.syncRecordings()` reconciles both sources on startup

### Recording ID resolution

`recordingId` can be either a numeric DB ID or a string folder name (relative_path). `getFolderPathFromId()` in `electron/main.js` translates numeric IDs to folder paths. Be aware of this duality when working with recording references.

### Transcription pipeline

Sequential queue managed by `electron/transcriptionManager.js`:
1. Frontend enqueues via `window.electronAPI.transcribeRecording(recordingId, model)`
2. Task inserted into `transcription_queue` table (status: `pending`)
3. Only one transcription active at a time (`this.activeTask` guard)
4. Python spawned: `audio_sync_analyzer.py --basename <folder> --model <whisper_model>`
5. Progress parsed from stdout (`PROGRESS:XX`) → updates DB → emits `queue-update`
6. On completion: updates recording status to `transcribed`, sends native notification

### AI providers

Pluggable via `src/services/aiService.js` — delegates to `geminiProvider.js` (Google Generative AI API) or `ollamaProvider.js` (local) based on `settings.aiProvider`. Provider selection is runtime-configurable.

**AI analysis flow** (triggered from RecordingDetail):
1. Fetches transcription text
2. Generates detailed summary → short summary → key points → participants (sequential calls)
3. Saves combined result as `ai_summary.json` in the recording's `analysis/` folder
4. Updates DB status to `analyzed`

Prompt templates live in `src/prompts/aiPrompts.js`. All force Spanish output and use a custom key-points format: `--|-- keyword --|-- description`.

### Key directories

- `src/pages/` — full views (Home, Projects, ProjectDetail, RecordingDetail, Settings, Onboarding, TranscriptionQueue)
- `src/components/` — reusable UI (RecordButton, RecordingOverlay, AudioPlayer, ChatInterface, Sidebar)
- `src/services/` — frontend business logic wrapping `electronAPI` calls
- `src/prompts/` — AI prompt templates
- `electron/database/` — SQLite service (`dbService.js`), migrations, queries

## Conventions

- Components: PascalCase files + CSS Modules (`Component.module.css`)
- Electron main process: CommonJS `require()`
- Python: PEP 8, class-based, Spanish comments
- Import order: 3rd party → local components → styles
- IPC handlers return `{success, data/error}` pattern
- User-facing strings in Spanish, code identifiers in English
- Backwards compatibility: code supports both `ai_summary.json` and legacy `gemini_summary.json`
- Some file paths are hardcoded to the developer's machine (e.g., `BASE_RECORDER_PATH` on Desktop, Python venv path) — preserve them unless explicitly refactoring for portability
- Do not modify `package.json` or `requirements.txt` unless explicitly asked to add dependencies
