import React from 'react';
import {
  MdTextFormat, MdLightMode, MdDarkMode, MdBrightness6
} from 'react-icons/md';
import styles from '../../Settings.module.css';
import { useSettings, fontSizes } from '../../SettingsContext';

export default function AppearanceSection() {
  const {
    t,
    theme, handleThemeChange,
    selectedUiLanguage, handleUiLanguageChange,
    fontSize, setFontSize,
  } = useSettings();

  return (
    <section className={styles.section}>
      <div className={styles.sectionHeader}>
        <div className={styles.sectionTitleGroup}>
          <MdTextFormat className={styles.sectionIcon} size={20} />
          <h3 className={styles.sectionTitle}>{t('settings.sections.appearance')}</h3>
        </div>
      </div>
      <div className={styles.card}>
        <div className={styles.formGroup}>
          <label className={styles.label}>{t('settings.fields.theme')}</label>
          <div style={{ display: 'flex', gap: '8px' }}>
            {[
              { value: 'system', icon: <MdBrightness6 size={16} />, label: t('settings.themes.system') },
              { value: 'light',  icon: <MdLightMode size={16} />,  label: t('settings.themes.light') },
              { value: 'dark',   icon: <MdDarkMode size={16} />,   label: t('settings.themes.dark') },
            ].map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => handleThemeChange(opt.value)}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: `2px solid ${theme === opt.value ? 'var(--color-primary)' : 'var(--color-border-secondary)'}`,
                  background: theme === opt.value ? 'var(--color-primary-bg)' : 'var(--color-bg-tertiary)',
                  color: theme === opt.value ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                  fontWeight: theme === opt.value ? 600 : 400,
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {opt.icon} {opt.label}
              </button>
            ))}
          </div>
          <p className={styles.helpText}>{t('settings.helpText.theme')}</p>
        </div>
        <div className={styles.formGroup}>
          <label className={styles.label}>{t('settings.fields.uiLanguage')}</label>
          <select
            className={styles.input}
            value={selectedUiLanguage}
            onChange={(e) => handleUiLanguageChange(e.target.value)}
          >
            <option value="es">{t('settings.uiLanguages.es')}</option>
            <option value="en">{t('settings.uiLanguages.en')}</option>
          </select>
          <p className={styles.helpText}>
            {t('settings.helpText.uiLanguage')}
          </p>
        </div>
        <div className={styles.formGroup}>
          <label className={styles.label}>{t('settings.fields.fontSize')}</label>
          <select
            className={styles.input}
            value={fontSize}
            onChange={(e) => setFontSize(e.target.value)}
          >
            {fontSizes.map(size => (
              <option key={size.value} value={size.value}>{t(`settings.fontSizes.${size.value}`)}</option>
            ))}
          </select>
          <p className={styles.helpText}>
            {t('settings.helpText.fontSize')}
          </p>
        </div>
      </div>
    </section>
  );
}
