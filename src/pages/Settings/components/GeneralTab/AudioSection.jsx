import React from 'react';
import { MdMic } from 'react-icons/md';
import styles from '../../Settings.module.css';
import { useSettings } from '../../SettingsContext';

export default function AudioSection() {
  const {
    t,
    selectedMicrophone, setSelectedMicrophone,
    microphones,
  } = useSettings();

  return (
    <section className={styles.section} id="microphone-settings">
      <div className={styles.sectionHeader}>
        <div className={styles.sectionTitleGroup}>
          <MdMic className={styles.sectionIcon} size={20} />
          <h3 className={styles.sectionTitle}>{t('settings.sections.audio')}</h3>
        </div>
      </div>
      <div className={styles.card}>
        <div className={styles.formGroup} style={{ marginBottom: 0 }}>
          <label className={styles.label}>{t('settings.fields.microphone')}</label>
          <select
            className={styles.input}
            value={selectedMicrophone}
            onChange={(e) => setSelectedMicrophone(e.target.value)}
          >
            {microphones.map(mic => (
              <option key={mic.value} value={mic.value}>{mic.label}</option>
            ))}
          </select>
          <p className={styles.helpText}>
            {t('settings.helpText.microphone')}
          </p>
        </div>
      </div>
    </section>
  );
}
