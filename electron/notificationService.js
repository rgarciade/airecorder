const { Notification } = require('electron');

class NotificationService {
  constructor() {
    this.mainWindow = null;
    this.enabled = true; // Default to true until settings are loaded
  }

  setMainWindow(window) {
    this.mainWindow = window;
  }

  updateSettings(settings) {
    if (settings && typeof settings.notificationsEnabled !== 'undefined') {
      this.enabled = settings.notificationsEnabled;
      console.log(`[NotificationService] Notifications enabled: ${this.enabled}`);
    }
  }

  show(title, body, payload = {}) {
    if (!this.enabled) {
      console.log('[NotificationService] Suppressed (disabled in settings)');
      return;
    }

    if (!Notification.isSupported()) {
      console.log('[NotificationService] Not supported on this system');
      return;
    }

    const notification = new Notification({
      title,
      body,
      silent: false,
    });

    notification.on('click', () => {
      console.log('[NotificationService] Clicked:', payload);
      if (this.mainWindow) {
        if (this.mainWindow.isMinimized()) this.mainWindow.restore();
        this.mainWindow.focus();
        this.mainWindow.webContents.send('notification-click', payload);
      }
    });

    notification.show();
  }
}

module.exports = new NotificationService();
