import React from 'react';
import styles from './StatsRow.module.css';

export default function StatsRow({ totalTime, totalFiles, savedTime }) {
  return (
    <div className={styles.row}>
      <div className={styles.card}>
        <div className={`${styles.icon} ${styles.orange}`}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
        </div>
        <div className={styles.info}>
          <span className={styles.label}>This Week</span>
          <span className={styles.value}>{savedTime}</span>
        </div>
      </div>

      <div className={styles.card}>
        <div className={`${styles.icon} ${styles.purple}`}>
           <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
        </div>
        <div className={styles.info}>
          <span className={styles.label}>Transcriptions</span>
          <span className={styles.value}>{totalFiles} Files</span>
        </div>
      </div>

      <div className={styles.card}>
        <div className={`${styles.icon} ${styles.green}`}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        </div>
        <div className={styles.info}>
          <span className={styles.label}>Total Recorded</span>
          <span className={styles.value}>{totalTime}</span>
        </div>
      </div>
    </div>
  );
}
