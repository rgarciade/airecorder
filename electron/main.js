const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  // En desarrollo, carga la URL de desarrollo de Vite
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    // Abre las DevTools automáticamente
    mainWindow.webContents.openDevTools();
  } else {
    // En producción, carga el archivo HTML construido
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

// Ruta del archivo de configuración
const settingsPath = path.join(app.getPath('userData'), 'settings.json');

// Manejador para guardar configuración
ipcMain.handle('save-settings', async (event, settings) => {
  try {
    await fs.promises.writeFile(settingsPath, JSON.stringify(settings, null, 2));
    return { success: true };
  } catch (error) {
    console.error('Error saving settings:', error);
    return { success: false, error: error.message };
  }
});

// Manejador para cargar configuración
ipcMain.handle('load-settings', async () => {
  try {
    if (fs.existsSync(settingsPath)) {
      const data = await fs.promises.readFile(settingsPath, 'utf8');
      return { success: true, settings: JSON.parse(data) };
    }
    return { success: true, settings: null };
  } catch (error) {
    console.error('Error loading settings:', error);
    return { success: false, error: error.message };
  }
}); 