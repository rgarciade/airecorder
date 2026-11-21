import { useState, useEffect, useRef, useCallback } from 'react';
import ragService from '../services/ragService';
// Constante compartida main ↔ renderer: el texto del error sistémico se define
// UNA sola vez en electron/utils/ragErrors.json (dentro de electron/ porque el
// empaquetado sólo distribuye dist/ + electron-dist/) y también lo usa
// electron/services/ragService.js, así que la comparación no puede desincronizarse.
// Vite resuelve la ruta relativa y lo mete en el bundle del renderer.
import { NO_EMBEDDING_PROVIDER_ERROR } from '../../electron/utils/ragErrors.json';

/**
 * Cola secuencial de auto-indexado RAG de las grabaciones del chat de proyecto
 * (extraída de `ProjectDetail.jsx` para mantener la página delgada).
 *
 * Responsabilidades:
 * - Estado RAG por grabación: `ragStatuses` ({ [recId]: null|false|true|'skipped' }),
 *   `ragTotalChunks` ({ [recId]: number }) y el progreso `ragIndexingProgress`
 *   ({ current, total, title } | null) que `ContextBar` muestra vía `indexingProgress`.
 * - Al cambiar el chat activo (o su contexto), chequea el estado de las grabaciones
 *   pendientes en paralelo (lectura barata) e indexa las que falten **de una en una**
 *   para poder mostrar "Indexando grabación {current}/{total}: {title}".
 * - Si `ragService.indexRecording` devuelve el error sistémico
 *   `NO_EMBEDDING_PROVIDER_ERROR` (no hay provider de embeddings: el resto de la
 *   cola fallaría igual), la cola se corta y las pendientes vuelven a "no comprobado"
 *   (undefined) para poder reintentarse en una futura selección de chat.
 * - Expone `reindexAll(recordingIds)` para el botón "Re-indexar" de la página: misma
 *   cola (progreso en ContextBar + corte en el error sistémico), borrando antes cada
 *   índice (`deleteIndex`) para forzar el reindexado completo.
 *
 * Control de carreras (una sola cola activa):
 * - Los títulos se leen de un ref (`titlesRef`), así que `recordingSummaries` NO es
 *   dependencia del efecto: su carga en frío ya no re-lanza la cola a mitad del
 *   `getStatus` con `ragStatuses` obsoleto (antes se indexaba la misma grabación en
 *   paralelo dos veces).
 * - Todas las escrituras de estado pasan por `applyStatus`/`deleteStatus`, que
 *   mantienen un espejo síncrono en `statusesRef`; el filtro de pendientes del
 *   efecto siempre ve el valor real, no el del render anterior.
 * - `runningRef` + `rerunRef`: si el efecto se dispara mientras hay una cola en
 *   curso (p. ej. el usuario cambia de chat), no se arranca otra en paralelo; al
 *   terminar la activa se reevalúa el estado más reciente (`rerunTick` re-ejecuta
 *   el efecto) y se procesan las grabaciones que sigan pendientes.
 *
 * @param {Object} params
 * @param {number|null} params.activeChatId - Chat activo del proyecto
 * @param {Array} params.chats - Lista de chats (cada uno con `contexto: recId[]`)
 * @param {Array} params.recordingSummaries - Grabaciones del proyecto (para títulos)
 * @returns {{
 *   ragStatuses: Object,
 *   ragTotalChunks: Object,
 *   ragIndexingProgress: Object|null,
 *   reindexAll: (recordingIds: Array) => Promise<void>,
 * }}
 */
