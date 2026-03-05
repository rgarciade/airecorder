const { ipcMain } = require('electron');
const sentryService = require('../services/sentryService');

function registerSystemHandlers() {
  ipcMain.handle('sentry-log-info', (event, message, context) => {
    sentryService.logInfo(message, context);
  });

  ipcMain.handle('sentry-log-error', (event, errorInfo, context) => {
    sentryService.logError(errorInfo, context);
  });
}

module.exports = {
  registerSystemHandlers
};