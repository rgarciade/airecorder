import React from 'react';
import styles from './CreateProjectCard.module.css';

export default function CreateProjectCard({ onClick }) {
  return (
    <div className={styles.card} onClick={onClick}>
      <div className={styles.iconWrapper}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 5V19M5 12H19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
      <h3 className={styles.title}>Create New Project</h3>
      <p className={styles.subtitle}>Start a new collection</p>
    </div>
  );
}
