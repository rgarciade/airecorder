import React from 'react';
import styles from './NewSessionCard.module.css';

export default function NewSessionCard({ onStart, microphoneLabel, languageLabel, onOpenSettings }) {
  return (
    <div className={styles.card}>
      <div className={styles.content}>
        <div className={styles.tag}>
          <div className={styles.dot}></div>
          <span>AI POWERED</span>
        </div>
        <h2 className={styles.title}>New Session</h2>
        <p className={styles.description}>
          Start recording instantly. Our AI will handle transcription,
          summarization, and key point extraction automatically.
        </p>
        
        <div className={styles.controls}>
          <button className={styles.controlBtn} onClick={onOpenSettings} title="Change Microphone">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
            {microphoneLabel || 'Default Mic'}
          </button>
          <button className={styles.controlBtn} onClick={onOpenSettings} title="Change Language">
             <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
            {languageLabel || 'English (US)'}
          </button>
        </div>
      </div>

      <div className={styles.action}>
        <button className={styles.startButton} onClick={onStart}>
          <div className={styles.micIcon}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
              <line x1="12" y1="19" x2="12" y2="23"/>
              <line x1="8" y1="23" x2="16" y2="23"/>
            </svg>
          </div>
          <span className={styles.startText}>START</span>
        </button>
      </div>
    </div>
  );
}
