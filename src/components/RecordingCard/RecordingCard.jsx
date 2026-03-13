import React from 'react';
import { useTranslation } from 'react-i18next';
import styles from './RecordingCard.module.css';
import { MdFolderOpen, MdSchedule, MdAutorenew, MdTranscribe } from 'react-icons/md';

export default function RecordingCard({ recording, onClick, onTranscribe }) {
  const { t } = useTranslation();

  // Format duration
  const durationStr = recording.duration
    ? `${Math.floor(recording.duration/60).toString().padStart(2,'0')}:${Math.floor(recording.duration%60).toString().padStart(2,'0')}`
    : '--:--';

  const dateStr = recording.date ? new Date(recording.date).toLocaleDateString() : '';

  const getStatusDisplay = () => {
    const q = recording.queueStatus;
    if (q) {
      if (q.status === 'processing') {
        return {
          key: 'processing',
          label: t('recordingCard.transcribing', { progress: q.progress }),
          icon: <MdAutorenew className="animate-spin" />,
          color: '#3994EF'
        };
      }
      if (q.status === 'pending') return { key: 'pending', label: t('recordingCard.queued'), icon: <MdSchedule />, color: '#9CA3AF' };
    }

    if (recording.status === 'transcribed') return { key: 'transcribed', label: t('recordingCard.needsAnalysis'), icon: <MdTranscribe />, color: '#F59E0B' };
    if (recording.status === 'analyzed') return { key: 'analyzed', label: t('recordingCard.analyzed'), icon: null, color: '#10B981' };

    return { key: 'recorded', label: t('recordingCard.recorded'), icon: null, color: '#6B7280' };
  };

  const statusInfo = getStatusDisplay();

  return (
    <div className={styles.card} onClick={() => onClick(recording)}>
      <div className={styles.header}>
        {recording.transcriptionModel === 'teams-import' ? (
          // Importado desde Teams
          <div className={`${styles.icon} ${styles.iconTeams}`}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M15.5 5.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z"/>
              <path d="M20 7h-9a1 1 0 0 0-1 1v7.5a3.5 3.5 0 0 0 7 0V9h3a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1z"/>
              <path d="M9 8H3a1 1 0 0 0-1 1v5a4 4 0 0 0 8 0V9a1 1 0 0 0-1-1z"/>
              <circle cx="6" cy="4.5" r="2.5"/>
            </svg>
          </div>
        ) : recording.transcriptionModel === 'audio-import' ? (
          // Audio subido manualmente
          <div className={`${styles.icon} ${styles.iconUpload}`}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/>
              <line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
          </div>
        ) : (
          // Grabado con la app
          <div className={styles.icon}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
              <line x1="12" y1="19" x2="12" y2="23"/>
              <line x1="8" y1="23" x2="16" y2="23"/>
            </svg>
          </div>
        )}
        <div className={styles.headerRight}>
          {statusInfo.key === 'recorded' && onTranscribe && (
            <button
              className={styles.transcribeBtn}
              onClick={(e) => { e.stopPropagation(); onTranscribe(recording.dbId || recording.id); }}
              title={t('recordingCard.transcribeTitle')}
            >
              {t('recordingCard.transcribeLabel')}
            </button>
          )}
          <div className={styles.duration}>{durationStr}</div>
        </div>
      </div>

      <h3 className={styles.title}>{recording.name || t('recordingCard.untitled')}</h3>
      <div className={styles.meta}>
        <span className={styles.date}>{dateStr}</span>
        <span className={styles.statusInfo} style={{ color: statusInfo.color }}>
          {statusInfo.icon}
          {statusInfo.label}
        </span>
      </div>

      {/* Project Info */}
      {recording.project && (
        <div className={styles.projectInfo}>
          <div className={styles.projectHeader}>
            <MdFolderOpen size={12} />
            <span>{t('recordingCard.project')}</span>
          </div>
          <p className={styles.projectName}>
            {recording.project.name}
          </p>
        </div>
      )}
    </div>
  );
}
