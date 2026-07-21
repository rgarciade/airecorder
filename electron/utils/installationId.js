const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { settingsPath } = require('./paths');

// Archivo separado de settings.json: si settings.json existe con solo este campo,
// el frontend (settingsService.js) deja de aplicar sus valores por defecto en el
// primer arranque (isFirstRun, theme, aiProvider, etc.), porque solo usa los
// defaults cuando `settings.json` no existe en absoluto.
const installationIdPath = path.join(path.dirname(settingsPath), 'installation-id.json');

function getOrCreateInstallationId() {
  try {
    if (fs.existsSync(installationIdPath)) {
      const { id } = JSON.parse(fs.readFileSync(installationIdPath, 'utf8'));
      if (id) return id;
    }
  } catch (error) {
    console.warn('[InstallationId] Archivo corrupto, se regenera:', error.message);
  }

  const id = crypto.randomUUID();
  try {
    fs.mkdirSync(path.dirname(installationIdPath), { recursive: true });
    fs.writeFileSync(installationIdPath, JSON.stringify({ id }, null, 2));
  } catch (error) {
    console.error('[InstallationId] No se pudo persistir el id de instalación:', error);
  }
  return id;
}

module.exports = { getOrCreateInstallationId };
