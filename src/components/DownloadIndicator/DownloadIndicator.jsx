/**
 * DownloadIndicator.jsx — bocadillo global de descargas de modelos Whisper
 * (design.md D9, IND1-6). Componente presentacional puro: recibe el
 * snapshot ya resuelto por `useDownloadManager` (montado en `App.jsx`, mismo
 * criterio que `queueState`/`TranscriptionQueue.jsx`) — no hace su propio
 * data-fetching ni IPC, salvo `resources.retry()` para el botón de
 * reintentar (mismo canal dedicado que `ModelsSection.jsx`, NO
 * `resources.download()` — limpia parciales antes de relanzar).
 *
 * Contraído: nombre + % de la descarga activa (IND2), o un resumen de error
 * accionable si no hay ninguna activa pero sí alguna fallida trackeada
 * (IND5 — "permanece visible con reintentar accionable"). Click en la
 * cápsula contraída expande el detalle de cola + resumen "N de M
 * descargas" (IND2). Click en el cuerpo expandido navega a Ajustes →
 * Transcripción → Modelos y descargas (IND3) — excepto los botones
 * explícitos (colapsar, cerrar, reintentar), que usan `stopPropagation`.
 * Cerrar solo oculta localmente (delegado a `onClose`, IND4): nunca llama
 * `resources.cancel()`.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MdClose, MdExpandMore, MdCloudDownload, MdRefresh } from 'react-icons/md';
import styles from './DownloadIndicator.module.css';

const ERROR_CODE_KEY_MAP = {
  'insufficient-space': 'insufficientSpace',
  network: 'network',
  cancelled: 'cancelled',
  unknown: 'unknown',
};

export default function DownloadIndicator({
  items = [],
  queue = [],
  active = null,
  batchTotal = 0,
  batchDone = 0,
  onClose,
  onNavigateToSettings,
}) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  const erroredItems = items.filter((item) => item.state === 'error');

  const handleClose = (e) => {
    e.stopPropagation();
    onClose?.();
  };

  const handleToggleExpand = (e) => {
    e?.stopPropagation();
    setExpanded((prev) => !prev);
  };

  const handleBodyClick = () => {
    onNavigateToSettings?.();
  };

  const handleRetryClick = (e, id) => {
    e.stopPropagation();
    window.electronAPI?.resources?.retry?.(id);
  };

  if (!expanded) {
    return (
      <div
        className={`${styles.indicator} ${styles.collapsed}`}
        data-testid="download-indicator"
        onClick={handleToggleExpand}
      >
        <MdCloudDownload className={styles.icon} size={18} />
        {active ? (
          <span className={styles.label} data-testid="download-indicator-active-label">
            {t('downloadIndicator.activeLabel', { model: active.id, percent: active.percent })}
          </span>
        ) : (
          <span className={styles.label} data-testid="download-indicator-error-label">
            {t('downloadIndicator.errorLabel', { count: erroredItems.length })}
          </span>
        )}
        <button
          type="button"
          className={styles.closeBtn}
          data-testid="download-indicator-close"
          onClick={handleClose}
          title={t('common.close')}
        >
          <MdClose size={14} />
        </button>
      </div>
    );
  }

  return (
    <div
      className={`${styles.indicator} ${styles.expanded}`}
      data-testid="download-indicator-expanded"
      onClick={handleBodyClick}
    >
      <div className={styles.header}>
        <span className={styles.title}>{t('downloadIndicator.title')}</span>
        <div className={styles.headerActions}>
          <button
            type="button"
            className={styles.iconBtn}
            data-testid="download-indicator-collapse"
            onClick={handleToggleExpand}
          >
            <MdExpandMore size={18} />
          </button>
          <button
            type="button"
            className={styles.iconBtn}
            data-testid="download-indicator-close"
            onClick={handleClose}
          >
            <MdClose size={16} />
          </button>
        </div>
      </div>

      <p className={styles.summary} data-testid="download-indicator-summary">
        {t('downloadIndicator.summary', { done: batchDone, total: batchTotal })}
      </p>

      <div className={styles.list}>
        {queue.map((entry) => (
          <div key={entry.id} className={styles.row} data-testid={`download-indicator-row-${entry.id}`}>
            <span className={styles.rowName}>{entry.id}</span>
            <span className={styles.rowPercent} data-testid={`download-indicator-percent-${entry.id}`}>
              {entry.percent}%
            </span>
          </div>
        ))}
        {erroredItems.map((item) => (
          <div key={item.id} className={styles.row} data-testid={`download-indicator-row-${item.id}`}>
            <span className={styles.rowName}>{item.id}</span>
            <span className={styles.rowError}>
              {t(`settings.modelsSection.errors.${ERROR_CODE_KEY_MAP[item.error?.code] || 'unknown'}`)}
            </span>
            <button
              type="button"
              className={styles.retryBtn}
              data-testid={`download-indicator-retry-${item.id}`}
              onClick={(e) => handleRetryClick(e, item.id)}
            >
              <MdRefresh size={14} /> {t('settings.buttons.retry')}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
