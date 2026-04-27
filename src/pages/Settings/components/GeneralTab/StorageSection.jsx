import React from 'react';
import { MdFolder } from 'react-icons/md';
import styles from '../../Settings.module.css';
import { useSettings } from '../../SettingsContext';

export default function StorageSection() {
  const {
    t,
    outputDirectory,
    outputDirectorySize,
    databasePath,
    handleChangeDirectory,
    handleChangeDatabasePath,
    dbMigrateModal, setDbMigrateModal,
    dbChangeError, setDbChangeError,
    handleConfirmDbChange,
  } = useSettings();

  return (
    <section className={styles.section}>
      <div className={styles.sectionHeader}>
        <div className={styles.sectionTitleGroup}>
          <MdFolder className={styles.sectionIcon} size={20} />
          <h3 className={styles.sectionTitle}>{t('settings.sections.storage')}</h3>
        </div>
      </div>
      <div className={styles.card}>
        <label className={styles.label}>{t('settings.fields.outputDirectory')}</label>
        <div className={styles.inputRow}>
          <div className={`${styles.input} truncate bg-gray-50 dark:bg-surface-tertiary text-gray-500 dark:text-content-secondary`} title={outputDirectory}>
            {outputDirectory || t('settings.misc.default')}
          </div>
          <button
            className={styles.checkBtn}
            onClick={handleChangeDirectory}
          >
            {t('settings.buttons.change')}
          </button>
        </div>
        {outputDirectorySize != null && (
          <p className={styles.helpText} style={{ marginTop: '6px' }}>
            {`${(outputDirectorySize ?? 0).toFixed(3)} GB ${t('settings.buttons.inUse')}`}
          </p>
        )}

        <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--color-border-subtle)' }}>
          <label className={styles.label}>{t('settings.fields.databasePath')}</label>
          <div className={styles.inputRow}>
            <div className={`${styles.input} truncate bg-gray-50 dark:bg-surface-tertiary text-gray-500 dark:text-content-secondary`} title={databasePath}>
              {databasePath || t('settings.misc.default')}
            </div>
            <button
              className={styles.checkBtn}
              onClick={handleChangeDatabasePath}
            >
              {t('settings.buttons.change')}
            </button>
          </div>
          <p className={styles.helpText}>{t('settings.helpText.databasePath')}</p>
        </div>
      </div>

      {/* Modal de migración de base de datos */}
      {dbMigrateModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div style={{
            background: 'var(--color-bg-secondary)', borderRadius: '16px', padding: '32px',
            maxWidth: '480px', width: '90%', boxShadow: '0 20px 60px var(--color-shadow-lg)'
          }}>
            <h4 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-text-heading)', marginBottom: '8px' }}>
              {t('settings.misc.changeDbTitle')}
            </h4>
            <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', marginBottom: '4px' }}>
              {t('settings.misc.changeDbNewPath')}
            </p>
            <code style={{
              display: 'block', background: 'var(--color-bg-tertiary)', border: '1px solid var(--color-border-primary)',
              borderRadius: '8px', padding: '8px 12px', fontSize: '0.8rem', color: 'var(--color-text-secondary)',
              wordBreak: 'break-all', marginBottom: '16px'
            }}>
              {dbMigrateModal.newPath}
            </code>
            <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', marginBottom: '16px' }}>
              {t('settings.misc.changeDbAskMigrate')}
            </p>
            {dbChangeError && (
              <p className={styles.errorText} style={{ marginBottom: '12px' }}>{dbChangeError}</p>
            )}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button className={styles.btnPrimary} onClick={() => handleConfirmDbChange(true)}>
                {t('settings.misc.migrateDb')}
              </button>
              <button className={styles.checkBtn} onClick={() => handleConfirmDbChange(false)}>
                {t('settings.misc.onlyChangePath')}
              </button>
              <button className={styles.btnSecondary} onClick={() => { setDbMigrateModal(null); setDbChangeError(''); }}>
                {t('settings.buttons.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
