<div align="center">
  <img src="build/icon.png" alt="AIRecorder" width="120" />

  <h1>AIRecorder</h1>

  <p>Desktop audio recorder with AI-powered transcription, summaries, and chat</p>

  ![Version](https://img.shields.io/badge/version-0.3.2-blue?style=flat-square)
  ![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows-lightgrey?style=flat-square)
  ![Electron](https://img.shields.io/badge/Electron-31-47848F?style=flat-square&logo=electron)
  ![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react)
  ![Python](https://img.shields.io/badge/Python-3.10+-3776AB?style=flat-square&logo=python)
  ![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)
</div>

---

## What is AIRecorder?

AIRecorder captures both your **microphone** and **system audio** simultaneously, transcribes them with [OpenAI Whisper](https://github.com/openai/whisper), and lets you chat with the content using your AI provider of choice — all running locally or via cloud APIs.

Perfect for meetings, interviews, lectures, and any audio you need to revisit.

## Features

- **Dual-channel recording** — captures microphone and system audio as separate tracks
- **AI transcription** — powered by [faster-whisper](https://github.com/SYSTRAN/faster-whisper), runs locally with no data sent to the cloud
- **Multiple AI providers** — Gemini, Ollama, LM Studio, DeepSeek, Kimi
- **Chat with recordings** — ask questions about any transcription
- **Projects** — group recordings, generate summaries, timelines and task suggestions
- **Transcription queue** — processes recordings one at a time in the background
- **Multi-language UI** — Spanish and English support via i18next

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop shell | Electron 31 |
| Frontend | React 18 + Vite + TailwindCSS |
| Database | SQLite via better-sqlite3 |
| Transcription | Python 3 + faster-whisper |
| AI chat | Gemini / Ollama / LM Studio / DeepSeek / Kimi |
| State management | Redux Toolkit |

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v20+
- [Python](https://www.python.org/) 3.10+

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/rgarciade/airecorder.git
cd airecorder

# 2. Install Node dependencies
npm install

# 3. Rebuild native modules for Electron
npm rebuild better-sqlite3 --runtime=electron --target=31.7.7 --dist-url=https://electronjs.org/headers --build-from-source

# 4. Install Python dependencies
pip install -r requirements.txt
```

### Run in development

```bash
npm run dev
```

This starts Vite (port 5173) and Electron concurrently. Hot reload is enabled for the React frontend.

## Project Structure

```
airecorder/
├── electron/               # Main process (Node.js / Electron)
│   ├── ipc-handlers/       # IPC communication handlers
│   ├── services/           # Transcription queue, audio, update checker
│   └── database/           # SQLite schema, queries, migrations
├── src/                    # Renderer process (React)
│   ├── pages/              # Full-page views (Home, Projects, Settings…)
│   ├── components/         # Reusable UI components
│   └── services/           # Audio capture, AI providers, Redux store
├── python/                 # Audio processing & transcription backend
│   └── audio_sync_analyzer.py
├── scripts/                # Build utilities (obfuscation, ASAR protection…)
└── requirements.txt        # Python dependencies
```

> Each major folder has its own `README.md` with in-depth documentation.

## Building for Production

### macOS (DMG)

```bash
npm run electron:build
```

Outputs `dist-electron/AIRecorder-<version>-arm64.dmg`.

The build pipeline:
1. Compiles Python with PyInstaller
2. Builds the React frontend with Vite
3. Obfuscates Electron source
4. Packages with electron-builder
5. Applies ASAR protection

### Windows

Windows builds are not yet automated. Run the app in development mode with `npm run dev`.

## Contributing

Contributions are welcome! Here is how to get started:

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make your changes and commit: `git commit -m 'feat: add my feature'`
4. Push to your branch: `git push origin feature/my-feature`
5. Open a Pull Request

### Commit convention

This project follows [Conventional Commits](https://www.conventionalcommits.org/):

| Prefix | Use for |
|--------|---------|
| `feat:` | New features |
| `fix:` | Bug fixes |
| `chore:` | Maintenance, dependencies |
| `docs:` | Documentation changes |
| `refactor:` | Code refactoring |

### Running the Python script manually

```bash
python python/audio_sync_analyzer.py \
  --basename <recording-folder-name> \
  --base_dir <path-to-recordings> \
  --model small \
  --threads 4
```

## License

MIT © [Raul Garcia](https://github.com/rgarciade)
