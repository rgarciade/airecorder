---
title: Contributor Guide
description: How to contribute to the AIRecorder project.
---

# Contributor Guide

AIRecorder is an open source project and contributions are welcome. This guide will help you get started quickly.

## Technology Stack

| Technology | Description |
|------------|-------------|
| **Electron** | Desktop application framework. Main process (`electron/main.js`), Preload (`electron/preload.js`), IPC communication. |
| **React + Vite** | Frontend with React, Tailwind CSS styles, global state with Redux Toolkit, internationalisation with i18next. |
| **Python** | Audio processing and transcription with Whisper. Main script: `python/audio_sync_analyzer.py`. |
| **SQLite** | Local database with better-sqlite3. |

## How to Run in Development

```bash
npm run dev
```

This command:
- Starts the frontend with Vite in hot-reload mode
- Launches Electron with the app window
- Any change in the React code is reflected automatically

## Build Commands

| Command | Description |
|---------|-------------|
| `npm run build` | Build frontend |
| `npm run electron:build` | Build macOS DMG |

## Commit Convention

We use **Conventional Commits**. Each commit must start with a type followed by a colon:

| Type | Description |
|------|-------------|
| `feat:` | New feature |
| `fix:` | Bug fix |
| `refactor:` | Code refactor without changing behaviour |
| `docs:` | Documentation changes |
| `chore:` | Maintenance tasks, dependencies, configuration |

## Project Rules

### Line Limit
Files over ~300 lines are a code smell. Split into smaller modules grouped by context.

### Internationalisation
All visible text in the UI must use i18n keys — never hardcoded text.

### Security
Never commit API keys, tokens or credentials. Use environment variables or user configuration.

### Documentation
If you modify logic in key areas, update the corresponding README (see the maintenance matrix in AGENTS.md).

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
├── scripts/                # Build utilities
└── requirements.txt        # Python dependencies
```

## Prerequisites

- [Node.js](https://nodejs.org/) v20+
- [Python](https://www.python.org/) 3.10+

## Installation

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