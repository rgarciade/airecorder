import React from 'react';
import styles from './Header.module.css';

export default function Header({ onSettingsClick }) {
  return (
    <header className={styles.header}>
      <div className={styles.logo}>Meeting Recorder</div>
      <div className={styles.actions}>
        <button className={styles.settingsBtn} onClick={onSettingsClick}>
          <span role="img" aria-label="settings">⚙️</span>
        </button>
        <div className={styles.avatar}>
          <img src="https://randomuser.me/api/portraits/women/44.jpg" alt="avatar" />
        </div>
      </div>
    </header>
  );
} 