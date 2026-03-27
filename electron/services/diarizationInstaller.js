/**
 * diarizationInstaller.js
 * Gestiona la instalación, desinstalación y ejecución del entorno de diarización.
 * Funciona en Mac y Windows.
 */

const { app } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const os = require('os');

// ─── Rutas ────────────────────────────────────────────────────────────────────

const IS_WIN = process.platform === 'win32';

function getEnvPath() {
  return path.join(app.getPath('userData'), 'diarization-env');
}

function getPythonBin(envPath) {
  return IS_WIN
    ? path.join(envPath, 'Scripts', 'python.exe')
    : path.join(envPath, 'bin', 'python');
}

function getPipBin(envPath) {
  return IS_WIN
    ? path.join(envPath, 'Scripts', 'pip.exe')
    : path.join(envPath, 'bin', 'pip');
}

function getHuggingFaceCachePath() {
  return path.join(os.homedir(), '.cache', 'huggingface', 'hub');
}

function getTorchCachePath() {
  return path.join(os.homedir(), '.cache', 'torch');
}

// ─── Estado ───────────────────────────────────────────────────────────────────

function isEnvInstalled() {
  return fs.existsSync(getPythonBin(getEnvPath()));
}

function isPyannoteModelCached() {
  const hfCache = getHuggingFaceCachePath();
  const torchCache = getTorchCachePath();
  return (
    fs.existsSync(path.join(hfCache, 'models--pyannote--speaker-diarization-3.1')) ||
    fs.existsSync(path.join(torchCache, 'pyannote', 'speaker-diarization-3.1'))
  );
}

function getDirectorySizeBytes(dirPath) {
  if (!fs.existsSync(dirPath)) return 0;
  let total = 0;
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        total += getDirectorySizeBytes(full);
      } else {
        try { total += fs.statSync(full).size; } catch (_) {}
      }
    }
  } catch (_) {}
  return total;
}

function getStatus() {
  const envPath = getEnvPath();
  const installed = isEnvInstalled();
  const modelCached = isPyannoteModelCached();
  const envSizeBytes = installed ? getDirectorySizeBytes(envPath) : 0;
  const modelSizeBytes = modelCached ? (() => {
    const hfPath = path.join(getHuggingFaceCachePath(), 'models--pyannote--speaker-diarization-3.1');
    const torchPath = path.join(getTorchCachePath(), 'pyannote', 'speaker-diarization-3.1');
    return getDirectorySizeBytes(hfPath) || getDirectorySizeBytes(torchPath);
  })() : 0;

  return {
    installed,
    modelCached,
    envPath,
    envSizeBytes,
    modelSizeBytes,
  };
}

// ─── Buscar Python del sistema ────────────────────────────────────────────────

async function findSystemPython() {
  const candidates = IS_WIN
    ? ['python', 'python3', 'py']
    : ['python3', 'python'];

  for (const bin of candidates) {
    try {
      const version = await new Promise((resolve, reject) => {
        const proc = spawn(bin, ['--version'], { timeout: 5000 });
        let out = '';
        proc.stdout.on('data', d => { out += d; });
        proc.stderr.on('data', d => { out += d; }); // python 2 imprime en stderr
        proc.on('close', code => code === 0 || out.includes('Python') ? resolve(out.trim()) : reject());
        proc.on('error', reject);
      });
      // Verificar que sea >= 3.9
      const match = version.match(/Python (\d+)\.(\d+)/);
      if (match && parseInt(match[1]) >= 3 && parseInt(match[2]) >= 9) {
        return bin;
      }
    } catch (_) {}
  }
  return null;
}

// ─── Instalación ──────────────────────────────────────────────────────────────

let installProcess = null;

