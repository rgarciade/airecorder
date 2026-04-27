import React from 'react';
import { MdWork } from 'react-icons/md';
import styles from '../../Settings.module.css';
import { useSettings } from '../../SettingsContext';

export default function ProjectsSection() {
  const {
    t,
    projectHighlightsCount, setProjectHighlightsCount,
  } = useSettings();

  return (
    <section className={styles.section} id="projects-settings">
      <div className={styles.sectionHeader}>
        <div className={styles.sectionTitleGroup}>
          <MdWork className={styles.sectionIcon} size={20} />
          <h3 className={styles.sectionTitle}>{t('settings.sections.projects')}</h3>
        </div>
      </div>
      <div className={styles.card}>
        <div className={styles.formGroup} style={{ marginBottom: 0 }}>
          <label className={styles.label}>{t('settings.fields.recentMeetings')}</label>
          <input
            type="number"
            className={styles.input}
            min="1"
            max="10"
            value={projectHighlightsCount}
            onChange={(e) => setProjectHighlightsCount(Math.max(1, Math.min(10, parseInt(e.target.value) || 2)))}
            style={{ width: '80px' }}
          />
          <p className={styles.helpText}>{t('settings.helpText.recentMeetings')}</p>
        </div>
      </div>
    </section>
  );
}
