import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import speakersService from '../../services/speakersService';
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
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Estado del modal de fusión
  const [mergeModalOpen, setMergeModalOpen] = useState(false);
  const [mergeSourceId, setMergeSourceId] = useState(null);
  const [mergeTargetId, setMergeTargetId] = useState(null);
  const [mergeSourceFilter, setMergeSourceFilter] = useState('');
  const [mergeTargetFilter, setMergeTargetFilter] = useState('');
  const [mergeSourceOpen, setMergeSourceOpen] = useState(false);
  const [mergeTargetOpen, setMergeTargetOpen] = useState(false);
  const [mergeInProgress, setMergeInProgress] = useState(false);
  const [mergeModalError, setMergeModalError] = useState(null);
  const [mergeStatus, setMergeStatus] = useState(null); // { success, message }

  const sourceDropdownRef = useRef(null);
  const targetDropdownRef = useRef(null);

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

  // Auto-ocultar banner de estado tras 4 segundos
  useEffect(() => {
    if (mergeStatus) {
      const timer = setTimeout(() => setMergeStatus(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [mergeStatus]);

  // Resetear a página 1 cuando cambia la búsqueda
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  // Cerrar dropdowns al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (sourceDropdownRef.current && !sourceDropdownRef.current.contains(e.target)) {
        setMergeSourceOpen(false);
      }
      if (targetDropdownRef.current && !targetDropdownRef.current.contains(e.target)) {
        setMergeTargetOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredSpeakers = speakers
    .filter((speaker) => (speaker.recordingsCount || 0) > 0 && (speaker.embeddingsCount || 0) > 0)
    .filter((speaker) =>
      (speaker.display_name || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

  // Paginación
  const totalPages = Math.max(1, Math.ceil(filteredSpeakers.length / itemsPerPage));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedSpeakers = filteredSpeakers.slice(
    (safePage - 1) * itemsPerPage,
    safePage * itemsPerPage
  );

  // Lista completa de hablantes elegibles para el modal de fusión
  const mergeSpeakers = speakers.filter(
    (speaker) => (speaker.recordingsCount || 0) > 0 && (speaker.embeddingsCount || 0) > 0
  );

  const mergeSourceSpeaker = mergeSpeakers.find((s) => s.id === mergeSourceId);
  const mergeTargetSpeaker = mergeSpeakers.find((s) => s.id === mergeTargetId);

  const filteredSourceSpeakers = mergeSpeakers.filter((s) =>
    (s.display_name || '').toLowerCase().includes(mergeSourceFilter.toLowerCase())
  );
  const filteredTargetSpeakers = mergeSpeakers.filter((s) =>
    (s.display_name || '').toLowerCase().includes(mergeTargetFilter.toLowerCase())
  );

  const canMerge = mergeSourceId && mergeTargetId && mergeSourceId !== mergeTargetId;

  const handleOpenMergeModal = () => {
    setMergeSourceId(null);
    setMergeTargetId(null);
    setMergeSourceFilter('');
    setMergeTargetFilter('');
    setMergeSourceOpen(false);
    setMergeTargetOpen(false);
    setMergeModalError(null);
    setMergeModalOpen(true);
  };

  const handleCloseMergeModal = () => {
    if (mergeInProgress) return;
    setMergeModalOpen(false);
    setMergeModalError(null);
  };

  const handleMerge = async () => {
    if (!mergeSourceId || !mergeTargetId) {
      setMergeModalError(t('speakers.selectBothError'));
      return;
    }
    if (mergeSourceId === mergeTargetId) {
      setMergeModalError(t('speakers.sameSpeakerError'));
      return;
    }

    setMergeInProgress(true);
    setMergeModalError(null);

    const sourceName = mergeSourceSpeaker?.display_name || mergeSourceId;
    const targetName = mergeTargetSpeaker?.display_name || mergeTargetId;

    // targetSpeakerId absorbe a sourceSpeakerId
    const result = await speakersService.mergeSimilarSpeaker(mergeTargetId, mergeSourceId);

    setMergeInProgress(false);

    if (result.success) {
      setMergeModalOpen(false);
      setMergeStatus({
        success: true,
        message: t('speakers.mergeSuccess', { source: sourceName, target: result.mergedName || targetName })
      });
      setCurrentPage(1);
      await loadSpeakers();
    } else {
      setMergeModalError(t('speakers.mergeError', { error: result.error || 'Error desconocido' }));
    }
  };

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
                {(speaker.display_name || '?').charAt(0).toUpperCase()}
              </div>
              <div className={styles.speakerInfo}>
                <span className={styles.speakerName}>
                  {speaker.display_name || t('speakers.unknown', 'Desconocido')}
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
            <div className={styles.paginationPages}>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  className={`${styles.paginationPage} ${page === safePage ? styles.paginationPageActive : ''}`}
                  onClick={() => setCurrentPage(page)}
                  aria-label={t('speakers.page', 'Página') + ' ' + page}
                >
                  {page}
                </button>
              ))}
            </div>
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
              <div className={styles.mergeDropdownWrapper} ref={sourceDropdownRef}>
                <button
                  className={`${styles.mergeDropdownTrigger} ${mergeSourceSpeaker ? styles.mergeDropdownSelected : ''}`}
                  onClick={() => { setMergeSourceOpen((v) => !v); setMergeTargetOpen(false); }}
                  type="button"
                >
                  {mergeSourceSpeaker ? (
                    <span className={styles.mergeDropdownSelectedName}>
                      <span className={styles.mergeDropdownAvatar}>
                        {(mergeSourceSpeaker.display_name || '?').charAt(0).toUpperCase()}
                      </span>
                      {mergeSourceSpeaker.display_name || t('speakers.unknown')}
                    </span>
                  ) : (
                    <span className={styles.mergeDropdownPlaceholder}>{t('speakers.mergeSourcePlaceholder')}</span>
                  )}
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="6 9 12 15 18 9"></polyline>
                  </svg>
                </button>
                {mergeSourceOpen && (
                  <div className={styles.mergeDropdownPanel}>
                    <input
                      className={styles.mergeDropdownSearch}
                      type="text"
                      placeholder={t('common.search', 'Buscar...')}
                      value={mergeSourceFilter}
                      onChange={(e) => setMergeSourceFilter(e.target.value)}
                      autoFocus
                    />
                    <ul className={styles.mergeDropdownList}>
                      {filteredSourceSpeakers.length === 0 ? (
                        <li className={styles.mergeDropdownEmpty}>{t('speakers.noResults')}</li>
                      ) : (
                        filteredSourceSpeakers.map((s) => (
                          <li
                            key={s.id}
                            className={`${styles.mergeDropdownOption} ${s.id === mergeSourceId ? styles.mergeDropdownOptionActive : ''} ${s.id === mergeTargetId ? styles.mergeDropdownOptionDisabled : ''}`}
                            onClick={() => {
                              if (s.id === mergeTargetId) return;
                              setMergeSourceId(s.id);
                              setMergeSourceFilter('');
                              setMergeSourceOpen(false);
                              setMergeModalError(null);
                            }}
                          >
                            <span className={styles.mergeDropdownOptionAvatar}>
                              {(s.display_name || '?').charAt(0).toUpperCase()}
                            </span>
                            <span className={styles.mergeDropdownOptionInfo}>
                              <span className={styles.mergeDropdownOptionName}>{s.display_name || t('speakers.unknown')}</span>
                              <span className={styles.mergeDropdownOptionMeta}>{s.recordingsCount || 0} {t('speakers.recordings')}</span>
                            </span>
                            {s.id === mergeTargetId && (
                              <span className={styles.mergeDropdownOptionTag}>{t('speakers.mergeTargetLabel')}</span>
                            )}
                          </li>
                        ))
                      )}
                    </ul>
                  </div>
                )}
              </div>
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
              <div className={styles.mergeDropdownWrapper} ref={targetDropdownRef}>
                <button
                  className={`${styles.mergeDropdownTrigger} ${mergeTargetSpeaker ? styles.mergeDropdownSelected : ''}`}
                  onClick={() => { setMergeTargetOpen((v) => !v); setMergeSourceOpen(false); }}
                  type="button"
                >
                  {mergeTargetSpeaker ? (
                    <span className={styles.mergeDropdownSelectedName}>
                      <span className={styles.mergeDropdownAvatar}>
                        {(mergeTargetSpeaker.display_name || '?').charAt(0).toUpperCase()}
                      </span>
                      {mergeTargetSpeaker.display_name || t('speakers.unknown')}
                    </span>
                  ) : (
                    <span className={styles.mergeDropdownPlaceholder}>{t('speakers.mergeTargetPlaceholder')}</span>
                  )}
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="6 9 12 15 18 9"></polyline>
                  </svg>
                </button>
                {mergeTargetOpen && (
                  <div className={styles.mergeDropdownPanel}>
                    <input
                      className={styles.mergeDropdownSearch}
                      type="text"
                      placeholder={t('common.search', 'Buscar...')}
                      value={mergeTargetFilter}
                      onChange={(e) => setMergeTargetFilter(e.target.value)}
                      autoFocus
                    />
                    <ul className={styles.mergeDropdownList}>
                      {filteredTargetSpeakers.length === 0 ? (
                        <li className={styles.mergeDropdownEmpty}>{t('speakers.noResults')}</li>
                      ) : (
                        filteredTargetSpeakers.map((s) => (
                          <li
                            key={s.id}
                            className={`${styles.mergeDropdownOption} ${s.id === mergeTargetId ? styles.mergeDropdownOptionActive : ''} ${s.id === mergeSourceId ? styles.mergeDropdownOptionDisabled : ''}`}
                            onClick={() => {
                              if (s.id === mergeSourceId) return;
                              setMergeTargetId(s.id);
                              setMergeTargetFilter('');
                              setMergeTargetOpen(false);
                              setMergeModalError(null);
                            }}
                          >
                            <span className={styles.mergeDropdownOptionAvatar}>
                              {(s.display_name || '?').charAt(0).toUpperCase()}
                            </span>
                            <span className={styles.mergeDropdownOptionInfo}>
                              <span className={styles.mergeDropdownOptionName}>{s.display_name || t('speakers.unknown')}</span>
                              <span className={styles.mergeDropdownOptionMeta}>{s.recordingsCount || 0} {t('speakers.recordings')}</span>
                            </span>
                            {s.id === mergeSourceId && (
                              <span className={styles.mergeDropdownOptionTag}>{t('speakers.mergeSourceLabel')}</span>
                            )}
                          </li>
                        ))
                      )}
                    </ul>
                  </div>
                )}
              </div>
            </div>

            {/* Vista previa de la fusión */}
            {canMerge && (
              <div className={styles.mergePreview}>
                <span className={styles.mergePreviewSource}>
                  {mergeSourceSpeaker?.display_name || t('speakers.unknown')}
                </span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                  <polyline points="12 5 19 12 12 19"></polyline>
                </svg>
                <span className={styles.mergePreviewTarget}>
                  {mergeTargetSpeaker?.display_name || t('speakers.unknown')}
                </span>
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
