const path = require('path');
const fs = require('fs');
const { app } = require('electron');

// Hardcoded dev venv path, kept on purpose (same as transcriptionManager).
const DEV_VENV_PYTHON = '/Users/raul.garciad/Proyectos/personal/airecorder/venv/bin/python';

/**
 * Resolves the executable, base args and ffmpeg path used to run a bundled
 * Python tool. Dev: venv/system python + script. Packaged: PyInstaller binary
 * in `python-bin` and the unpacked ffmpeg-static.
 * @param {string} scriptName - e.g. 'audio_sync_analyzer'
 * @returns {{ executable: string, args: string[], ffmpegPath: string|null }}
 */
function resolvePythonCommand(scriptName) {
  const ffmpegName = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';

  if (!app.isPackaged) {
    const systemPython = process.platform === 'win32' ? 'python' : 'python3';
    const executable = fs.existsSync(DEV_VENV_PYTHON) ? DEV_VENV_PYTHON : systemPython;
    const ffmpegPath = path.join(__dirname, '../../node_modules/ffmpeg-static', ffmpegName);
    return {
      executable,
      args: [path.join(__dirname, `../../python/${scriptName}.py`)],
      ffmpegPath: fs.existsSync(ffmpegPath) ? ffmpegPath : null,
    };
  }

  const resourcesPath = process.resourcesPath;
  const binaryName = process.platform === 'win32' ? `${scriptName}.exe` : scriptName;
  const ffmpegPath = path.join(resourcesPath, 'app.asar.unpacked', 'node_modules', 'ffmpeg-static', ffmpegName);
  return {
    executable: path.join(resourcesPath, 'python-bin', binaryName),
    args: [],
    ffmpegPath: fs.existsSync(ffmpegPath) ? ffmpegPath : null,
  };
}

module.exports = { resolvePythonCommand };
