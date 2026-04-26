import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import speakersService from '../../services/speakersService';
import styles from './SpeakersPage.module.css';

/**
 * Página principal del directorio de hablantes.
 * Muestra la lista de hablantes ordenada por nº de grabaciones DESC.
 * Incluye buscador client-side y estados vacíos.
 */
const SpeakersPage = ({ onNavigateToSpeaker, onNavigateToSettings, diarizationEnabled }) => {
  const { t } = useTranslation();
  const [speakers, setSpeakers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

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

  const filteredSpeakers = speakers
    .filter((speaker) => (speaker.recordingsCount || 0) > 0 && (speaker.embeddingsCount || 0) > 0)
    .filter((speaker) =>
      (speaker.display_name || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

  if (loading) {
    return (
      <div className={styles.container}>
        <h1 className={styles.title}>{t('speakers.title')}</h1>
        <div className={styles.loading}>{t('common.loading', 'Cargando...')}</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>{t('speakers.title')}</h1>
        <div className={styles.searchWrapper}>
          <input
            type="text"
            className={styles.searchInput}
            placeholder={t('speakers.searchPlaceholder')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

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
        <div className={styles.list}>
          {filteredSpeakers.map((speaker) => (
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
      )}
    </div>
  );
};

export default SpeakersPage;