/**
 * Instala el entorno de diarización.
 * @param {(event: {phase: string, percent: number, detail: string}) => void} onProgress
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function installEnv(onProgress) {
  if (isEnvInstalled()) {
    return { success: true };
  }

  const envPath = getEnvPath();

  // 1. Encontrar Python del sistema
  onProgress({ phase: 'searching_python', percent: 0, detail: 'Buscando Python del sistema...' });
  const systemPython = await findSystemPython();
  if (!systemPython) {
    return { success: false, error: 'No se encontró Python 3.9+ en el sistema. Instala Python desde python.org' };
  }

  // 2. Crear venv
  onProgress({ phase: 'creating_env', percent: 5, detail: 'Creando entorno virtual...' });
  try {
    await runProcess(systemPython, ['-m', 'venv', envPath], onProgress);
  } catch (e) {
    return { success: false, error: `Error creando venv: ${e.message}` };
  }

  const pip = getPipBin(envPath);
  const python = getPythonBin(envPath);

  // 3. Actualizar pip
  onProgress({ phase: 'updating_pip', percent: 8, detail: 'Actualizando pip...' });
  try {
    await runProcess(python, ['-m', 'pip', 'install', '--upgrade', 'pip', '--quiet'], onProgress);
  } catch (_) {}

  // 4. Instalar torch CPU-only primero (más controlado)
  onProgress({ phase: 'downloading_torch', percent: 10, detail: IS_WIN ? 'Descargando PyTorch CPU (~800 MB)...' : 'Descargando PyTorch (~1.5 GB)...' });
  try {
    const torchArgs = IS_WIN
      ? ['install', 'torch', '--index-url', 'https://download.pytorch.org/whl/cpu', '--progress-bar', 'on']
      : ['install', 'torch', '--progress-bar', 'on'];
    await runProcess(pip, torchArgs, onProgress, (line, currentPercent) => {
      // pip no da % exacto, estimamos por keywords
      if (line.includes('Downloading')) return Math.min(currentPercent + 1, 55);
      if (line.includes('Installing')) return 60;
      return currentPercent;
    }, 10, 60);
  } catch (e) {
    return { success: false, error: `Error instalando PyTorch: ${e.message}` };
  }

  // 5. Instalar pyannote.audio
  onProgress({ phase: 'downloading_pyannote', percent: 62, detail: 'Descargando pyannote.audio (~200 MB)...' });
  try {
    await runProcess(pip, ['install', 'pyannote.audio', '--progress-bar', 'on'], onProgress,
      (line, currentPercent) => {
        if (line.includes('Downloading')) return Math.min(currentPercent + 2, 90);
        if (line.includes('Installing')) return 92;
        return currentPercent;
      }, 62, 92);
  } catch (e) {
    return { success: false, error: `Error instalando pyannote.audio: ${e.message}` };
  }

  onProgress({ phase: 'done', percent: 100, detail: 'Instalación completada' });
  return { success: true };
}

/**
 * Lanza un proceso y reporta progreso parsando stdout/stderr.
 */
function runProcess(bin, args, onProgress, progressParser, startPercent, endPercent) {
  return new Promise((resolve, reject) => {
    let currentPercent = startPercent || 0;
    const proc = spawn(bin, args, { env: { ...process.env } });
    installProcess = proc;

    const handleLine = (line) => {
      if (progressParser) {
        const newPercent = progressParser(line, currentPercent);
        if (newPercent !== currentPercent) {
          currentPercent = newPercent;
          onProgress && onProgress({ phase: 'progress', percent: currentPercent, detail: line.trim() });
        }
      }
    };

    proc.stdout.on('data', d => d.toString().split('\n').forEach(handleLine));
    proc.stderr.on('data', d => d.toString().split('\n').forEach(handleLine));

    proc.on('close', code => {
      installProcess = null;
      if (code === 0) resolve();
      else reject(new Error(`Proceso terminó con código ${code}`));
    });
    proc.on('error', err => {
      installProcess = null;
      reject(err);
    });
  });
}

function cancelInstall() {
  if (installProcess) {
    installProcess.kill();
    installProcess = null;
  }
}

// ─── Desinstalación ───────────────────────────────────────────────────────────

