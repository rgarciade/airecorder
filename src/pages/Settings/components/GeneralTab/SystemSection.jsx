import React from 'react';
import { MdNotifications, MdTerminal } from 'react-icons/md';
import styles from '../../Settings.module.css';
import { useSettings } from '../../SettingsContext';

export default function SystemSection() {
  const {
    t,
    notificationsEnabled, setNotificationsEnabled,
  } = useSettings();

  return (
    <section className={styles.section}>
      <div className={styles.sectionHeader}>
        <div className={styles.sectionTitleGroup}>
          <MdNotifications className={styles.sectionIcon} size={20} />
          <h3 className={styles.sectionTitle}>{t('settings.sections.system')}</h3>
        </div>
      </div>
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <div className={styles.providerInfo}>
            <div className={`${styles.providerIcon}`} style={{backgroundColor: '#e0f2fe', color: '#0ea5e9'}}>
              <MdNotifications size={24} />
            </div>
            <div>
              <h4 className={styles.providerName}>{t('settings.misc.notifications.title')}</h4>
              <p className={styles.providerDesc}>{t('settings.misc.notifications.desc')}</p>
            </div>
          </div>
          <label className={styles.toggleWrapper}>
            <input
              type="checkbox"
              className={styles.toggleInput}
              checked={notificationsEnabled}
              onChange={(e) => setNotificationsEnabled(e.target.checked)}
            />
            <div className={styles.toggleSlider}></div>
          </label>
        </div>
      </div>

      {/* Developer Tools */}
      <div className={styles.card} style={{marginTop: '16px'}}>
        <div className={styles.cardHeader}>
          <div className={styles.providerInfo}>
            <div className={`${styles.providerIcon}`} style={{backgroundColor: '#fef3c7', color: '#d97706'}}>
              <MdTerminal size={24} />
            </div>
            <div>
              <h4 className={styles.providerName}>{t('settings.misc.devTools.title')}</h4>
              <p className={styles.providerDesc}>{t('settings.misc.devTools.desc')}</p>
            </div>
          </div>
          <button
            className={styles.checkBtn}
            onClick={() => window.electronAPI?.toggleDevTools?.()}
          >
            <MdTerminal size={18} />
            {t('settings.buttons.openDevTools')}
          </button>
        </div>
      </div>
    </section>
  );
}
