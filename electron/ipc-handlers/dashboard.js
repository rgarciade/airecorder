const { ipcMain } = require('electron');
const dbService = require('../database/dbService');

module.exports.registerDashboardHandlers = () => {

  // Nuevos IPCs para Dashboard
  ipcMain.handle('get-dashboard-stats', () => {
    const stats = dbService.getDashboardStats();
    console.log('[DEBUG] Stats requested:', stats);
    return stats;
  });

};