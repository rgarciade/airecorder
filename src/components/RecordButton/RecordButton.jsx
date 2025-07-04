import React from 'react';
import styles from './RecordButton.module.css';

export default function RecordButton({ recording, onClick }) {
  return (
    <button className={styles.recordBtn + (recording ? ' ' + styles.active : '')} onClick={onClick}>
      <span className={styles.icon} role="img" aria-label="mic">🎤</span>
      {recording ? 'Stop Recording' : 'Start Recording'}
    </button>
  );
} 