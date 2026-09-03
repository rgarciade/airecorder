/**
 * ModelsSection.jsx — Ajustes → "Modelos y descargas" (PR2, Fase 3).
 *
 * Gestiona el inventario y las descargas de modelos Whisper vía el canal
 * IPC `resources:*` (design.md — contrato IPC `resources:*`):
 *   - Pull inicial con `resources.list()` + suscripción a `resources.onProgress()`
 *     (snapshot completo, no delta — ver design.md "Decisión de shape").
 *   - Descarga: `checkSpace()` → confirmación mostrando finalidad/tamaño/
 *     libre/restante → `download()`. Espacio insuficiente bloquea sin encolar (DL1).
 *   - Progreso en vivo por modelo activo desde `queue` (DL2).
 *   - Cancelar/reintentar (`cancel`/`retry` — DL3/DL4). `retry` es un canal
 *     IPC dedicado (agregado en el fix pass post-review de PR1), NO un alias
 *     de `download`: limpia parciales y relanza desde estado limpio.
 *   - Borrado con confirmación mostrando espacio a liberar y guardia
 *     (`reason: 'default-model'|'in-queue'` — DL5). El guard solo se conoce
 *     al intentar `resources.remove()`: no existe un endpoint de
 *     pre-chequeo separado en el contrato IPC.
 *
 * Monta `DiskSpaceIndicator` (D10) encima de la lista de modelos.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { MdCloudDownload, MdDownload, MdClose, MdRefresh, MdDeleteOutline } from 'react-icons/md';
import styles from '../../Settings.module.css';
import sectionStyles from './ModelsSection.module.css';
import { useSettings } from '../../SettingsContext';
import DiskSpaceIndicator from '../../../../components/DiskSpaceIndicator/DiskSpaceIndicator.jsx';
import ConfirmModal from '../../../../components/ConfirmModal/ConfirmModal.jsx';
import { formatGb } from '../../../../utils/formatBytes.js';

const STATE_KEY_MAP = {
  'not-installed': 'notInstalled',
  queued: 'queued',
  downloading: 'downloading',
  installed: 'installed',
  deleting: 'deleting',
  error: 'error',
};

const ERROR_CODE_KEY_MAP = {
  'insufficient-space': 'insufficientSpace',
  network: 'network',
  cancelled: 'cancelled',
  unknown: 'unknown',
};

export default function ModelsSection() {
  const { t } = useSettings();
  const [items, setItems] = useState([]);
  const [queue, setQueue] = useState([]);
  // { id, estimatedBytes, freeBytes, totalBytes, requiredBytes, remainingAfterBytes }
  const [downloadConfirm, setDownloadConfirm] = useState(null);
  // { id, freeBytes, estimatedBytes }
  const [insufficientSpace, setInsufficientSpace] = useState(null);
  // { id, estimatedBytes } — freeBytes no se pudo verificar (statfsSync
  // falló en el backend), distinto de "espacio insuficiente" (CRITICAL,
  // fix post-review PR2).
  const [spaceUnavailable, setSpaceUnavailable] = useState(null);
  // { id, installedBytes }
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  // { id, reason: 'default-model'|'in-queue' }
  const [deleteGuard, setDeleteGuard] = useState(null);
  // { id, error } — fallo de borrado sin `reason` (spawn/proceso/protocolo
  // stdout, ver resourceManager.js#runDeleteProcess) — antes se descartaba
  // en silencio (CRITICAL, fix post-review PR2).
  const [deleteError, setDeleteError] = useState(null);
  // 'loading' | 'ready' | 'error' — la carga inicial de resources.list()
  // no tenía manejo de fallo y podía dejar la sección en blanco
  // indefinidamente (CRITICAL, fix post-review PR2).
  const [loadStatus, setLoadStatus] = useState('loading');
  const [reloadToken, setReloadToken] = useState(0);

  const applySnapshot = useCallback((snapshot) => {
    if (!snapshot?.ok) return;
    setItems(snapshot.items || []);
    setQueue(snapshot.queue || []);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoadStatus('loading');

    Promise.resolve(window.electronAPI?.resources?.list?.())
      .then((snapshot) => {
        if (cancelled) return;
        applySnapshot(snapshot);
        setLoadStatus('ready');
      })
      .catch(() => {
        if (!cancelled) setLoadStatus('error');
      });

    const unsubscribe = window.electronAPI?.resources?.onProgress?.((snapshot) => {
      applySnapshot(snapshot);
    });

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [applySnapshot, reloadToken]);

  const handleRetryLoad = () => setReloadToken((token) => token + 1);

  const queueEntryFor = (id) => queue.find((entry) => entry.id === id);

  const handleDownloadClick = async (id) => {
    setInsufficientSpace(null);
    setSpaceUnavailable(null);
    const result = await window.electronAPI?.resources?.checkSpace?.(id);
    if (!result?.ok) return;
    // `freeBytes: null` significa "no se pudo verificar el espacio"
    // (statfsSync falló en el backend), NO "espacio insuficiente" — se
    // distingue explícitamente en vez de bloquear con el mensaje de espacio
    // insuficiente como si fuera lo mismo (CRITICAL, fix post-review PR2).
    if (result.freeBytes == null) {
      setSpaceUnavailable({ id, estimatedBytes: result.estimatedBytes });
      return;
    }
    if (result.sufficient === false) {
      setInsufficientSpace({ id, freeBytes: result.freeBytes, estimatedBytes: result.estimatedBytes });
      return;
    }
    setDownloadConfirm({
      id,
      estimatedBytes: result.estimatedBytes,
      freeBytes: result.freeBytes,
      remainingAfterBytes: result.remainingAfterBytes,
    });
  };

  const handleConfirmDownloadAccept = async () => {
    if (!downloadConfirm) return;
    const { id } = downloadConfirm;
    setDownloadConfirm(null);
    await window.electronAPI?.resources?.download?.(id);
  };

  /** Continuar la descarga aun sin haber podido verificar el espacio libre
   * (decisión explícita del usuario, bajo su propio riesgo). */
  const handleContinueDespiteUnknownSpace = async () => {
    if (!spaceUnavailable) return;
    const { id } = spaceUnavailable;
    setSpaceUnavailable(null);
    await window.electronAPI?.resources?.download?.(id);
  };

  const handleCancelDownload = async (id) => {
    await window.electronAPI?.resources?.cancel?.(id);
  };

  const handleRetry = async (id) => {
    // `retry` (no `download`): limpia parciales antes de relanzar (D4/DL4).
    await window.electronAPI?.resources?.retry?.(id);
  };

  const handleDeleteClick = (id) => {
    const item = items.find((entry) => entry.id === id);
    setDeleteGuard(null);
    setDeleteError(null);
    setDeleteConfirm({ id, installedBytes: item?.installedBytes ?? null });
  };

  const handleConfirmDeleteAccept = async () => {
    if (!deleteConfirm) return;
    const { id } = deleteConfirm;
    setDeleteConfirm(null);
    const result = await window.electronAPI?.resources?.remove?.(id);
    if (result && result.ok === false && result.reason) {
      setDeleteGuard({ id, reason: result.reason });
    } else if (result && result.ok === false) {
      // Fallos de spawn/proceso/protocolo stdout (sin `reason` de guardia,
      // ver resourceManager.js#runDeleteProcess) — antes se descartaban en
      // silencio (CRITICAL, fix post-review PR2).
      setDeleteError({ id, error: result.error || 'unknown' });
    }
  };

  return (
    <section className={styles.section}>
      <div className={styles.sectionHeader}>
        <div className={styles.sectionTitleGroup}>
          <MdCloudDownload className={styles.sectionIcon} size={20} />
          <h3 className={styles.sectionTitle}>{t('settings.modelsSection.title')}</h3>
        </div>
      </div>

      <DiskSpaceIndicator />

      {loadStatus === 'error' && (
        <div className={styles.card} data-testid="models-list-error">
          <p className={styles.errorText}>{t('settings.modelsSection.loadError')}</p>
          <button
            type="button"
            className={styles.checkBtn}
            data-testid="models-list-retry"
            onClick={handleRetryLoad}
          >
            <MdRefresh size={16} /> {t('settings.buttons.retry')}
          </button>
        </div>
      )}

      <div className={styles.card} data-testid="models-list">
        {items.map((item) => {
          const queueEntry = queueEntryFor(item.id);
          const stateKey = STATE_KEY_MAP[item.state] || 'notInstalled';

          return (
            <div key={item.id} className={sectionStyles.row} data-testid={`model-row-${item.id}`}>
              <div className={sectionStyles.info}>
                <span className={sectionStyles.name}>
                  {item.id}
                  {item.recommended ? ` (${t('settings.misc.recommended')})` : ''}
                </span>
                <span className={sectionStyles.size}>{formatGb(item.estimatedBytes)}</span>
                <span className={sectionStyles.state} data-testid={`model-state-${item.id}`}>
                  {t(`settings.modelsSection.states.${stateKey}`)}
                </span>
                {item.state === 'downloading' && (
                  <span className={sectionStyles.progress} data-testid={`model-progress-${item.id}`}>
                    {queueEntry?.percent ?? 0}%
                  </span>
                )}
                {item.state === 'error' && (
                  <span className={styles.errorText}>
                    {t(`settings.modelsSection.errors.${ERROR_CODE_KEY_MAP[item.error?.code] || 'unknown'}`)}
                  </span>
                )}
              </div>

              <div className={sectionStyles.actions}>
                {item.state === 'not-installed' && (
                  <button
                    type="button"
                    className={styles.checkBtn}
                    data-testid={`download-btn-${item.id}`}
                    onClick={() => handleDownloadClick(item.id)}
                  >
                    <MdDownload size={16} /> {t('settings.buttons.download')}
                  </button>
                )}
                {(item.state === 'downloading' || item.state === 'queued') && (
                  <button
                    type="button"
                    className={styles.checkBtn}
                    data-testid={`cancel-btn-${item.id}`}
                    onClick={() => handleCancelDownload(item.id)}
                  >
                    <MdClose size={16} /> {t('settings.buttons.cancel')}
                  </button>
                )}
                {item.state === 'error' && (
                  <button
                    type="button"
                    className={styles.checkBtn}
                    data-testid={`retry-btn-${item.id}`}
                    onClick={() => handleRetry(item.id)}
                  >
                    <MdRefresh size={16} /> {t('settings.buttons.retry')}
                  </button>
                )}
                {item.state === 'installed' && (
                  <button
                    type="button"
                    className={styles.checkBtn}
                    data-testid={`delete-btn-${item.id}`}
                    onClick={() => handleDeleteClick(item.id)}
                  >
                    <MdDeleteOutline size={16} /> {t('settings.buttons.delete')}
                  </button>
                )}
              </div>

              {insufficientSpace?.id === item.id && (
                <p className={styles.errorText} data-testid={`insufficient-space-${item.id}`}>
                  {t('settings.modelsSection.confirm.insufficientSpace', {
                    free: formatGb(insufficientSpace.freeBytes),
                    required: formatGb(insufficientSpace.estimatedBytes),
                  })}
                </p>
              )}

              {spaceUnavailable?.id === item.id && (
                <div data-testid={`space-unavailable-${item.id}`}>
                  <p className={styles.errorText}>
                    {t('settings.modelsSection.confirm.spaceUnavailable', {
                      required: formatGb(spaceUnavailable.estimatedBytes),
                    })}
                  </p>
                  <button
                    type="button"
                    className={styles.checkBtn}
                    data-testid={`space-unavailable-continue-${item.id}`}
                    onClick={() => handleContinueDespiteUnknownSpace()}
                  >
                    {t('settings.buttons.continueAnyway')}
                  </button>
                </div>
              )}

              {deleteGuard?.id === item.id && (
                <p className={styles.errorText} data-testid={`delete-guard-${item.id}`}>
                  {t(`settings.modelsSection.deleteGuard.${deleteGuard.reason === 'default-model' ? 'defaultModel' : 'inQueue'}`)}
                </p>
              )}

              {deleteError?.id === item.id && (
                <p className={styles.errorText} data-testid={`delete-error-${item.id}`}>
                  {t('settings.modelsSection.confirm.deleteError', { error: deleteError.error })}
                </p>
              )}
            </div>
          );
        })}
      </div>

      <ConfirmModal
        isOpen={!!downloadConfirm}
        title={t('settings.modelsSection.confirm.downloadTitle')}
        message={downloadConfirm && (
          <span data-testid="download-confirm-modal">
            <span data-testid="download-confirm-purpose">
              {t('settings.modelsSection.confirm.purpose', { model: downloadConfirm.id })}
            </span>
            <br />
            <span data-testid="download-confirm-size">
              {t('settings.modelsSection.confirm.size', { size: formatGb(downloadConfirm.estimatedBytes) })}
            </span>
            <br />
            <span data-testid="download-confirm-free">
              {t('settings.modelsSection.confirm.free', { free: formatGb(downloadConfirm.freeBytes) })}
            </span>
            <br />
            <span data-testid="download-confirm-remaining">
              {t('settings.modelsSection.confirm.remaining', { remaining: formatGb(downloadConfirm.remainingAfterBytes) })}
            </span>
          </span>
        )}
        confirmText={t('settings.buttons.download')}
        cancelText={t('settings.buttons.cancel')}
        onConfirm={handleConfirmDownloadAccept}
        onCancel={() => setDownloadConfirm(null)}
        confirmTestId="download-confirm-accept"
        cancelTestId="download-confirm-cancel"
      />

      <ConfirmModal
        isOpen={!!deleteConfirm}
        title={t('settings.modelsSection.confirm.deleteTitle')}
        message={deleteConfirm && (
          <span data-testid="delete-confirm-modal">
            <span data-testid="delete-confirm-freed">
              {t('settings.modelsSection.confirm.freedSpace', { size: formatGb(deleteConfirm.installedBytes) })}
            </span>
          </span>
        )}
        confirmText={t('settings.buttons.delete')}
        cancelText={t('settings.buttons.cancel')}
        onConfirm={handleConfirmDeleteAccept}
        onCancel={() => setDeleteConfirm(null)}
        isDanger
        confirmTestId="delete-confirm-accept"
        cancelTestId="delete-confirm-cancel"
      />
    </section>
  );
}
