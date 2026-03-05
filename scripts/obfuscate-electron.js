/**
 * Script de ofuscación del código Electron para producción.
 *
 * Copia electron/ → electron-obfuscated/ y ofusca todos los .js
 * Se ejecuta SOLO en la cadena de build (no afecta al desarrollo).
 */
const fs = require('fs');
const path = require('path');
const JavaScriptObfuscator = require('javascript-obfuscator');
const dotenv = require('dotenv');

const ROOT_DIR = path.join(__dirname, '..');
const SOURCE_DIR = path.join(ROOT_DIR, 'electron');
const OUTPUT_DIR = path.join(ROOT_DIR, 'electron-obfuscated');

// Cargar variables de entorno
const envConfig = dotenv.config({ path: path.join(ROOT_DIR, '.env') }).parsed || {};

const obfuscationConfig = {
  compact: true,
  controlFlowFlattening: true,
  controlFlowFlatteningThreshold: 0.5,
  deadCodeInjection: true,
  deadCodeInjectionThreshold: 0.3,
  identifierNamesGenerator: 'hexadecimal',
  renameGlobals: false,
  stringArray: true,
  stringArrayEncoding: ['base64'],
  stringArrayThreshold: 0.75,
  rotateStringArray: true,
  shuffleStringArray: true,
  selfDefending: false,
  disableConsoleOutput: false,
  splitStrings: true,
  splitStringsChunkLength: 10,
  transformObjectKeys: true,
  unicodeEscapeSequence: false,
};

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

function obfuscateFile(filePath) {
  let code = fs.readFileSync(filePath, 'utf8');

  // Inyectar variables de entorno VITE_* desde el .env
  Object.keys(envConfig).forEach(key => {
    if (key.startsWith('VITE_')) {
      // Reemplaza process.env.VITE_NOMBRE_VAR por "su_valor"
      const regex = new RegExp(`process\\.env\\.${key}`, 'g');
      code = code.replace(regex, JSON.stringify(envConfig[key]));
    }
  });

  try {
    const result = JavaScriptObfuscator.obfuscate(code, obfuscationConfig);
    fs.writeFileSync(filePath, result.getObfuscatedCode());
    return true;
  } catch (error) {
    console.error(`  [ERROR] No se pudo ofuscar ${path.relative(OUTPUT_DIR, filePath)}: ${error.message}`);
    return false;
  }
}

// --- Main ---
console.log('[Obfuscator] Iniciando ofuscación del código Electron...');

// 1. Limpiar directorio de salida
if (fs.existsSync(OUTPUT_DIR)) {
  fs.rmSync(OUTPUT_DIR, { recursive: true, force: true });
}

// 2. Copiar electron/ → electron-obfuscated/
console.log('[Obfuscator] Copiando electron/ → electron-obfuscated/');
copyDirSync(SOURCE_DIR, OUTPUT_DIR);

// 3. Ofuscar todos los .js
const jsFiles = getAllJsFiles(OUTPUT_DIR);
console.log(`[Obfuscator] Ofuscando ${jsFiles.length} archivos JavaScript...`);

let success = 0;
let failed = 0;
for (const file of jsFiles) {
  const relativePath = path.relative(OUTPUT_DIR, file);
  process.stdout.write(`  Ofuscando: ${relativePath}...`);
  if (obfuscateFile(file)) {
    console.log(' OK');
    success++;
  } else {
    failed++;
  }
}

console.log(`[Obfuscator] Completado: ${success} OK, ${failed} errores`);

if (failed > 0) {
  process.exit(1);
}
