import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n/index.js';
import styles from './Onboarding.module.css';
import { FaMicrophone, FaCheckCircle, FaExclamationTriangle, FaRobot, FaServer, FaArrowRight, FaArrowLeft, FaWaveSquare, FaBrain, FaFolder, FaMagic, FaVolumeUp, FaBell, FaCheck } from 'react-icons/fa';
import { getAvailableModels, checkOllamaAvailability } from '../../services/ai/ollamaProvider';
import { updateSettings } from '../../services/settingsService';
import PermissionsStep from './PermissionsStep';
import ReadyStep from './ReadyStep';
import AiConfigStep from './AiConfigStep';
import StorageStep from './StorageStep';
import LocalAiInfoStep from './LocalAiInfoStep';

const STEPS = [
  { id: 'welcome',     title: 'Welcome to AIRecorder' },
  { id: 'aiInfo',      title: 'IA Local' },
  { id: 'ai',          title: 'Configuración de IA' },
  { id: 'permissions', title: 'Permisos del Sistema' },
  { id: 'storage',     title: 'Almacenamiento' },
  { id: 'finish',      title: 'Todo listo' }
];

export default function Onboarding({ onComplete }) {
  const { t } = useTranslation();
  const [currentStep, setCurrentStep] = useState(0);
  const [micStatus, setMicStatus] = useState('unknown');
  const [systemAudioStatus, setSystemAudioStatus] = useState('granted');
  const [notificationStatus, setNotificationStatus] = useState('unknown');

  // Storage State
  const [outputDirectory, setOutputDirectory] = useState('');
  const [databaseDirectory, setDatabaseDirectory] = useState('');

  // AI Settings State
  const [providerType, setProviderType] = useState('local'); // 'local' | 'cloud'
  const [aiProvider, setAiProvider] = useState('ollama');
  const [geminiKey, setGeminiKey] = useState('');
  const [kimiApiKey, setKimiApiKey] = useState('');
  const [deepseekApiKey, setDeepseekApiKey] = useState('');
  const [ollamaHost, setOllamaHost] = useState('http://localhost:11434');
  const [ollamaModels, setOllamaModels] = useState([]);
  const [selectedOllamaModel, setSelectedOllamaModel] = useState('');
  const [selectedOllamaChatModel, setSelectedOllamaChatModel] = useState(''); // Modelo de Chat (opcional)
  const [ollamaEmbeddingModel, setOllamaEmbeddingModel] = useState('nomic-embed-text');
  const [lmStudioEmbeddingModel, setLmStudioEmbeddingModel] = useState('nomic-embed-text');
  const [ollamaStatus, setOllamaStatus] = useState('idle');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    checkPermissions();
  }, []);

  const checkPermissions = async () => {
    if (window.electronAPI?.getMicrophonePermission) {
      const status = await window.electronAPI.getMicrophonePermission();
      setMicStatus(status);
    } else {
      setMicStatus('granted');
    }

    if ("Notification" in window) {
      if (Notification.permission === 'granted') {
        setNotificationStatus('granted');
      } else if (Notification.permission === 'denied') {
        setNotificationStatus('denied');
      } else {
        setNotificationStatus('unknown');
      }
    }
  };

  const requestPermission = async () => {
    if (micStatus === 'denied') {
      if (window.electronAPI?.openMicrophonePreferences) {
        await window.electronAPI.openMicrophonePreferences();
      }
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
      setMicStatus('granted');
    } catch (error) {
      console.error("Microphone permission denied:", error);
      setMicStatus('denied');
    }
  };

  const requestSystemAudio = async () => {
    setSystemAudioStatus('granted');
  };

  const toggleNotifications = async () => {
    if (notificationStatus === 'granted') {
      setNotificationStatus('denied');
    } else {
      const permission = await Notification.requestPermission();
      setNotificationStatus(permission === 'granted' ? 'granted' : 'denied');
    }
  };

  const checkOllama = async () => {
    setOllamaStatus('checking');
    try {
      const isAvailable = await checkOllamaAvailability(ollamaHost);
      if (isAvailable) {
        const models = await getAvailableModels(ollamaHost);
        const allModelNames = models.map(m => m.name || m);
        setOllamaModels(allModelNames);

        const chatModels = allModelNames.filter(m => !m.toLowerCase().includes('embed'));
        const embedModels = allModelNames.filter(m => m.toLowerCase().includes('embed'));

        if (chatModels.length > 0 && !selectedOllamaModel) {
          setSelectedOllamaModel(chatModels[0]);
        }
        if (embedModels.length > 0) {
          setOllamaEmbeddingModel(embedModels[0]);
        }
        setOllamaStatus('success');
      } else {
        setOllamaStatus('error');
      }
    } catch (error) {
      console.error(error);
      setOllamaStatus('error');
    }
  };

  const handleNext = async () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(curr => curr + 1);
    } else {
      await saveAndClose();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(curr => curr - 1);
    }
  };

  const saveAndClose = async () => {
    setIsSaving(true);
    try {
      const settingsToSave = {
        isFirstRun: false,
        aiProvider,
        ollamaHost,
        lmStudioHost: aiProvider === 'lmstudio' ? 'http://localhost:1234/v1' : undefined,
        ollamaModel: selectedOllamaModel,
        ollamaRagModel: selectedOllamaChatModel || undefined,
        ollamaEmbeddingModel: aiProvider === 'ollama' ? ollamaEmbeddingModel : undefined,
        lmStudioEmbeddingModel: aiProvider === 'lmstudio' ? lmStudioEmbeddingModel : undefined,
        geminiApiKey: aiProvider === 'gemini' ? geminiKey : undefined,
        kimiApiKey: aiProvider === 'kimi' ? kimiApiKey : undefined,
        deepseekApiKey: aiProvider === 'deepseek' ? deepseekApiKey : undefined,
        notificationsEnabled: notificationStatus === 'granted',
        uiLanguage: i18n.language?.split('-')[0] || 'es',
        outputDirectory: outputDirectory || undefined,
        databasePath: databaseDirectory ? `${databaseDirectory}/recordings.db` : undefined
      };

      await updateSettings(settingsToSave);

      if (import.meta.env.VITE_SENTRY_DSN) {
        if (window.electronAPI?.sentryLogInfo) {
          window.electronAPI.sentryLogInfo('Usuario ha completado el Onboarding (Primera vez)');
        }
      }

      if (onComplete) onComplete();
    } catch (error) {
      console.error("Error saving settings:", error);
      setIsSaving(false);
    }
  };

  // --- RENDER FUNCTIONS ---

  const renderWelcomeSplit = () => (
    <div className={styles.splitLayout}>
      {/* Left Panel: Graphics */}
      <div className={styles.leftPanel}>
        <div className={styles.graphicContainer}>
          <div className={`${styles.circle} ${styles.outerCircle2}`}></div>
          <div className={`${styles.circle} ${styles.outerCircle1}`}></div>
          <div className={`${styles.circle} ${styles.mainCircle}`}>
            <FaMicrophone className={styles.mainIcon} />
          </div>
          <div className={`${styles.floatingBadge} ${styles.badgeTop}`}><FaWaveSquare size={16} /></div>
          <div className={`${styles.floatingBadge} ${styles.badgeRight}`}>
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#f87171', border: '2px solid white' }}></div>
          </div>
          <div className={`${styles.floatingBadge} ${styles.badgeBottom}`}><FaMagic size={16} /></div>
        </div>
        <div className={styles.aiPill}>
          <div className={styles.dot}></div>
          AI POWERED V1.0
        </div>
        <div className={styles.brandContainer}>
          <h2 className={styles.brandName}>AIRecorder</h2>
          <p className={styles.brandSubtitle}>Smart Audio Management</p>
        </div>
      </div>

      {/* Right Panel: Content */}
      <div className={styles.rightPanel}>
        <div className={styles.topNav}>
          <div className={styles.progressBar}>
            <div className={`${styles.progressDot} ${styles.active}`}></div>
            <div className={styles.progressDot}></div>
            <div className={styles.progressDot}></div>
          </div>
        </div>

        <div className={styles.contentArea}>
          <h1 className={styles.mainTitle}>
            {t('onboarding.welcome.title')}{' '}<span className={styles.highlight}>AIRecorder</span>
          </h1>
          <p className={styles.description}>{t('onboarding.welcome.description')}</p>

          <div className={styles.sectionLabel}>{t('onboarding.welcome.whatToExpect')}</div>

          <div className={styles.expectList}>
            <div className={styles.expectItem}>
              <div className={styles.iconCircle}><FaMicrophone /></div>
              <div className={styles.itemContent}>
                <h3>{t('onboarding.welcome.mic.title')}</h3>
                <p>{t('onboarding.welcome.mic.desc')}</p>
              </div>
            </div>
            <div className={styles.expectItem}>
              <div className={styles.iconCircle}><FaBrain /></div>
              <div className={styles.itemContent}>
                <h3>{t('onboarding.welcome.ai.title')}</h3>
                <p>{t('onboarding.welcome.ai.desc')}</p>
              </div>
            </div>
            <div className={styles.expectItem}>
              <div className={styles.iconCircle}><FaFolder /></div>
              <div className={styles.itemContent}>
                <h3>{t('onboarding.welcome.workspace.title')}</h3>
                <p>{t('onboarding.welcome.workspace.desc')}</p>
              </div>
            </div>
          </div>
        </div>

        <div className={styles.footerArea}>
          <p className={styles.termsText}>
            {t('onboarding.welcome.terms')}{' '}
            <a href="#" className={styles.link}>{t('onboarding.welcome.termsLink')}</a>{' '}
            {t('onboarding.welcome.and')}{' '}
            <a href="#" className={styles.link}>{t('onboarding.welcome.privacyLink')}</a>.
          </p>
          <button className={styles.setupButton} onClick={handleNext}>
            {t('onboarding.welcome.beginBtn')}
            <FaArrowRight />
          </button>
        </div>
      </div>
    </div>
  );

  const renderStepProgress = () => (
    <div className={styles.stepProgressContainer}>
      <div className={styles.stepProgressGrid}>
        {STEPS.map((step, index) => {
          const isActive = index === currentStep;
          const isCompleted = index < currentStep;
          const labels = [
            t('onboarding.steps.welcome'),
            t('onboarding.steps.aiInfo'),
            t('onboarding.steps.ai'),
            t('onboarding.steps.permissions'),
            t('onboarding.steps.storage'),
            t('onboarding.steps.finish')
          ];
          return (
            <div key={step.id} className={styles.stepColumn}>
              <div className={`${styles.stepBar} ${isCompleted ? styles.completed : ''} ${isActive ? styles.active : ''}`}></div>
              <div className={`${styles.stepLabel} ${isActive || isCompleted ? styles.active : ''}`}>
                {labels[index]}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  // Selector de idioma — overlay fijo, visible en todos los pasos
  const renderLangSelector = () => (
    <div style={{ position: 'fixed', top: 16, right: 20, zIndex: 999 }}>
      <select
        value={i18n.language?.split('-')[0] || 'es'}
        onChange={(e) => i18n.changeLanguage(e.target.value)}
        style={{
          fontSize: '0.85rem',
          border: '1px solid #e2e8f0',
          borderRadius: '8px',
          padding: '6px 12px',
          background: 'white',
          color: '#374151',
          cursor: 'pointer',
          boxShadow: '0 1px 3px rgba(0,0,0,0.08)'
        }}
      >
        <option value="es">🇪🇸 Español</option>
        <option value="en">🇬🇧 English</option>
      </select>
    </div>
  );

  const getModelName = () => {
    if (aiProvider === 'lmstudio') return 'LM Studio';
    if (aiProvider === 'gemini') return 'Gemini';
    if (aiProvider === 'kimi') return 'Kimi';
    if (aiProvider === 'deepseek') return 'DeepSeek';
    return selectedOllamaModel;
  };

  // Main Render Switch
  if (currentStep === 0) return (
    <>{renderLangSelector()}{renderWelcomeSplit()}</>
  );

  if (currentStep === 1) return (
    <>
      {renderLangSelector()}
      <LocalAiInfoStep 
        t={t} 
        onBack={handleBack} 
        onNext={handleNext} 
        StepProgressComponent={renderStepProgress()} 
      />
    </>
  );

  if (currentStep === 2) return (
    <>
      {renderLangSelector()}
      <AiConfigStep
        t={t}
        providerType={providerType}
        setProviderType={setProviderType}
        aiProvider={aiProvider}
        setAiProvider={setAiProvider}
        ollamaHost={ollamaHost}
        setOllamaHost={setOllamaHost}
        checkOllama={checkOllama}
        ollamaStatus={ollamaStatus}
        ollamaModels={ollamaModels}
        selectedOllamaModel={selectedOllamaModel}
        setSelectedOllamaModel={setSelectedOllamaModel}
        selectedOllamaChatModel={selectedOllamaChatModel}
        setSelectedOllamaChatModel={setSelectedOllamaChatModel}
        ollamaEmbeddingModel={ollamaEmbeddingModel}
        setOllamaEmbeddingModel={setOllamaEmbeddingModel}
        lmStudioEmbeddingModel={lmStudioEmbeddingModel}
        setLmStudioEmbeddingModel={setLmStudioEmbeddingModel}
        geminiKey={geminiKey}
        setGeminiKey={setGeminiKey}
        kimiApiKey={kimiApiKey}
        setKimiApiKey={setKimiApiKey}
        deepseekApiKey={deepseekApiKey}
        setDeepseekApiKey={setDeepseekApiKey}
        onBack={handleBack}
        onNext={handleNext}
        StepProgressComponent={renderStepProgress()}
      />
    </>
  );

  if (currentStep === 3) return (
    <>
      {renderLangSelector()}
      <PermissionsStep
        t={t}
        micStatus={micStatus}
        systemAudioStatus={systemAudioStatus}
        notificationStatus={notificationStatus}
        onRequestMic={requestPermission}
        onRequestSystemAudio={requestSystemAudio}
        onToggleNotifications={toggleNotifications}
        onBack={handleBack}
        onNext={handleNext}
        StepProgressComponent={renderStepProgress()}
      />
    </>
  );

  if (currentStep === 4) return (
    <>
      {renderLangSelector()}
      <StorageStep
        t={t}
        outputDirectory={outputDirectory}
        setOutputDirectory={setOutputDirectory}
        databaseDirectory={databaseDirectory}
        setDatabaseDirectory={setDatabaseDirectory}
        onBack={handleBack}
        onNext={handleNext}
        StepProgressComponent={renderStepProgress()}
      />
    </>
  );

  if (currentStep === 5) return (
    <>
      {renderLangSelector()}
      <ReadyStep
        t={t}
        aiProvider={aiProvider}
        modelName={getModelName()}
        onComplete={saveAndClose}
        StepProgressComponent={renderStepProgress()}
      />
    </>
  );

  return <div />;
}
