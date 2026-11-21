import React from 'react';
import { useTranslation } from 'react-i18next';
import styles from './NoteGenerationIndicator.module.css';

/**
 * Indicador NO bloqueante de la generación de nota desde plantilla: píldora flotante con
 * spinner + "Cancelar" mientras genera, o aviso de error descartable. No cubre la pantalla
 * ni intercepta clics fuera de sí misma.
 */
export default function NoteGenerationIndicator({ isGenerating, error, onCancel, onDismissError }) {
  const { t } = useTranslation();
  if (!isGenerating && !error) return null;

  if (error) {
    return (
      <div className={`${styles.pill} ${styles.errorPill}`} role="alert">
        <span className={styles.text}>{t('templates.noteGeneration.error', { message: error })}</span>
        <button type="button" className={styles.action} onClick={onDismissError}>
          {t('templates.noteGeneration.dismiss')}
        </button>
      </div>
    );
  }

  return (
    <div className={styles.pill} role="status">
      <span className={styles.spinner} aria-hidden="true" />
      <span className={styles.text}>
        {t('templates.noteGeneration.generating')}
        <span className={styles.hint}>{t('templates.noteGeneration.generatingHint')}</span>
      </span>
      <button type="button" className={styles.action} onClick={onCancel}>
        {t('templates.noteGeneration.cancel')}
      </button>
    </div>
  );
}