async function uninstallEnv() {
  const envPath = getEnvPath();
  if (!fs.existsSync(envPath)) return { success: true };
  try {
    await fs.promises.rm(envPath, { recursive: true, force: true });
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

async function deletePyannoteModelCache() {
  const hfPath = path.join(getHuggingFaceCachePath(), 'models--pyannote--speaker-diarization-3.1');
  const torchPath = path.join(getTorchCachePath(), 'pyannote', 'speaker-diarization-3.1');
  try {
    if (fs.existsSync(hfPath)) await fs.promises.rm(hfPath, { recursive: true, force: true });
    if (fs.existsSync(torchPath)) await fs.promises.rm(torchPath, { recursive: true, force: true });
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// ─── Descarga del modelo ──────────────────────────────────────────────────────

/**
 * Descarga el modelo pyannote sin diarizar (precacheo desde Settings).
 * Envía fases: loading → done | error
 */
async function downloadModel(hfToken, onPhase) {
  const envPath = getEnvPath();
  const python = getPythonBin(envPath);

  if (!fs.existsSync(python)) {
    return { success: false, error: 'Entorno de diarización no instalado' };
  }

  const runnerCandidates = [
    path.join(__dirname, '..', '..', 'python', 'diarization_runner.py'),
    path.join(process.resourcesPath || '', 'diarization_runner.py'),
    path.join(app.getAppPath(), 'python', 'diarization_runner.py'),
  ];
  const runnerPath = runnerCandidates.find(p => fs.existsSync(p));
  if (!runnerPath) {
    return { success: false, error: 'No se encontró diarization_runner.py' };
  }

  const args = ['--download_only'];
  if (hfToken) args.push('--hf_token', hfToken);

  return new Promise((resolve) => {
    const proc = spawn(python, [runnerPath, ...args], {
      env: { ...process.env, PYTHONUNBUFFERED: '1', PYTHONIOENCODING: 'utf-8' }
    });

    let stderrBuf = '';
    let resolved = false;
    const done = (val) => { if (!resolved) { resolved = true; resolve(val); } };

    proc.stdout.on('data', d => {
      for (const line of d.toString().split('\n').map(l => l.trim()).filter(Boolean)) {
        console.log('[DownloadModel]', line);
        if (line.startsWith('PHASE:') && onPhase) onPhase(line.replace('PHASE:', ''));
        if (line.startsWith('error:')) done({ success: false, error: line.replace('error:', '').trim() });
      }
    });
    proc.stderr.on('data', d => {
      const msg = d.toString().trim();
      console.error('[DownloadModel stderr]', msg);
      stderrBuf += msg + '\n';
    });
    proc.on('close', (code) => {
      if (code === 0) {
        done({ success: true });
      } else {
        // Extraer la última línea útil de stderr para el usuario
        const lastLine = stderrBuf.trim().split('\n').filter(l => !l.includes('UserWarning') && !l.includes('FutureWarning')).pop() || `Código de salida ${code}`;
        done({ success: false, error: lastLine });
      }
    });
    proc.on('error', e => done({ success: false, error: e.message }));
  });
}

// ─── Ejecución de diarización ─────────────────────────────────────────────────

/**
 * Ejecuta diarization_runner.py con el Python del entorno dedicado.
 * @returns {Promise<{segments: Array, speakers: Array} | {error: string}>}
 */
async function runDiarization(wavPath, hfToken, onPhase) {
  const envPath = getEnvPath();
  const python = getPythonBin(envPath);

  if (!fs.existsSync(python)) {
    return { error: 'Entorno de diarización no instalado' };
  }

  // Buscar el script diarization_runner.py
  // En dev: junto al .spec / en producción: en resources/
  const runnerCandidates = [
    path.join(__dirname, '..', '..', 'python', 'diarization_runner.py'),
    path.join(process.resourcesPath || '', 'diarization_runner.py'),
    path.join(app.getAppPath(), 'python', 'diarization_runner.py'),
  ];
  const runnerPath = runnerCandidates.find(p => fs.existsSync(p));
  if (!runnerPath) {
    return { error: 'No se encontró diarization_runner.py' };
  }

  const outputPath = path.join(app.getPath('temp'), `diarization_${Date.now()}.json`);
  const args = ['--wav', wavPath, '--output', outputPath];
  if (hfToken) args.push('--hf_token', hfToken);

  return new Promise((resolve) => {
    const proc = spawn(python, [runnerPath, ...args], {
      env: { ...process.env, PYTHONUNBUFFERED: '1', PYTHONIOENCODING: 'utf-8' }
    });

    proc.stdout.on('data', d => {
      const line = d.toString().trim();
      if (line.startsWith('PHASE:') && onPhase) {
        onPhase(line.replace('PHASE:', ''));
      }
    });

    proc.stderr.on('data', d => {
      console.error('[Diarization]', d.toString().trim());
    });

    proc.on('close', () => {
      try {
        if (fs.existsSync(outputPath)) {
          const data = JSON.parse(fs.readFileSync(outputPath, 'utf-8'));
          fs.unlinkSync(outputPath);
          resolve(data);
        } else {
          resolve({ error: 'No se generó archivo de output' });
        }
      } catch (e) {
        resolve({ error: e.message });
      }
    });

    proc.on('error', e => resolve({ error: e.message }));
  });
}

module.exports = {
  getStatus,
  isEnvInstalled,
  isPyannoteModelCached,
  installEnv,
  cancelInstall,
  uninstallEnv,
  deletePyannoteModelCache,
  downloadModel,
  runDiarization,
  getEnvPath,
};
