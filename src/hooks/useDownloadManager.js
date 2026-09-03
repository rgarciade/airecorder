import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * useDownloadManager.js — hook global de descargas de modelos Whisper,
 * montado en `App.jsx` (design.md D9, contrato IPC `resources:*`).
 *
 * Mismo patrón de pull inicial + suscripción que `useQueueManager.js`
 * (`resources.getQueue()`/`resources.onProgress()`, patrón `useQueueManager`)
 * pero para el canal `resources:*` en vez de `getTranscriptionQueue`/
 * `onQueueUpdate` (IND1, DL2).
 *
 * Además del snapshot crudo (`items`/`queue`/`active`), calcula la
 * visibilidad automática del bocadillo (IND5): permanece "visible" mientras
 * haya ≥1 descarga activa/en cola, o mientras alguna descarga que este hook
 * llegó a ver activa haya terminado en error (para poder reintentar); se
 * "resuelve" (deja de reclamar visibilidad) solo cuando TODAS las descargas
 * trackeadas en el batch actual terminan en `installed`. `close()` oculta la
 * UI sin cancelar nada (IND4) — se re-muestra automáticamente en cuanto
 * aparece una descarga NUEVA (un id no visto antes en este batch), sin
 * necesidad de que el usuario la vuelva a abrir manualmente (IND1).
 */
const EMPTY_SNAPSHOT = { items: [], queue: [], active: null };

export function useDownloadManager() {
  const [snapshot, setSnapshot] = useState(EMPTY_SNAPSHOT);
  const [closed, setClosed] = useState(false);
  // Set de ids vistos en `queue` durante el batch actual — memoria necesaria
  // para saber cuántas descargas formaban parte del batch y cuáles de ellas
  // ya resolvieron en error, incluso después de que `queue` (solo
  // activas/encoladas) deje de incluirlas.
  const trackedIdsRef = useRef(new Set());

  const applySnapshot = useCallback((data) => {
    if (!data?.ok) return;
    const items = data.items || [];
    const queue = data.queue || [];

    let sawNewId = false;
    for (const entry of queue) {
      if (!trackedIdsRef.current.has(entry.id)) {
        trackedIdsRef.current.add(entry.id);
        sawNewId = true;
      }
    }

    const hasPending = queue.length > 0;
    const hasTrackedError = Array.from(trackedIdsRef.current).some((id) => {
      const item = items.find((entry) => entry.id === id);
      return item?.state === 'error';
    });

    // Batch totalmente resuelto (nada pendiente, nada en error) — se limpia
    // la memoria para que el próximo batch empiece de cero.
    if (!hasPending && !hasTrackedError) {
      trackedIdsRef.current.clear();
    }

    setSnapshot({ items, queue, active: data.active || null });
    // Una descarga nueva siempre reabre el bocadillo, incluso si el usuario
    // lo había cerrado antes (IND1 prevalece sobre un cierre anterior).
    if (sawNewId) setClosed(false);
  }, []);

  const loadQueueData = useCallback(async () => {
    try {
      const result = await window.electronAPI?.resources?.getQueue?.();
      applySnapshot(result);
    } catch (error) {
      console.error('[useDownloadManager] Error loading queue data:', error);
    }
  }, [applySnapshot]);

  useEffect(() => {
    loadQueueData();

    const unsubscribe = window.electronAPI?.resources?.onProgress?.((data) => {
      applySnapshot(data);
    });

    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [loadQueueData, applySnapshot]);

  const close = useCallback(() => setClosed(true), []);

  const hasPending = snapshot.queue.length > 0;
  const trackedIds = Array.from(trackedIdsRef.current);
  const hasTrackedError = trackedIds.some((id) => {
    const item = snapshot.items.find((entry) => entry.id === id);
    return item?.state === 'error';
  });

  const visible = !closed && (hasPending || hasTrackedError);

  // BUG FIX (post-review): `batchDone` debe contar SOLO los ítems
  // trackeados cuyo estado actual es `installed` (éxito real) — no
  // simplemente "ya no está en `queue`". Un ítem que salió de la cola
  // porque terminó en `error` sigue contando en `batchTotal` pero NO debe
  // sumar a `batchDone`, para que "N de M" refleje éxitos reales.
  const batchDone = trackedIds.filter((id) => {
    const item = snapshot.items.find((entry) => entry.id === id);
    return item?.state === 'installed';
  }).length;

  return {
    items: snapshot.items,
    queue: snapshot.queue,
    active: snapshot.active,
    visible,
    close,
    batchTotal: trackedIds.length,
    batchDone,
  };
}

export default useDownloadManager;
