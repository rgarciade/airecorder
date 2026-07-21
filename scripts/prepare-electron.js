/**
 * Prepara el código Electron para producción.
 *
 * Copia electron/ → electron-dist/ e inyecta las variables de entorno
 * VITE_* del .env como literales (la app empaquetada no incluye .env,
 * así que process.env.VITE_* sería undefined en runtime sin esta inyección).
 *
 * Se ejecuta SOLO en la cadena de build (no afecta al desarrollo).
 */
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const ROOT_DIR = path.join(__dirname, '..');
const SOURCE_DIR = path.join(ROOT_DIR, 'electron');
const OUTPUT_DIR = path.join(ROOT_DIR, 'electron-dist');

// Cargar variables de entorno
const envConfig = dotenv.config({ path: path.join(ROOT_DIR, '.env') }).parsed || {};

function copyDirSync(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function getAllJsFiles(dir) {
  const results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...getAllJsFiles(fullPath));
    } else if (entry.name.endsWith('.js')) {
      results.push(fullPath);
    }
  }
  return results;
}

function injectEnv(filePath) {
  let code = fs.readFileSync(filePath, 'utf8');
  let changed = false;

  Object.keys(envConfig).forEach(key => {
    if (key.startsWith('VITE_')) {
      // Reemplaza process.env.VITE_NOMBRE_VAR por "su_valor"
      const regex = new RegExp(`process\\.env\\.${key}`, 'g');
      if (regex.test(code)) {
        code = code.replace(new RegExp(`process\\.env\\.${key}`, 'g'), JSON.stringify(envConfig[key]));
        changed = true;
      }
    }
  });

  if (changed) {
    fs.writeFileSync(filePath, code);
  }
  return changed;
}

// --- Main ---
console.log('[Prepare] Preparando código Electron para producción...');

// 1. Limpiar directorio de salida
if (fs.existsSync(OUTPUT_DIR)) {
  fs.rmSync(OUTPUT_DIR, { recursive: true, force: true });
}

// 2. Copiar electron/ → electron-dist/
console.log('[Prepare] Copiando electron/ → electron-dist/');
copyDirSync(SOURCE_DIR, OUTPUT_DIR);

// 3. Inyectar variables VITE_* en los .js
const jsFiles = getAllJsFiles(OUTPUT_DIR);
let injected = 0;
for (const file of jsFiles) {
  if (injectEnv(file)) {
    injected++;
  }
}

console.log(`[Prepare] Completado: ${jsFiles.length} archivos copiados, variables inyectadas en ${injected}`);
