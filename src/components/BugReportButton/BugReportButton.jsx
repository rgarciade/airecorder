import React from 'react';
import { MdBugReport } from 'react-icons/md';
import { useTranslation } from 'react-i18next';
import styles from './BugReportButton.module.css';

const BugReportButton = () => {
  const { t } = useTranslation();
  const GITHUB_ISSUES_URL = 'https://github.com/rgarciade/airecorder/issues';

  const handleClick = () => {
    if (window.electronAPI?.openDownloadUrl) {
      window.electronAPI.openDownloadUrl(GITHUB_ISSUES_URL);
    } else {
      window.open(GITHUB_ISSUES_URL, '_blank');
    }
  };

  return (
    <button 
      className={styles.bugButton} 
      onClick={handleClick}
      title={t('common.reportBug') || 'Reportar un error'}
    >
      <div className={styles.iconWrapper}>
        <MdBugReport size={20} />
      </div>
      <span className={styles.label}>{t('common.reportBug') || 'Reportar error'}</span>
    </button>
  );
};

export default BugReportButton;
