# AI Agent Guidelines

This document provides instructions for AI coding agents (and human developers) working on the **AIRecorder** repository. It covers build commands, code style, and architectural conventions.

## 1. Environment & Build Commands

This is a **hybrid Electron + React + Python** application.

### Prerequisites
- Node.js (v18+)
- Python 3.x (with virtual environment in `venv/`)
- System dependencies for audio (ffmpeg, sox) might be required.

### Commands
| Action | Command | Description |
|--------|---------|-------------|
| **Start Dev** | `npm run dev` | Runs Vite (frontend) and Electron (backend) concurrently. |
| **Lint** | `npm run lint` | Runs ESLint on JS/JSX files. |
| **Build Frontend** | `npm run build` | Builds the React application via Vite. |
| **Build App** | `npm run electron:build` | Builds the final Electron executable (macOS). |
| **Test** | *No tests configured* | Currently, there are no test scripts. If adding tests, prefer **Vitest** for React. |

**Note on Python:** The application spawns a Python process for audio analysis (`audio_sync_analyzer.py`). Ensure the virtual environment at `./venv` is active or used when running Python scripts manually.

## 2. Code Style & Conventions

### Frontend (React/Vite)
- **Framework:** React 18 with Functional Components and Hooks.
- **State Management:** Redux Toolkit (`useSelector`, `useDispatch`).
- **Styling:** Tailwind CSS (`className="..."`).
- **Routing:** `react-router-dom`.
- **File Structure:**
  - `src/pages/`: Main views (Home, Settings, Projects).
  - `src/components/`: Reusable UI components.
  - `src/store/`: Redux slices and store configuration.
- **Naming:**
  - Components: PascalCase (e.g., `RecordingOverlay.jsx`).
  - Functions/Variables: camelCase.
  - Files: PascalCase for components, camelCase for utilities/hooks.

### Backend (Electron)
- **Module System:** CommonJS (`require`).
- **IPC:** Use `ipcMain.handle` in `main.js` and `ipcRenderer.invoke` in the frontend.
- **File Handling:** Direct `fs` usage is permitted in the main process.
- **Hardcoded Paths:** Be aware that some paths (e.g., user directories) might be hardcoded in `main.js` or Python scripts. **Do not change these unless refactoring for portability.**
- **Process Spawning:** Python scripts are executed via `child_process.spawn`.

### Python (Audio Analysis)
- **Style:** PEP 8 compliance.
- **Language:** Spanish comments and log messages are preferred (e.g., `print("🎵 Cargando...")`).
- **Libraries:** `whisper` (transcription), `librosa` (analysis), `pydub` (manipulation).
- **Structure:** Class-based architecture (e.g., `AudioSyncAnalyzer`).

## 3. General Rules for Agents

1.  **Safety First:** 
    - Always check if a file exists before reading/writing.
    - Do not modify `package.json` or `requirements.txt` unless explicitly asked to add dependencies.
2.  **No Guesswork:** 
    - If a path seems hardcoded (e.g., `/Users/raul.garciad/...`), **preserve it** unless the task specifically asks to fix it.
3.  **Language:** 
    - The UI and logs use **Spanish** mixed with English variable names. Maintain this consistency (e.g., user-facing strings in Spanish).
4.  **Error Handling:**
    - Frontend: Graceful degradation, console logs for errors.
    - Electron: `try/catch` blocks in IPC handlers are mandatory to prevent app crashes.
5.  **Imports:**
    - Group imports: 3rd party first, then local components, then styles.

## 4. Testing
*Currently, no automated testing suite is set up.* 
- When implementing critical features, verify manually by running the app (`npm run dev`).
- If asked to write tests, propose setting up **Vitest** for React components.
