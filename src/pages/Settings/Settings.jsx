import React, { useEffect } from 'react';
import {
  MdMic, MdClose, MdSmartToy, MdSettings, MdPsychology, MdDescription
} from 'react-icons/md';
import { useTranslation } from 'react-i18next';
import styles from './Settings.module.css';
import IntegrationsTab from './components/IntegrationsTab/IntegrationsTab';
import ExpertsTab from './components/ExpertsTab/ExpertsTab';
import AgentsTab from './components/AgentsTab/AgentsTab';
import GeneralTab from './components/GeneralTab/GeneralTab';
import TemplatesSettings from '../../components/settings/TemplatesSettings';
import { SettingsProvider, useSettings } from './SettingsContext';

const VALID_TABS = ['agents', 'general', 'experts', 'templates'];
const DEFAULT_TAB = 'agents';

function SettingsContent({ onBack, safeInitialTab, targetElement }) {
  const { t } = useTranslation();
  const {
    activeTab, setActiveTab,
    saveMessage,
    isSaving,
    isCheckingModel,
    handleSaveSettings,
    hasScrolledRef,
  } = useSettings();

  useEffect(() => {
    if (activeTab === 'general' && safeInitialTab === 'general' && !hasScrolledRef.current) {
      if (targetElement) {
        return;
      }
      setTimeout(() => {
        const micElement = document.getElementById('microphone-settings');
        if (micElement) {
          micElement.scrollIntoView({ behavior: 'smooth' });
          hasScrolledRef.current = true;
        }
      }, 100);
    }
  }, [activeTab, safeInitialTab, targetElement, hasScrolledRef]);

  useEffect(() => {
    if (!targetElement || activeTab !== safeInitialTab) return;

    let cancelled = false;
    const startedAt = Date.now();
    const MAX_WAIT_MS = 3000;
    const POLL_INTERVAL_MS = 80;

    const performScroll = (el) => {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    const tryScroll = () => {
      if (cancelled) return;
      const el = document.getElementById(targetElement);
      if (el) {
        performScroll(el);
        return;
      }
      if (Date.now() - startedAt < MAX_WAIT_MS) {
        setTimeout(tryScroll, POLL_INTERVAL_MS);
      }
    };

    tryScroll();
    return () => { cancelled = true; };
  }, [targetElement, activeTab, safeInitialTab]);

  return (
    <div className={styles.container}>
      {/* Top Header */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.headerIcon}>
            <MdMic size={20} />
          </div>
          <h1 className={styles.headerTitle}>{t('settings.title')}</h1>
        </div>
        <button onClick={onBack} className={styles.closeButton}>
          <MdClose size={20} />
        </button>
      </header>

      <div className={styles.content}>
        <div className={styles.maxWidthContainer}>

          <div className={styles.pageHeader}>
            <div>
              <h2 className={styles.pageTitle}>{t('settings.subtitle')}</h2>
              <p className={styles.pageDescription}>{t('settings.description')}</p>
            </div>
            <a
              href="#"
              onClick={(e) => { e.preventDefault(); window.electronAPI?.openDownloadUrl?.('https://ko-fi.com/airecorderraulgarciadelafuente'); }}
              style={{lineHeight: 0, opacity: 0.85, transition: 'opacity 0.15s', flexShrink: 0}}
              onMouseEnter={e => e.currentTarget.style.opacity = 1}
              onMouseLeave={e => e.currentTarget.style.opacity = 0.85}
              title="Support AIRecorder on Ko-fi"
            >
              <img height="30" style={{border: 0, height: '30px', display: 'block'}} src="https://storage.ko-fi.com/cdn/kofi2.png?v=3" alt="Ko-fi" />
            </a>
          </div>

          <div className={styles.tabsContainer}>
            <button
              className={`${styles.tab} ${activeTab === 'agents' ? styles.tabActive : ''}`}
              onClick={() => setActiveTab('agents')}
            >
              <MdSmartToy className={styles.tabIcon} />
              {t('settings.tabs.agents')}
            </button>
            <button
              className={`${styles.tab} ${activeTab === 'general' ? styles.tabActive : ''}`}
              onClick={() => setActiveTab('general')}
            >
              <MdSettings className={styles.tabIcon} />
              {t('settings.tabs.general')}
            </button>
            <button
              className={`${styles.tab} ${activeTab === 'experts' ? styles.tabActive : ''}`}
              onClick={() => setActiveTab('experts')}
            >
              <MdPsychology className={styles.tabIcon} />
              {t('settings.tabs.experts')}
            </button>
            <button
              className={`${styles.tab} ${activeTab === 'templates' ? styles.tabActive : ''}`}
              onClick={() => setActiveTab('templates')}
            >
              <MdDescription className={styles.tabIcon} />
              Plantillas
            </button>
            {/*
            <button
              className={`${styles.tab} ${activeTab === 'integrations' ? styles.tabActive : ''}`}
              onClick={() => setActiveTab('integrations')}
            >
              <MdLink className={styles.tabIcon} />
              {t('settings.tabs.integrations')}
            </button>
            */}
          </div>

          {activeTab === 'integrations' ? (
            <IntegrationsTab />
          ) : activeTab === 'experts' ? (
            <ExpertsTab />
          ) : activeTab === 'agents' ? (
            <AgentsTab />
          ) : activeTab === 'templates' ? (
            <TemplatesSettings />
          ) : (
            <GeneralTab />
          )}

        </div>
      </div>

      {/* Sticky Footer */}
      <footer className={styles.footer}>
        <div className={styles.footerContent}>
          {saveMessage && (
            <div className={styles.saveMessage}>
              {saveMessage}
            </div>
          )}
          <button
            className={styles.btnPrimary}
            onClick={handleSaveSettings}
            disabled={isSaving || isCheckingModel}
          >
            {isCheckingModel ? t('settings.messages.verifyingModel') : (isSaving ? t('settings.buttons.saving') : t('settings.buttons.save'))}
          </button>
        </div>
      </footer>
    </div>
  );
}

export default function Settings({ onBack, onSettingsSaved, initialTab = DEFAULT_TAB, targetElement = null }) {
  const safeInitialTab = VALID_TABS.includes(initialTab) ? initialTab : DEFAULT_TAB;

  return (
    <SettingsProvider onSettingsSaved={onSettingsSaved} initialActiveTab={safeInitialTab}>
      <SettingsContent
        onBack={onBack}
        safeInitialTab={safeInitialTab}
        targetElement={targetElement}
      />
    </SettingsProvider>
  );
}