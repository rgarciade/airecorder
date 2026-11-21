/**
 * resolveTranscribableModel.js — lógica compartida por los puntos de la app
 * que disparan una transcripción de forma implícita, SIN selector propio
 * (`Home.jsx` — auto-transcripción tras grabar/importar; `RecordingOverlay.jsx`
 * — auto-transcripción al guardar). INV6 (design.md — "Fuente única para
 * los 4 selectores"): resuelve `settings.whisperModel` (o `'small'` si no
 * está seteado) y confirma si está instalado ANTES de encolar nada — mismo
 * criterio que ya aplica `transcriptionManager.addTask()` en el backend
 * (PR1), ahora también en la UI para no encolar tareas que el backend va a
 * rechazar de todos modos.
 *
 * Falla CERRADO: si no se puede verificar el inventario (IPC ausente,
 * rechazo, o `{ ok: false }`), se reporta `installed: false` — mejor
 * bloquear con un CTA accionable que encolar una transcripción que
 * probablemente vaya a fallar en silencio.
 */
import { isModelInstalled } from './whisperModelGuard.js';

/**
 * @param {object} deps
 * @param {() => Promise<object>} deps.getSettings
 * @param {() => Promise<object>} [deps.listResources] - por defecto, `window.electronAPI.resources.list()`
 * @returns {Promise<{modelId: string, installed: boolean}>}
 */
export async function resolveTranscribableModel({
  getSettings,
  listResources = () => window.electronAPI?.resources?.list?.(),
} = {}) {
  const settings = await getSettings();
  const modelId = settings?.whisperModel || 'small';

  let items = [];
  try {
    const snapshot = await listResources();
    items = snapshot?.ok ? (snapshot.items || []) : [];
  } catch {
    items = [];
  }

  return { modelId, installed: isModelInstalled(items, modelId) };
}
