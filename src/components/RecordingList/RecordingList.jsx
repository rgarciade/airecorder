import React from 'react';
import styles from './RecordingList.module.css';

export default function RecordingList({ recordings = [], onDownload, onSelect }) {
  return (
    <div className={styles.list}>
      <h2 className={styles.title}>Past Recordings</h2>
      <ul>
        {recordings.map((rec) => (
          <li key={rec.id} className={styles.item}>
            <div className={styles.icon}><span role="img" aria-label="recording">🎬</span></div>
            <div className={styles.info} onClick={() => onSelect(rec)}>
              <div className={styles.name}>{rec.name}</div>
              <div className={styles.date}>{rec.date}</div>
            </div>
            <button className={styles.download} onClick={() => onDownload(rec)}>
              <span role="img" aria-label="download">⬇️</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
} 