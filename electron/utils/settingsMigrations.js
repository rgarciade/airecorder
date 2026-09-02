/**
 * Migraciones puras de settings.json legacy. Sin dependencias de Electron/fs —
 * reciben el objeto `settings` ya parseado y lo mutan in-place.
 * Separado de ipc-handlers/settings.js para poder testear las migraciones sin
 * arrastrar la cadena de requires de Electron (app.getPath, etc.).
 */

/**
 * 'geminifree' se fusionó con 'gemini' (una sola configuración, sin distinción
 * free/pro). Normaliza el provider y rescata la API Key/modelo del tier free
 * si el tier pago no estaba configurado.
 * @returns {boolean} true si modificó `settings` (hay que persistir)
 */
function migrateGeminiFreeTier(settings) {
  let changed = false;
  if (settings.aiProvider === 'geminifree') {
    settings.aiProvider = 'gemini';
    changed = true;
  }
  if (settings.embeddingProvider === 'geminifree') {
    settings.embeddingProvider = 'gemini';
    changed = true;
  }
  if (!settings.geminiApiKey && settings.geminiFreeApiKey) {
    settings.geminiApiKey = settings.geminiFreeApiKey;
    changed = true;
  }
  if (!settings.geminiModel && settings.geminiFreeModel) {
    settings.geminiModel = settings.geminiFreeModel;
    changed = true;
  }
  return changed;
}

/**
 * El rol de IA 'chat' se renombró a 'general' (tab 'Chat' → 'General').
 * Rescata el modelo general de conexiones custom guardado bajo la clave vieja
 * `customChatModel`. No borra la clave vieja — solo copia el valor si la nueva
 * aún no está seteada.
 * @returns {boolean} true si modificó `settings` (hay que persistir)
 */
function migrateCustomChatModelField(settings) {
  if (!settings.customGeneralModel && settings.customChatModel) {
    settings.customGeneralModel = settings.customChatModel;
    return true;
  }
  return false;
}

/**
 * Migración D7 (design.md): 'large' se renombra a 'large-v3'. Es un cambio de
 * string puro y SIN re-descarga — `faster_whisper/utils.py` ya mapea "large"
 * al mismo repo de HF ('Systran/faster-whisper-large-v3'), así que el modelo
 * ya descargado sigue estando en la misma carpeta de caché (INV2). No pide
 * confirmación al usuario, se aplica de forma silenciosa al iniciar.
 * @returns {boolean} true si modificó `settings` (hay que persistir)
 */
function migrateWhisperModelAlias(settings) {
  if (settings.whisperModel === 'large') {
    settings.whisperModel = 'large-v3';
    return true;
  }
  return false;
}

module.exports = { migrateGeminiFreeTier, migrateCustomChatModelField, migrateWhisperModelAlias };
