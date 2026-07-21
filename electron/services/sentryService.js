const Sentry = require('@sentry/electron/main');
const { app } = require('electron');
const { getOrCreateInstallationId } = require('../utils/installationId');

class SentryService {
  constructor() {
    this.isInitialized = false;
  }

  init() {
    const dsn = process.env.VITE_SENTRY_DSN;
    const isDev = !app.isPackaged;
    const enableInDev = process.env.VITE_ENABLE_SENTRY_IN_DEV === 'true';

    if (dsn && (!isDev || enableInDev)) {
      try {
          
        console.log('[SentryService] Inicializando Sentry en Backend con DSN:', dsn);
        Sentry.init({
          dsn: dsn,
          environment: isDev ? 'development' : 'production',
        });
        this.isInitialized = true;
        Sentry.setUser({ id: getOrCreateInstallationId() });
      } catch (error) {   
        console.error('[SentryService] Error inicializando Sentry:', error);
      }
    } else {  
      console.log('[SentryService] Sentry desactivado en entorno actual.');
    }
  }

  logInfo(message, context = {}) {
    if (!this.isInitialized) return;   
    try {
      Sentry.captureMessage(message, {contexts: context,level: "info" });
    } catch (_) { /* silenciar para evitar recursión */ }
  }

  logWarning(message, context = {}) {
    if (!this.isInitialized) return;
    try {
      Sentry.captureMessage(message, {contexts: context,level: "warning" });
    } catch (_) { /* silenciar para evitar recursión */ }
  }

  logError(errorOrMessage, context = {}) {
    if (!this.isInitialized) return;

    try {
      Sentry.withScope((scope) => {
        if (context && Object.keys(context).length > 0) {
          scope.setExtras(context);
        }

        if (errorOrMessage instanceof Error) {
          Sentry.captureException(errorOrMessage);
        } else {
          Sentry.captureMessage(String(errorOrMessage), {contexts: context,level: "error" });
        }
      });
    } catch (_) { /* silenciar para evitar recursión */ }
  }
}

module.exports = new SentryService();