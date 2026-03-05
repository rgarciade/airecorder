/**
 * Hook afterPack de electron-builder.
 *
 * Aplica asarmor al archivo .asar para dificultar la extracción
 * con herramientas estándar (npx @electron/asar extract).
 */
const path = require('path');

exports.default = async function afterPack(context) {
  try {
    const { open, createBloatPatch } = require('asarmor');

    const asarPath = path.join(
      context.appOutDir,
      `${context.packager.appInfo.productFilename}.app`,
      'Contents',
      'Resources',
      'app.asar'
    );

    console.log('[Asarmor] Protegiendo ASAR:', asarPath);

    const asarmor = await open(asarPath);
    asarmor.patch(createBloatPatch(50));
    await asarmor.write(asarPath);

    console.log('[Asarmor] ASAR protegido correctamente');
  } catch (error) {
    console.error('[Asarmor] Error protegiendo ASAR:', error.message);
    // No fallar el build si asarmor falla
  }
};
