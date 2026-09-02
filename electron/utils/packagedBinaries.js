// Resolución centralizada de binarios empaquetados (Python y ffmpeg):
// en Windows, child_process.spawn() no resuelve extensiones, por lo que
// las rutas deben incluir el sufijo ".exe" explícitamente (issue #154).
const path = require('path');

function getBinarySuffix() {
  return process.platform === 'win32' ? '.exe' : '';
}

function getPackagedPythonBinaryPath(binaryName) {
  return path.join(process.resourcesPath, 'python-bin', binaryName + getBinarySuffix());
}

function getFfmpegStaticPath(isDev) {
  const suffix = getBinarySuffix();
  if (isDev) {
    return path.join(__dirname, '../../node_modules/ffmpeg-static/ffmpeg' + suffix);
  }
  return path.join(process.resourcesPath, 'app.asar.unpacked', 'node_modules', 'ffmpeg-static', 'ffmpeg' + suffix);
}

module.exports = { getPackagedPythonBinaryPath, getFfmpegStaticPath, getBinarySuffix };
