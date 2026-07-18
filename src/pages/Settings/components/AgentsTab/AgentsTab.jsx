import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MdChat, MdLayers } from 'react-icons/md';
import styles from '../../Settings.module.css';
import LocalProvidersSection from './LocalProvidersSection';
import CloudProvidersSection from './CloudProvidersSection';
import CustomConnectionsSection from './CustomConnectionsSection';

export default function AgentsTab() {
  const { t } = useTranslation();
  const [activeRoleTab, setActiveRoleTab] = useState('chat');

  return (
    <>
      <div className={styles.tabsContainer}>
        <button
          type="button"
          className={`${styles.tab} ${activeRoleTab === 'chat' ? styles.tabActive : ''}`}
          onClick={() => setActiveRoleTab('chat')}
        >
          <MdChat className={styles.tabIcon} size={18} />
          {t('settings.agentsTabs.chat')}
        </button>
        <button
          type="button"
          className={`${styles.tab} ${activeRoleTab === 'embeddings' ? styles.tabActive : ''}`}
          onClick={() => setActiveRoleTab('embeddings')}
        >
          <MdLayers className={styles.tabIcon} size={18} />
          {t('settings.agentsTabs.embeddings')}
        </button>
      </div>
      <LocalProvidersSection role={activeRoleTab} />
      <CloudProvidersSection role={activeRoleTab} />
      <CustomConnectionsSection role={activeRoleTab} />
    </>
  );
}
