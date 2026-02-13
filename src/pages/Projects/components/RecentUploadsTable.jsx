import React from 'react';
import styles from './RecentUploadsTable.module.css';

export default function RecentUploadsTable({ recordings = [] }) {
  return (
    <div className={styles.container}>
      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead className={styles.header}>
            <tr>
              <th className={styles.headerCell}>Name</th>
              <th className={styles.headerCell}>Duration</th>
              <th className={styles.headerCell}>Status</th>
              <th className={styles.headerCell}>Date</th>
              <th className={styles.headerCell}></th>
            </tr>
          </thead>
          <tbody>
            {recordings.map((rec) => {
              const durationStr = rec.duration 
                ? `${Math.floor(rec.duration/60).toString().padStart(2,'0')}:${Math.floor(rec.duration%60).toString().padStart(2,'0')}`
                : '--:--';
              
              const isTranscribed = rec.hasTranscription || false;

              return (
                <tr key={rec.id} className={styles.row}>
                  <td className={styles.cell}>
                    <div className={styles.cellName}>
                      <div className={styles.iconWrapper}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M9 18V5l12-2v13" strokeLinecap="round" strokeLinejoin="round"/>
                          <circle cx="6" cy="18" r="3" strokeLinecap="round" strokeLinejoin="round"/>
                          <circle cx="18" cy="16" r="3" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </div>
                      <span>{rec.name}</span>
                    </div>
                  </td>
                  <td className={styles.cell}>
                    <span className={styles.durationText}>{durationStr}</span>
                  </td>
                  <td className={styles.cell}>
                    {isTranscribed ? (
                      <span className={`${styles.badge} ${styles.badgeTranscribed}`}>
                        <span className={`${styles.dot} ${styles.dotTranscribed}`}></span>
                        Transcribed
                      </span>
                    ) : (
                      <span className={`${styles.badge} ${styles.badgeProcessing}`}>
                        <span className={`${styles.dot} ${styles.dotProcessing}`}></span>
                        Processing
                      </span>
                    )}
                  </td>
                  <td className={styles.cell}>
                    <span className={styles.dateText}>{new Date(rec.date).toLocaleDateString()}</span>
                  </td>
                  <td className={styles.cell}>
                    <button className={styles.actionBtn}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="1" />
                        <circle cx="19" cy="12" r="1" />
                        <circle cx="5" cy="12" r="1" />
                      </svg>
                    </button>
                  </td>
                </tr>
              );
            })}
            {recordings.length === 0 && (
              <tr>
                <td colSpan="5" className={styles.cell} style={{textAlign: 'center', padding: '32px'}}>
                  No recent uploads found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
