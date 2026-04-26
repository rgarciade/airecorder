import React from 'react';
import { MdSystemUpdate, MdRefresh } from 'react-icons/md';
import styles from '../../Settings.module.css';
import { useSettings } from '../../SettingsContext';

export default function AboutSection() {
  const {
    t,
    appVersion,
    updateInfo, setUpdateInfo,
    checkingUpdate, setCheckingUpdate,
    updateMessage, setUpdateMessage,
  } = useSettings();

  return (
    <section className={styles.section}>
      <div className={styles.sectionHeader}>
        <div className={styles.sectionTitleGroup}>
          <MdSystemUpdate className={styles.sectionIcon} size={20} />
          <h3 className={styles.sectionTitle}>{t('settings.sections.about')}</h3>
        </div>
        {appVersion && (
          <span className={styles.badge} style={{backgroundColor: '#e0e7ff', color: '#4338ca'}}>
            v{appVersion}
          </span>
        )}
      </div>
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <div className={styles.providerInfo}>
            <div className={`${styles.providerIcon}`} style={{backgroundColor: '#dbeafe', color: '#2563eb'}}>
              <MdSystemUpdate size={24} />
            </div>
            <div>
              <h4 className={styles.providerName}>{t('settings.misc.updates.title')}</h4>
              <p className={styles.providerDesc}>
                {updateInfo
                  ? t('settings.messages.updateAvailable', { version: updateInfo.latestVersion })
                  : updateMessage || t('settings.messages.checkUpdatesDefault')}
              </p>
            </div>
          </div>
          <div style={{display: 'flex', gap: '8px'}}>
            {updateInfo && (
              <button
                className={styles.checkBtn}
                style={{backgroundColor: 'var(--color-success)', color: '#fff', border: 'none'}}
                onClick={() => window.electronAPI?.openDownloadUrl?.(updateInfo.downloadUrl)}
              >
                {t('settings.buttons.download')}
              </button>
            )}
            {import.meta.env.DEV && (
              <button
                className={styles.checkBtn}
                style={{backgroundColor: 'var(--color-warning)', color: '#fff', border: 'none'}}
                onClick={() => window.electronAPI?.testUpdateDialog?.()}
              >
                {t('settings.misc.updates.testDev')}
              </button>
            )}
            <button
              className={styles.checkBtn}
              onClick={async () => {
                setCheckingUpdate(true);
                setUpdateMessage('');
                setUpdateInfo(null);
                try {
                  const result = await window.electronAPI?.checkForUpdates?.();
                  if (result?.success && result.updateAvailable) {
                    setUpdateInfo(result);
                  } else if (result?.success) {
                    setUpdateMessage(t('settings.messages.upToDate'));
                  } else {
                    setUpdateMessage(result?.error || t('settings.messages.updateError'));
                  }
                } catch {
                  setUpdateMessage(t('settings.messages.connectError'));
                } finally {
                  setCheckingUpdate(false);
                }
              }}
              disabled={checkingUpdate}
            >
              <MdRefresh size={18} className={checkingUpdate ? styles.spinner : ''} />
              {checkingUpdate ? t('settings.buttons.checking') : t('settings.buttons.checkUpdates')}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
