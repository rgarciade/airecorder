import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import speakersService from '../../services/speakersService';
import SpeakerDropdown from './SpeakerDropdown';
import styles from './MergeSpeakerDialog.module.css';

/**
 * Diálogo para vincular (merge) un hablante con otro.
 * Muestra preview con advertencias de embeddings y permite swap.
 */
const MergeSpeakerDialog = ({
  isOpen,
  sourceSpeaker,
  availableSpeakers,
  onConfirm,
  onCancel
}) => {
  const { t } = useTranslation();
  const [targetSpeakerId, setTargetSpeakerId] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [swapped, setSwapped] = useState(false);

  useEffect(() => {
    const loadPreview = async () => {
      if (!sourceSpeaker?.id || !targetSpeakerId) {
        setPreview(null);
        return;
      }

      setLoading(true);
      setError(null);

      // Usar IDs según dirección del swap
      const originId = swapped ? targetSpeakerId : sourceSpeaker.id;
      const destId = swapped ? sourceSpeaker.id : targetSpeakerId;
      const result = await speakersService.previewMergeSpeakers(originId, destId);

      if (result.success) {
        setPreview(result.data);
      } else {
        setError(result.error);
        setPreview(null);
      }

      setLoading(false);
    };

    loadPreview();
  }, [sourceSpeaker?.id, targetSpeakerId, swapped]);

  useEffect(() => {
    if (isOpen) {
      setTargetSpeakerId(null);
      setPreview(null);
      setError(null);
      setSwapped(false);
    }
  }, [isOpen]);

  const handleSwap = () => {
    if (!targetSpeakerId) return;
    setSwapped(!swapped);
    setError(null);
  };

  const targetSpeaker = availableSpeakers?.find(s => s.id === targetSpeakerId);

  const handleConfirm = async () => {
    if (!sourceSpeaker?.id || !targetSpeakerId || !preview) return;

    setLoading(true);
    setError(null);

    const result = await speakersService.mergeSimilarSpeaker(
      preview.finalTargetId,
      preview.finalSourceId
    );

    setLoading(false);

    if (result.success) {
      const mergedName = swapped
        ? sourceSpeaker?.displayName
        : targetSpeaker?.displayName;
      onConfirm({ ...result, mergedName: result.mergedName || mergedName });
    } else {
      setError(result.error);
    }
  };

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={onCancel}>
      <div className={styles.dialog} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
            </svg>
            {t('speakerDetail.linkDialogTitle', 'Vincular hablante')}
          </h2>
          <button className={styles.closeBtn} onClick={onCancel}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <div className={styles.body}>
          <p className={styles.description}>
            {t('speakerDetail.linkDialogDesc', 'Selecciona el hablante destino para vincular los datos. Los embeddings del hablante origen se reasignarán al destino.')}
          </p>

          <div className={styles.field}>
            <label className={styles.fieldLabel}>
              {swapped ? t('speakerDetail.targetLabel', 'Destino') : t('speakerDetail.sourceLabel', 'Origen')}
            </label>
            <div className={styles.speakerInfo}>
              <span className={styles.speakerAvatar}>
                {(sourceSpeaker?.displayName || '?').charAt(0).toUpperCase()}
              </span>
              <span className={styles.speakerName}>
                {sourceSpeaker?.displayName || t('speakers.unknown', 'Desconocido')}
              </span>
              <span className={styles.speakerMeta}>
                {sourceSpeaker?.recordingsCount || 0} {t('speakers.recordings')} · {sourceSpeaker?.embeddingsCount || 0} {t('speakers.embeddings')}
              </span>
            </div>
          </div>

          <div className={styles.arrowRow}>
            <button
              className={`${styles.swapBtn} ${swapped ? styles.swapBtnActive : ''}`}
              onClick={handleSwap}
              disabled={!targetSpeakerId}
              title={t('speakerDetail.swapDirection', 'Invertir dirección')}
              type="button"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <polyline points="19 12 12 19 5 12"></polyline>
              </svg>
            </button>
          </div>

          <div className={styles.field}>
            <label className={styles.fieldLabel}>
              {swapped ? t('speakerDetail.sourceLabel', 'Origen') : t('speakerDetail.targetLabel', 'Destino')}
            </label>
            <SpeakerDropdown
              speakers={availableSpeakers || []}
              selectedSpeaker={targetSpeaker}
              onSelect={(s) => setTargetSpeakerId(s.id)}
              placeholder={t('speakerDetail.selectTarget', 'Seleccionar destino...')}
              disabledIds={sourceSpeaker?.id ? [sourceSpeaker.id] : []}
            />
          </div>

          {loading && (
            <div className={styles.loadingPreview}>
              <span className={styles.spinner}></span>
              {t('speakerDetail.loadingPreview', 'Cargando vista previa...')}
            </div>
          )}

          {preview && !loading && (
            <div className={styles.previewPanel}>
              <div className={styles.previewTitle}>
                {t('speakerDetail.previewTitle', 'Vista previa')}
              </div>

              {preview.swapped && (
                <div className={styles.swapNotice}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="17 1 21 5 17 9"></polyline>
                    <path d="M3 11V9a4 4 0 0 1 4-4h14"></path>
                    <polyline points="7 23 3 19 7 15"></polyline>
                    <path d="M21 13v2a4 4 0 0 1-4 4H3"></path>
                  </svg>
                  {t('speakerDetail.swappedNotice', 'Se invertirá el orden para preservar embeddings')}
                </div>
              )}

              <div className={styles.embeddingsInfo}>
                <div className={styles.embeddingCount}>
                  <span className={styles.embeddingLabel}>{t('speakerDetail.sourceEmbeddings', 'Origen')}:</span>
                  <span className={styles.embeddingValue}>{preview.sourceEmbeddings}</span>
                </div>
                <div className={styles.embeddingCount}>
                  <span className={styles.embeddingLabel}>{t('speakerDetail.targetEmbeddings', 'Destino')}:</span>
                  <span className={styles.embeddingValue}>{preview.targetEmbeddings}</span>
                </div>
              </div>

              {preview.warnings?.length > 0 && (
                <ul className={styles.warningsList}>
                  {preview.warnings.map((warning, i) => (
                    <li key={i} className={styles.warningItem}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="8" x2="12" y2="12"></line>
                        <line x1="12" y1="16" x2="12.01" y2="16"></line>
                      </svg>
                      {warning}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {error && (
            <div className={styles.errorMessage}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="15" y1="9" x2="9" y2="15"></line>
                <line x1="9" y1="9" x2="15" y2="15"></line>
              </svg>
              {error}
            </div>
          )}
        </div>

        <div className={styles.footer}>
          <button className={styles.cancelBtn} onClick={onCancel} disabled={loading}>
            {t('common.cancel')}
          </button>
          <button
            className={styles.confirmBtn}
            onClick={handleConfirm}
            disabled={!targetSpeakerId || !preview || loading}
          >
            {loading ? t('common.loading', 'Procesando...') : t('speakerDetail.linkBtn', 'Vincular')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default MergeSpeakerDialog;
