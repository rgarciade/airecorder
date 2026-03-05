const Sentry = require('@sentry/electron/main');

class SentryService {
  constructor() {
    this.isInitialized = false;
  }

  init() {
    const dsn = process.env.VITE_SENTRY_DSN;
    const isDev = process.env.NODE_ENV === 'development';
    const enableInDev = process.env.VITE_ENABLE_SENTRY_IN_DEV === 'true';

    if (dsn && (!isDev || enableInDev)) {
      try {
        console.log('[SentryService] Inicializando Sentry en Backend con DSN:', dsn);
        Sentry.init({
          dsn: dsn,
          environment: isDev ? 'development' : 'production',
          enableLogs: true,
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
      Sentry.logger.info(message, context);
      console.log('[SentryService] Log de info enviado a Sentry:', message, context);
    } catch (err) {
      console.error('[SentryService] Error al enviar logInfo:', err);
    }
  }
  logWarning(message, context = {}) {
    if (!this.isInitialized) return;
    
    try {
      Sentry.logger.warning(message, context);
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
          Sentry.captureMessage(String(errorOrMessage), 'error');
          console.error('[SentryService] Mensaje de error enviado a Sentry:', errorOrMessage, context);
        }
      });
    } catch (err) {
      console.error('[SentryService] Error al enviar logError:', err);
    }
  }
}

module.exports = new SentryService();