const { app, dialog, shell, BrowserWindow } = require('electron');
const https = require('https');

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

  async checkForUpdates(silent = true) {
    try {
      const release = await this._fetchLatestRelease();
      if (!release) return null;

      this.latestRelease = release;
      const currentVersion = this.getCurrentVersion();
      const latestVersion = release.tag_name.replace(/^v/, '');

      if (this._isNewerVersion(latestVersion, currentVersion)) {
        const updateInfo = {
          currentVersion,
          latestVersion,
          releaseNotes: release.body || '',
          downloadUrl: release.html_url,
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

    const { response } = await dialog.showMessageBox(targetWindow, {
      type: 'info',
      title: 'Actualización disponible',
      message: `¡Hay una nueva versión de AIRecorder disponible! (v${updateInfo.latestVersion})`,
      detail: `Versión actual: v${updateInfo.currentVersion}\n\nAntes de descargar, ten en cuenta esta Guía de Actualización:\n\n⚠️ La app está en desarrollo preliminar y aún no está firmada.\n\n1. Descarga la nueva versión, borra la app actual de Aplicaciones y vuelve a instalar la que acabas de descargar.\n2. Cuando te pida permisos de captura de pantalla, tienes que ELIMINAR el permiso actual de la app en Ajustes del Sistema y volver a dárselo.\n3. Para abrir la app por primera vez, es posible que tengas que lanzar este comando en la terminal:\n\n   xattr -cr /Applications/AIRecorder.app\n\nNovedades de la versión:\n${(updateInfo.releaseNotes || 'Mejoras y correcciones.').slice(0, 300)}...`,
      buttons: ['Entendido y Descargar', 'Más tarde'],
      defaultId: 0,
      cancelId: 1,
    });

    if (response === 0) {
      shell.openExternal(updateInfo.downloadUrl);
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
