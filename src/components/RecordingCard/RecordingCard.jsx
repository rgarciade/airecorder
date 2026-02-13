import React from 'react';
import styles from './RecordingCard.module.css';

export default function RecordingCard({ recording, onClick }) {
  // Format duration
  const durationStr = recording.duration 
    ? `${Math.floor(recording.duration/60).toString().padStart(2,'0')}:${Math.floor(recording.duration%60).toString().padStart(2,'0')}`
    : '--:--';

  const dateStr = recording.date ? new Date(recording.date).toLocaleDateString() : '';

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
        <div className={styles.duration}>{durationStr}</div>
      </div>
      
      <h3 className={styles.title}>{recording.name || 'Untitled Recording'}</h3>
      <div className={styles.meta}>
        <span className={styles.date}>{dateStr}</span>
      </div>

      {/* AI Summary Placeholder or Real Data */}
      <div className={styles.summary}>
        <div className={styles.summaryHeader}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
          </svg>
          <span>AI SUMMARY</span>
        </div>
        <p className={styles.summaryText}>
          {recording.summary || "No summary available yet. Click to analyze."}
        </p>
      </div>
    </div>
  );
}
