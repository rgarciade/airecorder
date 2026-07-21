/**
 * Hook afterPack de electron-builder.
 *
 * Re-firma el .app con los entitlements correctos tras el empaquetado.
 * Necesario porque, en ciertos entornos (CI), electron-builder empaqueta
 * el .app con firma ad-hoc pero sin los entitlements configurados
 * (com.apple.security.device.audio-input, etc.), rompiendo la captura
 * de audio del sistema vía electron-audio-loopback. Verificado manualmente
 * que un re-sign explícito con --deep sí los embebe correctamente.
 */
const path = require('path');
const { execFileSync } = require('child_process');

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'darwin') return;

  const appPath = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`);
  const entitlementsPath = path.join(context.packager.projectDir, 'build', 'entitlements.mac.plist');

  console.log('[Fix Entitlements] Re-firmando con entitlements:', appPath);

  try {
    execFileSync('codesign', ['--sign', '-', '--entitlements', entitlementsPath, '--force', '--deep', appPath], {
      stdio: 'inherit',
    });
    console.log('[Fix Entitlements] Re-firmado correctamente');
  } catch (error) {
    console.error('[Fix Entitlements] Error re-firmando:', error.message);
    throw error;
  }
};
