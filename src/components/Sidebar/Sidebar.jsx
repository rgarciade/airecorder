import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './Sidebar.module.css';
import {
  MdAutoAwesome, MdMenuBook
} from 'react-icons/md';
import { aiQueueService } from '../../services/ai/aiQueueService';
import BugReportButton from '../BugReportButton/BugReportButton';

const WIKI_URL = import.meta.env.VITE_WIKI_URL || 'https://rgarciade.github.io/airecorder/vp/';

const Sidebar = ({ currentView, onViewChange, queueCount = 0, diarizationEnabled = false }) => {
  const { t } = useTranslation();
  const [aiQueueCount, setAiQueueCount] = useState(0);

  useEffect(() => {
    const unsubscribe = aiQueueService.subscribe((state) => {
      const total = (state.current ? 1 : 0) + state.queue.length;
      setAiQueueCount(total);
    });
    return unsubscribe;
  }, []);

  const menuItems = [
    { id: 'home', label: t('sidebar.home'), icon: <HomeIcon /> },
    { id: 'projects', label: t('sidebar.projects'), icon: <FolderIcon /> },
    {
      id: 'queue',
      label: <span className={styles.multilineLabel}>{t('sidebar.transcriptionQueue').split('\n').map((line, i) => <React.Fragment key={i}>{i > 0 && <br />}{line}</React.Fragment>)}</span>,
      icon: <QueueIcon />,
      badge: queueCount > 0 ? queueCount : null
    },
    {
      id: 'ai-queue',
      label: <span className={styles.multilineLabel}>{t('sidebar.aiQueue').split('\n').map((line, i) => <React.Fragment key={i}>{i > 0 && <br />}{line}</React.Fragment>)}</span>,
      icon: <MdAutoAwesome />,
      badge: aiQueueCount > 0 ? aiQueueCount : null,
    },
    { id: 'speakers', label: t('sidebar.speakers'), icon: <SpeakersIcon /> },
    { id: 'settings', label: t('sidebar.settings'), icon: <SettingsIcon /> },
  ];

  const handleMenuItemClick = (item) => {
    onViewChange(item.id);
  };

  return (
    <aside className={styles.sidebar}>
      <div className={styles.logo}>
        AIRecorder
      </div>
      <nav className={styles.nav}>
        {menuItems.map((item) => (
          <button
            key={item.id}
            className={`${styles.navItem} ${currentView === item.id ? styles.active : ''}`}
            onClick={() => handleMenuItemClick(item)}
          >
            <div className={styles.iconWrapper}>
              <span className={styles.icon}>{item.icon}</span>
              {item.badge && <span className={styles.badge}>{item.badge}</span>}
            </div>
            <span className={styles.label}>{item.label}</span>
          </button>
        ))}
        <button
          className={styles.navItem}
          onClick={() => {
            if (window.electronAPI && window.electronAPI.openExternal) {
              window.electronAPI.openExternal(WIKI_URL);
            }
          }}
          title={t('sidebar.wiki')}
        >
          <div className={styles.iconWrapper}>
            <span className={styles.icon}><MdMenuBook /></span>
          </div>
          <span className={styles.label}>{t('sidebar.wiki')}</span>
        </button>
        <BugReportButton />
      </nav>
    </aside>
  );
};

// Icons (Simple SVGs)
const HomeIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
    <polyline points="9 22 9 12 15 12 15 22"></polyline>
  </svg>
);

const FolderIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
  </svg>
);

const QueueIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"></path>
  </svg>
);

const AiQueueIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"></path>
  </svg>
);

const SettingsIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3"></circle>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
  </svg>
);

const SpeakersIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
    <circle cx="9" cy="7" r="4"></circle>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
    <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
  </svg>
);

export default Sidebar;
