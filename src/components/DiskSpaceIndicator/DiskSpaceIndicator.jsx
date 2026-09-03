/**
 * DiskSpaceIndicator.jsx
 *
 * Componente reutilizable (design.md — D10) que muestra el espacio libre /
 * total del volumen donde vive la caché de modelos Whisper. Presentacional
 * con data-fetching propio: NO depende de `useDownloadManager` ni de
 * `SettingsContext` para poder montarse en cualquier vista (Ajustes →
 * Modelos y descargas HOY; onboarding más adelante, sin cambios de
 * contrato).
 *
 * INV5: refresca (`resources.refresh()`, fuerza rescan) en CADA montaje —
 * el `useEffect` con deps `[]` se re-ejecuta porque el componente se
 * desmonta/remonta al navegar entre vistas (no hay memoización de instancia
 * entre vistas), así que nunca muestra un valor stale heredado de un
 * montaje anterior.
 */
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MdStorage } from 'react-icons/md';
import styles from './DiskSpaceIndicator.module.css';
import { formatGb } from '../../utils/formatBytes.js';

export default function DiskSpaceIndicator({ className = '' }) {
  const { t } = useTranslation();
  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setSnapshot(null);

    Promise.resolve(window.electronAPI?.resources?.refresh?.())
      .then((result) => {
        if (cancelled) return;
        setSnapshot(result?.ok ? result : null);
      })
      .catch(() => {
        if (!cancelled) setSnapshot(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const freeLabel = formatGb(snapshot?.freeBytes);
  const totalLabel = formatGb(snapshot?.totalBytes);
  const unavailable = !loading && (freeLabel == null || totalLabel == null);

  return (
    <div className={`${styles.container} ${className}`.trim()} data-testid="disk-space-indicator">
      <MdStorage className={styles.icon} size={18} />
      {loading && (
        <span className={styles.text}>{t('settings.diskSpace.loading')}</span>
      )}
      {!loading && unavailable && (
        <span className={styles.text}>{t('settings.diskSpace.unavailable')}</span>
      )}
      {!loading && !unavailable && (
        <span className={styles.text} data-testid="disk-space-values">
          {t('settings.diskSpace.freeOfTotal', { free: freeLabel, total: totalLabel })}
        </span>
      )}
    </div>
  );
}
