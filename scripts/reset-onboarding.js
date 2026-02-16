const fs = require('fs');
const path = require('path');
const os = require('os');

// Intentar localizar la carpeta de datos de usuario
// En macOS: ~/Library/Application Support/AIRecorder (Prod) o Electron (Dev por defecto si no se cambia el name)
// El package.json tiene "name": "airecorder" y "productName": "AIRecorder"

const homeDir = os.homedir();
const possiblePaths = [
  path.join(homeDir, 'Library/Application Support/AIRecorder/settings.json'), // Prod / Builder
  path.join(homeDir, 'Library/Application Support/Electron/settings.json'),   // Default Electron Dev
  path.join(homeDir, 'AppData/Roaming/AIRecorder/settings.json'),             // Windows
  path.join(homeDir, 'AppData/Roaming/Electron/settings.json'),               // Windows Dev
  path.join(homeDir, '.config/AIRecorder/settings.json'),                     // Linux
  path.join(homeDir, '.config/Electron/settings.json')                        // Linux Dev
];

let foundPath = null;

console.log('🔍 Buscando archivo settings.json...');

for (const p of possiblePaths) {
  if (fs.existsSync(p)) {
    foundPath = p;
    break;
  }
}

if (!foundPath) {
  console.log('⚠️ No se encontró el archivo settings.json en las rutas estándar.');
  console.log('   Esto es normal si nunca has ejecutado la app o no se han guardado configuraciones.');
  console.log('   Se creará un nuevo archivo en la ubicación por defecto de producción para macOS/Linux/Windows.');
  
  // Default fallback for creation
  if (process.platform === 'darwin') {
    foundPath = path.join(homeDir, 'Library/Application Support/AIRecorder/settings.json');
  } else if (process.platform === 'win32') {
    foundPath = path.join(homeDir, 'AppData/Roaming/AIRecorder/settings.json');
  } else {
    foundPath = path.join(homeDir, '.config/AIRecorder/settings.json');
  }
  
  // Ensure dir exists
  const dir = path.dirname(foundPath);
  if (!fs.existsSync(dir)) {
    try {
        fs.mkdirSync(dir, { recursive: true });
    } catch (e) {
        console.error(`❌ Error creando directorio ${dir}:`, e.message);
        process.exit(1);
    }
  }
}

console.log(`📂 Archivo objetivo: ${foundPath}`);

let settings = {};

if (fs.existsSync(foundPath)) {
  try {
    const data = fs.readFileSync(foundPath, 'utf8');
    settings = JSON.parse(data);
  } catch (e) {
    console.error('❌ Error leyendo settings.json:', e.message);
    // Continue with empty settings
  }
}

// Reset flag
settings.isFirstRun = true;

try {
  fs.writeFileSync(foundPath, JSON.stringify(settings, null, 2), 'utf8');
  console.log('✅ ÉXITO: La aplicación se ha reiniciado a modo "Onboarding" (isFirstRun: true).');
  console.log('   Reinicia la app para ver el asistente de configuración.');
} catch (e) {
  console.error('❌ Error guardando settings.json:', e.message);
  process.exit(1);
}
