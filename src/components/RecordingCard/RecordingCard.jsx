import React from 'react';
import styles from './RecordingCard.module.css';
import { MdTranscribe, MdFolderOpen, MdSchedule, MdAutorenew } from 'react-icons/md';

export default function RecordingCard({ recording, onClick, onTranscribe }) {
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
          label: `Transcribing (${q.progress}%)`, 
          icon: <MdAutorenew className="animate-spin" />, 
          color: '#3994EF' 
        };
      }
      if (q.status === 'pending') return { label: 'Queued', icon: <MdSchedule />, color: '#9CA3AF' };
    }
    
    if (recording.status === 'transcribed') return { label: 'Needs AI Analysis', icon: <MdTranscribe />, color: '#F59E0B' };
    if (recording.status === 'analyzed') return { label: 'Analyzed', icon: null, color: '#10B981' };
    
    return { label: 'Recorded', icon: null, color: '#6B7280' };
  };

  const statusInfo = getStatusDisplay();

  return (
    <div className={styles.card} onClick={() => onClick(recording)}>
      <div className={styles.header}>
        <div className={styles.icon}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
            <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
            <line x1="12" y1="19" x2="12" y2="23"/>
            <line x1="8" y1="23" x2="16" y2="23"/>
          </svg>
        </div>
        <div className={styles.headerRight}>
          {statusInfo.label === 'Recorded' && onTranscribe && (
            <button 
              className={styles.transcribeBtn} 
              onClick={(e) => { e.stopPropagation(); onTranscribe(recording.dbId || recording.id); }}
              title="Transcribe Recording"
            >
              <MdTranscribe size={20} />
            </button>
          )}
          <div className={styles.duration}>{durationStr}</div>
        </div>
      </div>
      
      <h3 className={styles.title}>{recording.name || 'Untitled Recording'}</h3>
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
            <span>PROJECT</span>
          </div>
          <p className={styles.projectName}>
            {recording.project.name}
          </p>
        </div>
      )}
    </div>
  );
}
