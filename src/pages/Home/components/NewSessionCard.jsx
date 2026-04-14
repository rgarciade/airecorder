import React from 'react';
import { useTranslation } from 'react-i18next';
import styles from './NewSessionCard.module.css';

export default function NewSessionCard({ onStart, microphoneLabel, languageLabel, onOpenSettings, onImport, onImportAudio, onImportConversation }) {
  const { t } = useTranslation();

  return (
    <div className={styles.card}>
      <div className={styles.content}>
        <div className={styles.tag}>
          <div className={styles.dot}></div>
          <span>{t('newSessionCard.aiPowered')}</span>
        </div>
        <h2 className={styles.title}>{t('newSessionCard.title')}</h2>
        <p className={styles.description}>
          {t('newSessionCard.description')}
        </p>

        <div className={styles.controls}>
          <button className={styles.controlBtn} onClick={onOpenSettings} title={t('newSessionCard.changeMic')}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
            {microphoneLabel || t('home.defaultMic')}
          </button>
          <button className={styles.controlBtn} onClick={onOpenSettings} title={t('newSessionCard.changeLanguage')}>
             <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
            {languageLabel || 'English (US)'}
          </button>
        </div>
        <div className={styles.importRow}>
          <button className={styles.importButton} onClick={onImport} data-tooltip={t('newSessionCard.importTeamsDescription')}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
              <path d="M15.5 5.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z"/>
              <path d="M20 7h-9a1 1 0 0 0-1 1v7.5a3.5 3.5 0 0 0 7 0V9h3a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1z"/>
              <path d="M9 8H3a1 1 0 0 0-1 1v5a4 4 0 0 0 8 0V9a1 1 0 0 0-1-1z"/>
              <circle cx="6" cy="4.5" r="2.5"/>
            </svg>
            {t('newSessionCard.teams')}
          </button>
          <button className={`${styles.importButton} ${styles.importButtonWide}`} onClick={onImportAudio} data-tooltip={t('newSessionCard.importAudioDescription')}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/>
              <line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            {t('newSessionCard.audio')}
          </button>
          <button className={styles.importButton} onClick={onImportConversation} data-tooltip={t('newSessionCard.importConversationDescription')}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
              <polyline points="10 9 9 9 8 9"/>
            </svg>
            {t('newSessionCard.importConversation')}
          </button>
        </div>
      </div>

      <div className={styles.action}>
        <button className={styles.startButton} onClick={onStart}>
          <div className={styles.micIcon}>
            <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
              <line x1="12" y1="19" x2="12" y2="23"/>
              <line x1="8" y1="23" x2="16" y2="23"/>
            </svg>
          </div>
          <span className={styles.startText}>{t('newSessionCard.start')}</span>
        </button>
      </div>
    </div>
  );
}
