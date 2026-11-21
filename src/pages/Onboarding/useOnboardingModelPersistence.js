/**
 * useOnboardingModelPersistence.js — trackea las descargas de modelo Whisper
 * iniciadas desde el paso de onboarding "Modelo de transcripción" y persiste
 * `settings.whisperModel` cuando cada una de ellas transiciona a `installed`
 * (ONB4), incluso si el usuario ya avanzó a otro paso del wizard.
 *
 * Fix post-review PR3 (BLOCKER): antes este tracking vivía en refs locales a
 * `useModelDownloadStep.js` (`activeDownloadIdRef`/`previousStatesRef`), que
 * se desmontan junto con `ModelStep` al cambiar de paso — la detección de
 * "pasó a installed" dejaba de correr apenas el usuario avanzaba el wizard
 * con la descarga en curso, perdiendo la persistencia prometida por el spec
 * (ONB4, escenario "Terminar el onboarding con una descarga en curso").
 *
 * Por eso este hook vive en `Onboarding.jsx` — el único componente que
 * permanece montado durante todo el wizard — y expone `trackDownload(id)`
 * para que `ModelStep`/`useModelDownloadStep` lo invoquen sin poseer el
 * estado ellos mismos. La suscripción a `resources.onProgress()` para esta
 * lógica de persistencia corre acá, en paralelo e independiente de la
 * suscripción propia de `useModelDownloadStep` (misma UI), así que sigue
 * activa sin importar en qué paso del wizard esté el usuario.
 *
 * Usa un `Map` (no una única ref) para soportar más de una descarga en
 * tracking simultáneo: cambiar de modelo seleccionado mientras uno descarga
 * ya no pisa el tracking del anterior — cada id trackeado se resuelve de
 * forma independiente cuando su propio snapshot lo reporta `installed`.
 *
 * Fuera de alcance (design.md, Fase 4 / PR4 — bocadillo global): sobrevivir
 * un cierre completo de la app. Alcanza con sobrevivir mientras el wizard de
 * onboarding sigue abierto, sea cual sea el paso actual.
 */
import { useCallback, useEffect, useRef } from 'react';
import { updateSettings } from '../../services/settingsService';

export function useOnboardingModelPersistence() {
  // id -> último estado conocido ('downloading' | 'queued' | 'error' | ... | null)
  const trackedRef = useRef(new Map());

  const trackDownload = useCallback((id) => {
    if (!id) return;
    trackedRef.current.set(id, null);
  }, []);

  useEffect(() => {
    const unsubscribe = window.electronAPI?.resources?.onProgress?.((snapshot) => {
      if (!snapshot?.ok) return;
      const tracked = trackedRef.current;
      if (tracked.size === 0) return;

      const items = snapshot.items || [];
      for (const id of Array.from(tracked.keys())) {
        const item = items.find((entry) => entry.id === id);
        if (!item) continue;

        const previousState = tracked.get(id);
        if (item.state === 'installed' && previousState !== 'installed') {
          tracked.delete(id);
          updateSettings({ whisperModel: id }).catch((error) => {
            console.error('No se pudo persistir el modelo de transcripción por defecto:', error?.message || error);
          });
          continue;
        }
        tracked.set(id, item.state);
      }
    });

    return () => {
      unsubscribe?.();
    };
  }, []);

  return { trackDownload };
}
