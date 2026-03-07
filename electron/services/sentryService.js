const Sentry = require('@sentry/electron/main');
const { app } = require('electron');

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
      console.log('[SentryService] Log de info enviado a Sentry:', message, context);
    } catch (err) {
      console.error('[SentryService] Error al enviar logInfo:', err);
    }
  }
  logWarning(message, context = {}) {
    if (!this.isInitialized) return;
    try {
      Sentry.captureMessage(message, {contexts: context,level: "warning" });
      console.log('[SentryService] Log de advertencia enviado a Sentry:', message, context);
    } catch (err) {
      console.error('[SentryService] Error al enviar logWarning:', err);
    }
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
          console.error('[SentryService] Error enviado a Sentry:', errorOrMessage, context);
        } else {
          Sentry.captureMessage(String(errorOrMessage), {contexts: context,level: "error" });
          console.error('[SentryService] Mensaje de error enviado a Sentry:', errorOrMessage, context);
        }
      });
    } catch (err) {
      console.error('[SentryService] Error al enviar logError:', err);
    }
  }
}

module.exports = new SentryService();