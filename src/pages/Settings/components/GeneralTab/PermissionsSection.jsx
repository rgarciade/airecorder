import React from 'react';
import { MdSecurity, MdMic } from 'react-icons/md';
import styles from '../../Settings.module.css';
import { useSettings } from '../../SettingsContext';

export default function PermissionsSection() {
  const {
    t,
    micStatus,
    handleRequestMicPermission,
  } = useSettings();

  return (
    <section className={styles.section}>
      <div className={styles.sectionHeader}>
        <div className={styles.sectionTitleGroup}>
          <MdSecurity className={styles.sectionIcon} size={20} />
          <h3 className={styles.sectionTitle}>{t('settings.sections.permissions')}</h3>
        </div>
      </div>
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <div className={styles.providerInfo}>
            <div className={`${styles.providerIcon}`} style={{backgroundColor: '#fce7f3', color: '#d97706'}}>
              <MdMic size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h4 className={styles.providerName} style={{margin: 0}}>{t('settings.misc.micAccess.title')}</h4>
                {micStatus === 'granted' && (
                  <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-2 py-0.5 rounded-full">{t('settings.misc.micAccess.granted')}</span>
                )}
                {micStatus === 'denied' && (
                  <span className="bg-red-100 text-red-800 text-xs font-bold px-2 py-0.5 rounded-full">{t('settings.misc.micAccess.denied')}</span>
                )}
              </div>
              <p className={styles.providerDesc}>{t('settings.misc.micAccess.desc')}</p>
            </div>
          </div>
          {micStatus !== 'granted' && (
            <button
              className={styles.checkBtn}
              onClick={handleRequestMicPermission}
              style={{
                backgroundColor: micStatus === 'denied' ? '#f1f5f9' : '#10b981',
                color: micStatus === 'denied' ? '#475569' : '#ffffff',
                border: micStatus === 'denied' ? '1px solid #cbd5e1' : 'none'
              }}
            >
              {micStatus === 'denied' ? t('settings.misc.micAccess.openSettings') : t('settings.buttons.grantPermission')}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