export function useRagAutoIndexQueue({ activeChatId, chats, recordingSummaries }) {
  const [ragStatuses, setRagStatuses] = useState({});
  const [ragTotalChunks, setRagTotalChunks] = useState({});
  const [ragIndexingProgress, setRagIndexingProgress] = useState(null);
  const [rerunTick, setRerunTick] = useState(0);

  // Espejo síncrono de ragStatuses: toda escritura pasa por aquí, de modo que el
  // efecto y la cola leen siempre el valor vigente (no el del último render).
  const statusesRef = useRef(ragStatuses);
  const titlesRef = useRef(recordingSummaries);
  const runningRef = useRef(false); // hay una cola secuencial en curso
  const rerunRef = useRef(false); // alguien pidió reevaluar al terminar la activa

  useEffect(() => {
    titlesRef.current = recordingSummaries;
  }, [recordingSummaries]);

  const applyStatus = useCallback((recId, value) => {
    statusesRef.current = { ...statusesRef.current, [recId]: value };
    setRagStatuses(statusesRef.current);
  }, []);

  const deleteStatus = useCallback((recId) => {
    const next = { ...statusesRef.current };
    delete next[recId];
    statusesRef.current = next;
    setRagStatuses(next);
  }, []);

  /**
   * Fase secuencial compartida por el auto-indexado y el botón "Re-indexar".
   * Marca toda la cola como "indexando" (false) de inmediato — mantiene el chat
   * deshabilitado (isAnyIndexing) durante toda la duración de la cola, no solo
   * mientras se procesa el elemento actual.
   */
  const runSequentialIndex = useCallback(async (recIds, { deleteFirst = false } = {}) => {
    recIds.forEach((id) => applyStatus(id, false));

    for (let i = 0; i < recIds.length; i++) {
      const recId = recIds[i];
      const recording = titlesRef.current.find(r => r.id === recId);
      setRagIndexingProgress({ current: i + 1, total: recIds.length, title: recording?.title || `Grabación ${recId}` });

      let result = null;
      try {
        if (deleteFirst) await ragService.deleteIndex(recId);
        result = await ragService.indexRecording(recId);
      } catch (err) {
        // IPC/handler caído: tratamos la grabación como no indexada (igual que un
        // error genérico) y seguimos con el resto en vez de colgar la barra.
        console.error(`[useRagAutoIndexQueue] Error indexando grabación ${recId}:`, err);
      }

      if (result?.skippedRag) {
        applyStatus(recId, 'skipped');
      } else if (result?.indexed) {
        applyStatus(recId, true);
        setRagTotalChunks(prev => ({ ...prev, [recId]: result.totalChunks || 0 }));
      } else if (result && result.error === NO_EMBEDDING_PROVIDER_ERROR) {
        // Fallo sistémico: el resto de la cola fallaría igual. Se corta aquí y las
        // pendientes vuelven a "no comprobado" (undefined) para poder reintentarse
        // en una futura selección de chat, en vez de quedar bloqueadas en false.
        applyStatus(recId, null);
        recIds.slice(i + 1).forEach(id => deleteStatus(id));
        break;
      } else {
        applyStatus(recId, null);
      }
    }

    setRagIndexingProgress(null);
  }, [applyStatus, deleteStatus]);

  const runQueue = useCallback(async (pendingRecIds) => {
    // Chequeo de estado en paralelo (barato, solo lectura): separa lo ya indexado
    // de lo que hay que encolar
    const toIndex = [];
    await Promise.all(pendingRecIds.map(async (recId) => {
      try {
        const statusResult = await ragService.getStatus(recId);
        if (statusResult.indexed) {
          applyStatus(recId, true);
          setRagTotalChunks(prev => ({ ...prev, [recId]: statusResult.totalChunks || 0 }));
        } else {
          toIndex.push(recId);
        }
      } catch (err) {
        console.error(`[useRagAutoIndexQueue] Error consultando estado de ${recId}:`, err);
        toIndex.push(recId);
      }
    }));

    if (toIndex.length === 0) return;
    await runSequentialIndex(toIndex);
  }, [applyStatus, runSequentialIndex]);

  // Arranca la cola evitando duplicados: si ya hay una en curso, marca la
  // reevaluación pendiente en vez de lanzar una segunda cola en paralelo.
  const startQueue = useCallback(async (pendingRecIds) => {
    if (runningRef.current) {
      rerunRef.current = true;
      return;
    }
    runningRef.current = true;
    try {
      await runQueue(pendingRecIds);
    } catch (err) {
      console.error('[useRagAutoIndexQueue] Error inesperado en la cola de indexado:', err);
      setRagIndexingProgress(null);
    } finally {
      runningRef.current = false;
      if (rerunRef.current) {
        // Mientras la cola corría cambió algo (chat activo/contexto): reevaluar
        // con el estado más reciente vía rerunTick → el efecto se re-ejecuta.
        rerunRef.current = false;
        setRerunTick(t => t + 1);
      }
    }
  }, [runQueue]);

  // Auto-indexar grabaciones del chat activo cuando cambia el chat seleccionado.
  // Las grabaciones aún no indexadas se procesan de una en una (no en paralelo) para
  // poder mostrar una barra de progreso con el título y la posición en la cola
  // (indexingProgress vía ContextBar).
  useEffect(() => {
    if (!activeChatId) return;
    const chat = chats.find(c => c.id === activeChatId);
    if (!chat?.contexto?.length) return;

    const pendingRecIds = chat.contexto.filter(recId => statusesRef.current[recId] === undefined);
    if (pendingRecIds.length === 0) return;

    startQueue(pendingRecIds);
  // ragStatuses se actualiza dentro de la cola (vía statusesRef) y relanzaría la
  // indexación; recordingSummaries solo aporta títulos y se lee vía titlesRef.
  }, [activeChatId, chats, rerunTick, startQueue]);

  /**
   * Re-indexado manual (botón "Re-indexar" del contexto del chat): borra cada
   * índice y vuelve a indexar de uno en uno, con el mismo progreso y el mismo
   * corte en el error sistémico que la cola de auto-indexado.
   */
  const reindexAll = useCallback(async (recordingIds) => {
    if (!recordingIds?.length || runningRef.current) return;
    runningRef.current = true;
    try {
      await runSequentialIndex(recordingIds, { deleteFirst: true });
    } catch (err) {
      console.error('[useRagAutoIndexQueue] Error inesperado en el re-indexado:', err);
      setRagIndexingProgress(null);
    } finally {
      runningRef.current = false;
      if (rerunRef.current) {
        rerunRef.current = false;
        setRerunTick(t => t + 1);
      }
    }
  }, [runSequentialIndex]);

  return { ragStatuses, ragTotalChunks, ragIndexingProgress, reindexAll };
}
