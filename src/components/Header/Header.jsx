import React from 'react';
import styles from './Header.module.css';
import { Settings } from 'lucide-react';

export default function Header({ onSettingsClick }) {
  return (
    <header className={styles.header}>
      <div className={styles.logo}>Meeting Recorder</div>
      <div className={styles.actions}>
        <button className={styles.settingsBtn} onClick={onSettingsClick}>
          <Settings size={22} />
        </button>
        <div className={styles.avatar}>
          <img src="https://randomuser.me/api/portraits/women/44.jpg" alt="avatar" />
        </div>
      </div>
    </header>
  );
} 