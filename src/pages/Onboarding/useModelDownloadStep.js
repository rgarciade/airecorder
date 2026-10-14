/**
 * useModelDownloadStep.js — estado del paso de onboarding "Modelo de
 * transcripción" (PR3, Fase 1).
 *
 * Vive fuera de `Onboarding.jsx` (regla anti-monolito de `AGENTS.md`), y hace
 * su propio data-fetching vía IPC `resources:*` — mismo criterio que
 * `DiskSpaceIndicator.jsx`/`ModelsSection.jsx` (design.md — D10, contrato IPC
 * `resources:*`): pull inicial con `resources.list()` + suscripción a
 * `resources.onProgress()` (snapshot completo, no delta).
 *
 * - Preselecciona `small` (ONB2).
 * - `selectModel(id)` cambia la selección activa SIN iniciar ninguna
 *   descarga (ONB2 — "cambiar la preselección").
 * - `startDownload()` inicia la descarga del modelo actualmente
 *   seleccionado. Si `resources:download` devuelve `{ ok: false }` de forma
 *   síncrona (p. ej. `insufficient-space`, ANTES de encolar nada — no pasa
 *   por el mecanismo de estado de error por ítem de `processQueue()`), se
 *   expone en `startError` en vez de descartarse en silencio (BLOCKER,
 *   fix post-review PR3). El botón de descarga sigue disponible para
 *   reintentar: el ítem nunca sale de `not-installed`.
 * - NO posee el tracking de "hay que persistir esto como default al
 *   completarse" (ONB4): ese estado vive un nivel más arriba, en
 *   `useOnboardingModelPersistence.js` (poseído por `Onboarding.jsx`, que
 *   permanece montado durante todo el wizard, a diferencia de este step —
 *   BLOCKER, fix post-review PR3: los refs locales que antes lo rastreaban
 *   morían al desmontarse `ModelStep` si el usuario avanzaba el wizard con
 *   la descarga en curso). Este hook solo avisa vía `onDownloadStart(id)`
 *   cuando una descarga arranca con éxito; quien la persista es
 *   responsabilidad del nivel elevado.
 */
import { useCallback, useEffect, useState } from 'react';

const DEFAULT_MODEL_ID = 'small';

export function useModelDownloadStep({ onDownloadStart } = {}) {
  const [items, setItems] = useState([]);
  const [queue, setQueue] = useState([]);
  const [selectedId, setSelectedId] = useState(DEFAULT_MODEL_ID);
  const [status, setStatus] = useState('loading'); // 'loading' | 'ready' | 'error'
  // { code } | null — fallo síncrono de `resources:download` (antes de
  // encolar nada). Distinto del estado de error por ítem que ya cubre
  // `processQueue()` en `items[].error` (BLOCKER, fix post-review PR3).
  const [startError, setStartError] = useState(null);

  const applySnapshot = useCallback((snapshot) => {
    if (!snapshot?.ok) return;
    setItems(snapshot.items || []);
    setQueue(snapshot.queue || []);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');

    Promise.resolve(window.electronAPI?.resources?.list?.())
      .then((snapshot) => {
        if (cancelled) return;
        applySnapshot(snapshot);
        setStatus('ready');
      })
      .catch(() => {
        if (!cancelled) setStatus('error');
      });

    const unsubscribe = window.electronAPI?.resources?.onProgress?.((snapshot) => {
      applySnapshot(snapshot);
    });

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [applySnapshot]);

  const selectModel = useCallback((id) => {
    setSelectedId(id);
  }, []);

  const startDownload = useCallback(async () => {
    setStartError(null);
    const result = await window.electronAPI?.resources?.download?.(selectedId);
    if (result && result.ok === false) {
      setStartError({ code: result.error || 'unknown' });
      return;
    }
    onDownloadStart?.(selectedId);
  }, [selectedId, onDownloadStart]);

  return {
    items,
    queue,
    selectedId,
    selectModel,
    startDownload,
    status,
    startError,
  };
}
