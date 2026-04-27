const { ipcMain } = require('electron');
const dbService = require('../database/dbService');

function registerExpertsHandlers() {
  // Obtener todas las customizaciones de un experto: { feature: instructions }
  ipcMain.handle('get-expert-customizations', (_event, expertId) => {
    return dbService.getExpertCustomizations(expertId);
  });

  // Guardar (upsert) una customización
  ipcMain.handle('save-expert-customization', (_event, { expertId, feature, instructions }) => {
    return dbService.saveExpertCustomization(expertId, feature, instructions);
  });

  // Resetear (eliminar) una customización: vuelve al original de fábrica
  ipcMain.handle('reset-expert-customization', (_event, { expertId, feature }) => {
    return dbService.resetExpertCustomization(expertId, feature);
  });
}

module.exports = { registerExpertsHandlers };
