import React from 'react';
import styles from './RecordButton.module.css';
import { Mic } from 'lucide-react';

export default function RecordButton({ recording, onClick }) {
  return (
    <button className={styles.recordBtn + (recording ? ' ' + styles.active : '')} onClick={onClick}>
      <span className={styles.icon} role="img" aria-label="mic">
        <Mic size={22} />
      </span>
      {recording ? 'Stop Recording' : 'Start Recording'}
    </button>
  );
} 