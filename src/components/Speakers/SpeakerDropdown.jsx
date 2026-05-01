import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './SpeakerDropdown.module.css';

/**
 * Dropdown reutilizable para seleccionar hablantes.
 * Usado en modales de Fusionar y Vincular hablantes.
 */
const SpeakerDropdown = ({
  speakers = [],
  selectedSpeaker = null,
  onSelect,
  placeholder = 'Seleccionar hablante...',
  label,
  disabledIds = [],
  disabledLabel = '',
  className = '',
}) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('');
  const wrapperRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filtered = speakers.filter((s) => {
    if (disabledIds.includes(s.id)) return false;
    return (s.displayName || '').toLowerCase().includes(filter.toLowerCase());
  });

  const getSpeakerTypeLabel = (speaker) => {
    const hasEmbeddings = (speaker?.embeddingsCount || 0) > 0;
    return hasEmbeddings
      ? t('speakers.typeWithAudio', 'Con audio')
      : t('speakers.typeTextOnly', 'Solo texto');
  };

  const handleSelect = (s) => {
    if (disabledIds.includes(s.id)) return;
    onSelect(s);
    setFilter('');
    setOpen(false);
  };

  return (
    <div className={`${styles.wrapper} ${className}`} ref={wrapperRef}>
      {label && <label className={styles.label}>{label}</label>}
      <button
        className={`${styles.trigger} ${selectedSpeaker ? styles.selected : ''}`}
        onClick={() => setOpen(!open)}
        type="button"
      >
        {selectedSpeaker ? (
          <span className={styles.selectedContent}>
            <span className={styles.avatar}>
              {(selectedSpeaker.displayName || '?').charAt(0).toUpperCase()}
            </span>
            <span className={styles.name}>
              {selectedSpeaker.displayName || t('speakers.unknown', 'Desconocido')}
            </span>
            <span className={`${styles.typeBadge} ${(selectedSpeaker.embeddingsCount || 0) > 0 ? styles.typeAudio : styles.typeText}`}>
              {getSpeakerTypeLabel(selectedSpeaker)}
            </span>
          </span>
        ) : (
          <span className={styles.placeholder}>{placeholder}</span>
        )}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </button>

      {open && (
        <div className={styles.panel}>
          <input
            className={styles.search}
            type="text"
            placeholder={t('common.search', 'Buscar...')}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            autoFocus
          />
          <ul className={styles.list} onClick={(e) => e.stopPropagation()}>
            {filtered.length === 0 ? (
              <li className={styles.empty}>{t('speakers.noResults')}</li>
            ) : (
              filtered.map((s) => {
                const isDisabled = disabledIds.includes(s.id);
                return (
                  <li
                    key={s.id}
                    className={`${styles.option} ${isDisabled ? styles.disabled : ''}`}
                    onClick={() => handleSelect(s)}
                  >
                    <span className={styles.optionAvatar}>
                      {(s.displayName || '?').charAt(0).toUpperCase()}
                    </span>
                    <span className={styles.optionInfo}>
                      <span className={styles.optionName}>{s.displayName || t('speakers.unknown')}</span>
                      <span className={styles.optionMeta}>
                        {s.recordingsCount || 0} {t('speakers.recordings')} · {(s.embeddingsCount || 0)} {t('speakers.embeddings')} · {getSpeakerTypeLabel(s)}
                      </span>
                    </span>
                    {isDisabled && disabledLabel && (
                      <span className={styles.optionTag}>{disabledLabel}</span>
                    )}
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
};

export default SpeakerDropdown;
