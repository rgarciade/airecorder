const { BrowserWindow, ipcMain, screen } = require('electron');
const path = require('path');

const PRELOAD_PATH = path.join(__dirname, '..', 'preload.js');
const DIST_INDEX   = path.join(__dirname, '..', '..', 'dist', 'index.html');

let floatingWindow = null;

function getMainWindow() {
  return BrowserWindow.getAllWindows().find(
    w => !floatingWindow || w.id !== floatingWindow.id
  );
}

function createFloatingWindow(elapsed = 0, muted = false) {
  if (floatingWindow && !floatingWindow.isDestroyed()) {
    floatingWindow.show();
    return;
  }

  const { width: sw } = screen.getPrimaryDisplay().workAreaSize;

  floatingWindow = new BrowserWindow({
    width: 264,
    height: 58,
    x: sw - 280,
    y: 16,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    hasShadow: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      preload: PRELOAD_PATH,
      webSecurity: false,
    },
  });

  floatingWindow.setAlwaysOnTop(true, 'floating');

  if (process.env.NODE_ENV === 'development') {
    floatingWindow.loadURL(
      `http://localhost:5173/?view=floating&elapsed=${elapsed}&muted=${muted ? '1' : '0'}`
    );
  } else {
    floatingWindow.loadFile(DIST_INDEX, {
      query: { view: 'floating', elapsed: String(elapsed), muted: muted ? '1' : '0' },
    });
  }

  floatingWindow.on('closed', () => { floatingWindow = null; });
}

function registerFloatingHandlers() {
  ipcMain.handle('show-floating-window', (_event, { elapsed = 0, muted = false } = {}) => {
    createFloatingWindow(elapsed, muted);
  });

  ipcMain.handle('hide-floating-window', () => {
    if (floatingWindow && !floatingWindow.isDestroyed()) {
      floatingWindow.close();
    }
    const mainWin = getMainWindow();
    if (mainWin && !mainWin.isDestroyed()) {
      mainWin.webContents.send('floating-window-hidden');
    }
  });

  ipcMain.on('floating-toggle-mute', () => {
    const mainWin = getMainWindow();
    if (mainWin && !mainWin.isDestroyed()) {
      mainWin.webContents.send('relay-toggle-mute');
    }
  });

  ipcMain.on('floating-stop-recording', () => {
    const mainWin = getMainWindow();
    if (mainWin && !mainWin.isDestroyed()) {
      mainWin.show();
      mainWin.focus();
      mainWin.webContents.send('relay-stop-recording');
    }
  });

  ipcMain.on('floating-discard-recording', () => {
    const mainWin = getMainWindow();
    if (mainWin && !mainWin.isDestroyed()) {
      mainWin.webContents.send('relay-discard-recording');
    }
  });

  ipcMain.on('main-mute-state-changed', (_event, muted) => {
    if (floatingWindow && !floatingWindow.isDestroyed()) {
      floatingWindow.webContents.send('mute-state-changed', muted);
    }
  });
}

module.exports = { registerFloatingHandlers };
