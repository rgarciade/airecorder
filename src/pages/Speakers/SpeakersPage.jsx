import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import speakersService from '../../services/speakersService';
import SpeakerDropdown from '../../components/Speakers/SpeakerDropdown';
import useSpeakerList from '../../hooks/useSpeakerList';
import useSpeakerMerge from '../../hooks/useSpeakerMerge';
import styles from './SpeakersPage.module.css';

/**
 * Página principal del directorio de hablantes.
 * Muestra la lista de hablantes ordenada por nº de grabaciones DESC.
 * Incluye buscador client-side, estados vacíos, y botón de fusión de hablantes.
 */
const SpeakersPage = ({ onNavigateToSpeaker, onNavigateToSettings, diarizationEnabled }) => {
  const { t } = useTranslation();
  const [speakers, setSpeakers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Si la diarización está desactivada, mostrar mensaje y botón para ir a ajustes
  if (diarizationEnabled === false) {
    return (
      <div className={styles.container}>
        <h1 className={styles.title}>{t('speakers.title')}</h1>
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
            </svg>
          </div>
          <p className={styles.emptyText}>{t('speakers.disabled')}</p>
          <p className={styles.emptyText}>{t('speakers.disabledDesc')}</p>
          {onNavigateToSettings && (
            <button
              className={styles.settingsButton}
              onClick={onNavigateToSettings}
            >
              {t('speakers.goToSettings')}
            </button>
          )}
        </div>
      </div>
    );
  }

  const loadSpeakers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await speakersService.getSpeakersWithRecordings();
      setSpeakers(data);
    } catch (error) {
      console.error('[SpeakersPage] Error cargando hablantes:', error);
      setSpeakers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSpeakers();
  }, [loadSpeakers]);

  const {
    searchTerm,
    setSearchTerm,
    setCurrentPage,
    embeddingFilter,
    setEmbeddingFilter,
    filteredSpeakers,
    totalPages,
    safePage,
    paginatedSpeakers,
    mergeSpeakers,
    withEmbeddingsCount,
    noEmbeddingsCount
  } = useSpeakerList({ speakers });

  const {
    mergeModalOpen,
    mergeSourceId,
    setMergeSourceId,
    mergeTargetId,
    setMergeTargetId,
    mergeInProgress,
    mergeModalError,
    mergeStatus,
    preview,
    mergeSourceSpeaker,
    mergeTargetSpeaker,
    canMerge,
    handleOpenMergeModal,
    handleCloseMergeModal,
    handleMerge,
    clearMergeModalError
  } = useSpeakerMerge({
    speakers: mergeSpeakers,
    loadSpeakers,
    setCurrentPage,
    t
  });

  const previewSourceSpeaker = preview?.finalSourceId
    ? mergeSpeakers.find((speaker) => speaker.id === preview.finalSourceId)
    : mergeSourceSpeaker;

  const previewTargetSpeaker = preview?.finalTargetId
    ? mergeSpeakers.find((speaker) => speaker.id === preview.finalTargetId)
    : mergeTargetSpeaker;

  if (loading) {
    return (
      <div className={styles.container}>
        <h1 className={styles.title}>{t('speakers.title')}</h1>
        <div className={styles.loading}>{t('common.loading', 'Cargando...')}</div>
      </div>
    );
  }

  return (
    <>
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>{t('speakers.title')}</h1>
        <div className={styles.headerActions}>
          <div className={styles.searchWrapper}>
            <input
              type="text"
              className={styles.searchInput}
              placeholder={t('speakers.searchPlaceholder')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className={styles.embeddingFilter}>
            <button
              className={`${styles.filterBtn} ${embeddingFilter === 'all' ? styles.filterBtnActive : ''}`}
              onClick={() => setEmbeddingFilter('all')}
            >
              {t('speakers.filterAll', 'Todos')}
              <span className={styles.filterBadge}>{speakers.length}</span>
            </button>
            <button
              className={`${styles.filterBtn} ${embeddingFilter === 'with-embeddings' ? styles.filterBtnActive : ''}`}
              onClick={() => setEmbeddingFilter('with-embeddings')}
            >
              {t('speakers.filterWithEmbeddings', 'Con embeddings')}
              <span className={styles.filterBadge}>{withEmbeddingsCount}</span>
            </button>
            <button
              className={`${styles.filterBtn} ${embeddingFilter === 'no-embeddings' ? styles.filterBtnActive : ''}`}
              onClick={() => setEmbeddingFilter('no-embeddings')}
            >
              {t('speakers.filterNoEmbeddings', 'Sin embeddings')}
              <span className={`${styles.filterBadge} ${styles.filterBadgeWarning}`}>{noEmbeddingsCount}</span>
            </button>
          </div>
          {mergeSpeakers.length >= 2 && (
            <button
              className={styles.mergePageBtn}
              onClick={handleOpenMergeModal}
              title={t('speakers.mergeBtn')}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M8 7h12m0 0l-4-4m4 4l-4 4M4 17h12m0 0l-4-4m4 4l-4 4"></path>
              </svg>
              {t('speakers.mergeBtn')}
            </button>
          )}
        </div>
      </div>

      {mergeStatus && (
        <div className={`${styles.mergeStatusBanner} ${mergeStatus.success ? styles.mergeStatusSuccess : styles.mergeStatusError}`}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {mergeStatus.success ? (
              <polyline points="20 6 9 17 4 12"></polyline>
            ) : (
              <>
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </>
            )}
          </svg>
          <span>{mergeStatus.message}</span>
        </div>
      )}

      {speakers.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
            </svg>
          </div>
          <p className={styles.emptyText}>{t('speakers.emptyState')}</p>
        </div>
      ) : filteredSpeakers.length === 0 ? (
        <div className={styles.emptyState}>
          <p className={styles.emptyText}>{t('speakers.noResults')}</p>
        </div>
      ) : (
        <>
        <div className={styles.list}>
          {paginatedSpeakers.map((speaker) => (
            <button
              key={speaker.id}
              className={styles.speakerCard}
              onClick={() => onNavigateToSpeaker(speaker.id)}
            >
              <div className={styles.speakerAvatar}>
                {(speaker.displayName || '?').charAt(0).toUpperCase()}
              </div>
              <div className={styles.speakerInfo}>
                <span className={styles.speakerName}>
                  {speaker.displayName || t('speakers.unknown', 'Desconocido')}
                  {(speaker.embeddingsCount || 0) === 0 && (
                    <span className={styles.noEmbeddingBadge} title={t('speakers.noEmbeddingsTooltip', 'Sin embeddings de audio')}>
                      {t('speakers.noEmbeddings', 'Sin audio')}
                    </span>
                  )}
                </span>
                <span className={styles.speakerStats}>
                  {speaker.recordingsCount || 0} {t('speakers.recordings')}
                  {speaker.embeddingsCount > 0 && (
                    <> · {speaker.embeddingsCount} {t('speakers.embeddings')}</>
                  )}
                </span>
              </div>
              <div className={styles.speakerArrow}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="9 18 15 12 9 6"></polyline>
                </svg>
              </div>
            </button>
          ))}
        </div>
        {totalPages > 1 && (
          <div className={styles.pagination}>
            <button
              className={styles.paginationBtn}
              disabled={safePage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              aria-label={t('speakers.prevPage', 'Página anterior')}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="15 18 9 12 15 6"></polyline>
              </svg>
            </button>
            <span className={styles.paginationInfo}>
              {t('speakers.pageOf', 'Página')} {safePage} {t('speakers.of', 'de')} {totalPages}
            </span>
            <button
              className={styles.paginationBtn}
              disabled={safePage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              aria-label={t('speakers.nextPage', 'Página siguiente')}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="9 18 15 12 9 6"></polyline>
              </svg>
            </button>
          </div>
        )}
        </>
      )}
    </div>

    {/* Modal de fusión */}
    {mergeModalOpen && (
      <div
        className={styles.mergeOverlay}
        onClick={(e) => e.target === e.currentTarget && handleCloseMergeModal()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="merge-modal-title"
      >
        <div className={styles.mergeModal}>
          <div className={styles.mergeModalHeader}>
            <h2 id="merge-modal-title" className={styles.mergeModalTitle}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M8 7h12m0 0l-4-4m4 4l-4 4M4 17h12m0 0l-4-4m4 4l-4 4"></path>
              </svg>
              {t('speakers.mergeModalTitle')}
            </h2>
            <button className={styles.mergeModalClose} onClick={handleCloseMergeModal} disabled={mergeInProgress}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>

          <div className={styles.mergeModalBody}>
            <p className={styles.mergeModalDesc}>{t('speakers.mergeModalDesc')}</p>

            {/* Selector origen */}
            <div className={styles.mergeField}>
              <label className={styles.mergeFieldLabel}>{t('speakers.mergeSourceLabel')}</label>
              <SpeakerDropdown
                speakers={mergeSpeakers}
                selectedSpeaker={mergeSourceSpeaker}
                onSelect={(speaker) => { setMergeSourceId(speaker.id); clearMergeModalError(); }}
                placeholder={t('speakers.mergeSourcePlaceholder')}
                disabledIds={mergeTargetId ? [mergeTargetId] : []}
                disabledLabel={t('speakers.mergeTargetLabel')}
              />
            </div>

            {/* Flecha visual entre origen y destino */}
            <div className={styles.mergeArrowRow}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <polyline points="19 12 12 19 5 12"></polyline>
              </svg>
            </div>

            {/* Selector destino */}
            <div className={styles.mergeField}>
              <label className={styles.mergeFieldLabel}>{t('speakers.mergeTargetLabel')}</label>
              <SpeakerDropdown
                speakers={mergeSpeakers}
                selectedSpeaker={mergeTargetSpeaker}
                onSelect={(speaker) => { setMergeTargetId(speaker.id); clearMergeModalError(); }}
                placeholder={t('speakers.mergeTargetPlaceholder')}
                disabledIds={mergeSourceId ? [mergeSourceId] : []}
                disabledLabel={t('speakers.mergeSourceLabel')}
              />
            </div>

            {/* Vista previa de la fusión */}
            {canMerge && (
              <div className={styles.mergePreview}>
                <span className={styles.mergePreviewSource}>
                  {previewSourceSpeaker?.displayName || t('speakers.unknown')}
                </span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                  <polyline points="12 5 19 12 12 19"></polyline>
                </svg>
                <span className={styles.mergePreviewTarget}>
                  {previewTargetSpeaker?.displayName || t('speakers.unknown')}
                </span>
              </div>
            )}

            {preview?.swapped && (
              <div className={styles.mergeModalError}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="8" x2="12" y2="12"></line>
                  <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                {t('speakers.mergePreviewAutoSwap', 'La dirección del merge se ajustó automáticamente para preservar embeddings.')}
              </div>
            )}

            {Array.isArray(preview?.warnings) && preview.warnings.length > 0 && (
              <div className={styles.mergeModalError}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="8" x2="12" y2="12"></line>
                  <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                {preview.warnings.join(' ')}
              </div>
            )}

            {/* Error de validación */}
            {mergeModalError && (
              <div className={styles.mergeModalError}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="8" x2="12" y2="12"></line>
                  <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                {mergeModalError}
              </div>
            )}
          </div>

          <div className={styles.mergeModalFooter}>
            <button
              className={styles.mergeModalCancelBtn}
              onClick={handleCloseMergeModal}
              disabled={mergeInProgress}
            >
              {t('common.cancel')}
            </button>
            <button
              className={styles.mergeModalConfirmBtn}
              onClick={handleMerge}
              disabled={!canMerge || mergeInProgress}
            >
              {mergeInProgress ? t('common.loading', 'Procesando...') : t('speakers.mergeBtn')}
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
};

export default SpeakersPage;
