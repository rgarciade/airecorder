const { ipcMain } = require('electron');
const dgram = require('dgram');
const sentryService = require('../services/sentryService');

function sendMagicPacket(macAddress) {
  return new Promise((resolve, reject) => {
    const cleanMac = macAddress.replace(/[:-]/g, '');
    if (!/^[0-9A-Fa-f]{12}$/.test(cleanMac)) {
      return reject(new Error('Dirección MAC inválida'));
    }
    const macBytes = Buffer.from(cleanMac, 'hex');
    const packet = Buffer.alloc(102);
    packet.fill(0xff, 0, 6);
    for (let i = 1; i <= 16; i++) {
      macBytes.copy(packet, i * 6);
    }
    const socket = dgram.createSocket('udp4');
    socket.once('error', (err) => {
      socket.close();
      reject(err);
    });
    socket.bind(() => {
      socket.setBroadcast(true);
      socket.send(packet, 0, packet.length, 9, '255.255.255.255', (err) => {
        socket.close();
        if (err) reject(err);
        else resolve();
      });
    });
  });
}

function registerSystemHandlers() {
  ipcMain.handle('sentry-log-info', (event, message, context) => {
    sentryService.logInfo(message, context);
  });

  ipcMain.handle('sentry-log-error', (event, errorInfo, context) => {
    sentryService.logError(errorInfo, context);
  });

  ipcMain.handle('send-wol', async (event, macAddress) => {
    try {
      await sendMagicPacket(macAddress);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });
}

module.exports = {
  registerSystemHandlers
};