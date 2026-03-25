const { app, dialog, shell, BrowserWindow } = require('electron');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { settingsPath } = require('../utils/paths');

const GITHUB_OWNER = 'rgarciade';
const GITHUB_REPO = 'airecorder';
const CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000; // 4 horas

class UpdateChecker {
  constructor() {
    this.latestRelease = null;
    this.checkTimer = null;
    this.mainWindow = null;
  }

  setMainWindow(window) {
    this.mainWindow = window;
  }

  getCurrentVersion() {
    return app.getVersion();
  }

  _getSettings() {
    try {
      if (fs.existsSync(settingsPath)) {
        return JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
      }
    } catch (error) {
      console.error('[UpdateChecker] Error leyendo settings:', error);
    }
    return {};
  }

  _isVersionIgnored(version) {
    const settings = this._getSettings();
    return settings.ignoredUpdateVersion === version;
  }

  _ignoreVersion(version) {
    try {
      const settings = this._getSettings();
      settings.ignoredUpdateVersion = version;
      fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf8');
      console.log(`[UpdateChecker] Versión ${version} ignorada.`);
    } catch (error) {
      console.error('[UpdateChecker] Error guardando versión ignorada:', error);
    }
  }

  async checkForUpdates(silent = true, manualCheck = false) {
    try {
      const release = await this._fetchLatestRelease();
      if (!release) return null;

      this.latestRelease = release;
      const currentVersion = this.getCurrentVersion();
      const latestVersion = release.tag_name.replace(/^v/, '');

      if (this._isNewerVersion(latestVersion, currentVersion)) {
        // Si no es una verificación manual y la versión está ignorada, no mostramos nada
        if (!manualCheck && this._isVersionIgnored(latestVersion)) {
          console.log(`[UpdateChecker] Hay una nueva versión (${latestVersion}) pero fue ignorada por el usuario.`);
          return null;
        }

        const downloadUrl = this._getPlatformDownloadUrl(release);

        const updateInfo = {
          currentVersion,
          latestVersion,
          releaseNotes: release.body || '',
          downloadUrl,
          publishedAt: release.published_at,
        };

        // Notificar al renderer
        if (this.mainWindow?.webContents) {
          this.mainWindow.webContents.send('update-available', updateInfo);
        }

        // Si no es silencioso, mostrar diálogo nativo
        if (!silent) {
          await this._showUpdateDialog(updateInfo);
        }

        return updateInfo;
      }

      return null;
    } catch (error) {
      console.error('[UpdateChecker] Error verificando actualizaciones:', error.message);
      if (!silent) throw error;
      return null;
    }
  }

  _getPlatformDownloadUrl(release) {
    const assets = release.assets || [];
    const platform = process.platform;

    let asset;
    if (platform === 'darwin') {
      asset = assets.find((a) => a.name.endsWith('.dmg'));
    } else if (platform === 'win32') {
      asset = assets.find((a) => a.name.endsWith('.exe'));
    }

    return asset ? asset.browser_download_url : release.html_url;
  }

  _fetchLatestRelease() {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'api.github.com',
        path: `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`,
        headers: { 'User-Agent': `AIRecorder/${app.getVersion()}` },
      };

      const req = https.get(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          if (res.statusCode === 200) {
            try {
              resolve(JSON.parse(data));
            } catch (e) {
              reject(new Error('Respuesta JSON inválida de GitHub'));
            }
          } else if (res.statusCode === 404) {
            resolve(null);
          } else {
            reject(new Error(`GitHub API respondió con ${res.statusCode}`));
          }
        });
      });

      req.on('error', reject);
      req.setTimeout(10000, () => {
        req.destroy();
        reject(new Error('Timeout al contactar GitHub'));
      });
    });
  }

  _isNewerVersion(latest, current) {
    const latestParts = latest.split('.').map(Number);
    const currentParts = current.split('.').map(Number);

    for (let i = 0; i < 3; i++) {
      const l = latestParts[i] || 0;
      const c = currentParts[i] || 0;
      if (l > c) return true;
      if (l < c) return false;
    }
    return false;
  }

  async _showUpdateDialog(updateInfo) {
    const targetWindow = this.mainWindow || BrowserWindow.getAllWindows()[0];
    if (!targetWindow) return;

    const isMac = process.platform === 'darwin';
    const platformDetail = isMac
      ? `⚠️ La app está en desarrollo preliminar y aún no está firmada. Sigue estos pasos para actualizar correctamente:

1. 🗑️  Arrastra la app actual a la Papelera sin miedo — tus datos NO se borran, se guardan en una carpeta aparte y se mantienen intactos.

2. 📥  Descarga la nueva versión e instálala en Aplicaciones como siempre.

3. 🔐  Es OBLIGATORIO quitar y volver a dar el permiso de Grabación de Pantalla:
   → Ajustes del Sistema › Privacidad y Seguridad › Grabación de Pantalla
   → Desmarca AIRecorder, cierra Ajustes, vuelve a abrirlos y vuelve a marcarlo.

4. 🖥️  Si al abrir la app aparece un aviso de seguridad, ejecuta este comando en la Terminal:
   xattr -cr /Applications/AIRecorder.app`
      : `⚠️ La app está en desarrollo preliminar y aún no está firmada. Sigue estos pasos para actualizar correctamente:

1. 📥  Descarga el instalador (.exe) de la nueva versión.

2. 🔄  Ejecuta el instalador — desinstalará la versión anterior automáticamente e instalará la nueva.

3. 🔐  Si Windows muestra un aviso de seguridad ("Windows protegió tu equipo"), haz clic en "Más información" y luego en "Ejecutar de todas formas".`;

    const { response } = await dialog.showMessageBox(targetWindow, {
      type: 'info',
      title: 'Actualización disponible',
      message: `¡Hay una nueva versión de AIRecorder disponible! (v${updateInfo.latestVersion})`,
      detail: `Versión actual: v${updateInfo.currentVersion}

${platformDetail}

────────────────────────────
Novedades de v${updateInfo.latestVersion}:
${(updateInfo.releaseNotes || 'Mejoras y correcciones.').slice(0, 600)}`,
      buttons: ['Entendido y Descargar', 'Más tarde', 'No mostrar para esta versión'],
      defaultId: 0,
      cancelId: 1,
    });

    if (response === 0) {
      shell.openExternal(updateInfo.downloadUrl);
    } else if (response === 2) {
      this._ignoreVersion(updateInfo.latestVersion);
    }
  }

  startPeriodicCheck() {
    // No verificar actualizaciones si estamos en entorno de desarrollo
    if (process.env.NODE_ENV === 'development') {
      console.log('[UpdateChecker] Entorno de desarrollo detectado. Verificación automática de actualizaciones desactivada.');
      return;
    }

    console.log('[UpdateChecker] Iniciando verificación periódica de actualizaciones...');

    // Verificar al inicio con delay de 5 segundos (no silencioso)
    setTimeout(() => this.checkForUpdates(false), 5000);

    // Verificar periódicamente (silencioso, solo notifica al renderer)
    this.checkTimer = setInterval(() => {
      this.checkForUpdates(true);
    }, CHECK_INTERVAL_MS);
  }

  stopPeriodicCheck() {
    if (this.checkTimer) {
      clearInterval(this.checkTimer);
      this.checkTimer = null;
    }
  }
}

module.exports = new UpdateChecker();
