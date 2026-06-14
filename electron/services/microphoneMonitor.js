const { exec, execFile } = require('child_process');
const { EventEmitter } = require('events');
const path = require('path');
const fs = require('fs');

class MicrophoneMonitor extends EventEmitter {
  constructor() {
    super();
    this._timer = null;
    this._active = false;
    this._pollMs = 10000;
    this._binaryPath = null;
    this._compiling = false;
  }

  start() {
    if (this._timer) return;
    if (process.platform !== 'darwin' && process.platform !== 'win32') return;

    console.log('[MicrophoneMonitor] Iniciado (polling cada %ds)', this._pollMs / 1000);

    const init = process.platform === 'darwin' ? this._ensureBinary() : Promise.resolve();
    init.then(() => {
      this._timer = setInterval(() => this._poll(), this._pollMs);
      this._poll();
    }).catch(err => {
      console.error('[MicrophoneMonitor] Error iniciando:', err.message || err);
    });
  }

  stop() {
    if (this._timer) { clearInterval(this._timer); this._timer = null; }
    this._active = false;
  }

  // ── macOS: compila binario Swift (CoreAudio HAL) ────────────────────────────

  _getBinaryPath() {
    const { app } = require('electron');
    return path.join(app.getPath('userData'), 'mic-check');
  }

  async _ensureBinary() {
    const binaryPath = this._getBinaryPath();
    if (fs.existsSync(binaryPath)) {
      this._binaryPath = binaryPath;
      return;
    }
    if (this._compiling) return;
    this._compiling = true;

    const swiftSrc = path.join(__dirname, '../native/mic-check.swift');
    if (!fs.existsSync(swiftSrc)) throw new Error(`Swift source not found: ${swiftSrc}`);

    // swiftc is an external process — it cannot read paths inside .asar archives.
    // Extract source to userData first so swiftc can access it as a real file.
    const tmpSrc = binaryPath + '.swift';
    fs.writeFileSync(tmpSrc, fs.readFileSync(swiftSrc, 'utf8'));

    console.log('[MicrophoneMonitor] Compilando binario Swift en:', binaryPath);
    await new Promise((resolve, reject) => {
      exec(
        `/usr/bin/swiftc "${tmpSrc}" -o "${binaryPath}"`,
        { timeout: 30000 },
        (err, _stdout, stderr) => {
          this._compiling = false;
          try { fs.unlinkSync(tmpSrc); } catch {}
          if (err) {
            console.error('[MicrophoneMonitor] Error compilación:', stderr || err.message);
            reject(new Error(stderr || err.message));
          } else {
            this._binaryPath = binaryPath;
            console.log('[MicrophoneMonitor] Binario Swift compilado en:', binaryPath);
            resolve();
          }
        }
      );
    });
  }

  _isMicActiveMac() {
    return new Promise(resolve => {
      if (!this._binaryPath) { resolve(false); return; }
      execFile(this._binaryPath, { timeout: 5000 }, (err, stdout) => {
        if (err) { resolve(false); return; }
        resolve(stdout.trim() === 'active');
      });
    });
  }

  // ── Windows: lee registro ConsentStore (LastUsedTimeStop == 0 = activo) ────

  _isMicActiveWindows() {
    return new Promise(resolve => {
      const script = path.join(__dirname, '../native/mic-check.ps1');
      if (!fs.existsSync(script)) { resolve(false); return; }
      exec(
        `powershell.exe -NonInteractive -NoProfile -ExecutionPolicy Bypass -File "${script}"`,
        { timeout: 5000 },
        (err, stdout) => {
          if (err) { resolve(false); return; }
          resolve(stdout.trim() === 'active');
        }
      );
    });
  }

  // ── Dispatcher ──────────────────────────────────────────────────────────────

  _isMicActive() {
    if (process.platform === 'darwin') return this._isMicActiveMac();
    if (process.platform === 'win32') return this._isMicActiveWindows();
    return Promise.resolve(false);
  }

  _poll() {
    this._isMicActive().then(active => {
      if (active && !this._active) {
        this._active = true;
        this.emit('activated');
      } else if (!active && this._active) {
        this._active = false;
        this.emit('deactivated');
      }
    }).catch(() => {});
  }
}

module.exports = new MicrophoneMonitor();
