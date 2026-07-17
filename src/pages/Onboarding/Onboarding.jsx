import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n/index.js';
import styles from './Onboarding.module.css';
import { FaMicrophone, FaCheckCircle, FaExclamationTriangle, FaRobot, FaServer, FaArrowRight, FaArrowLeft, FaWaveSquare, FaBrain, FaFolder, FaMagic, FaVolumeUp, FaBell, FaCheck } from 'react-icons/fa';
import { getAvailableModels, checkOllamaAvailability } from '../../services/ai/ollamaProvider';
import { checkLMStudioAvailability, getLMStudioModels } from '../../services/ai/lmStudioProvider';
import { getGeminiAvailableModels } from '../../services/ai/geminiProvider';
import { getKimiAvailableModels, getDeepseekAvailableModels } from '../../services/ai/providerRouter';
import { CustomOpenAIProvider, OPENAI_BASE_URL } from '../../services/ai/customOpenAIProvider';
import { updateSettings } from '../../services/settingsService';
import { applyTheme } from '../../services/themeService';
import PermissionsStep from './PermissionsStep';
import ReadyStep from './ReadyStep';
import AiConfigStep from './AiConfigStep';
import PreferencesStep from './PreferencesStep';
import LocalAiInfoStep from './LocalAiInfoStep';

const STEPS = [
  { id: 'welcome' },
  { id: 'aiInfo' },
  { id: 'ai' },
  { id: 'permissions' },
  { id: 'preferences' },
  { id: 'finish' },
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

  // AI Settings State — el rol activo determina qué selección (chat/embeddings) se está editando
  const [activeAiRole, setActiveAiRole] = useState('chat'); // 'chat' | 'embeddings'

  const [chatProviderType, setChatProviderType] = useState('local'); // 'local' | 'cloud'
  const [chatProviderKey, setChatProviderKey] = useState('ollama');
  const [embedProviderType, setEmbedProviderType] = useState('local');
  const [embedProviderKey, setEmbedProviderKey] = useState('ollama');

  const providerType = activeAiRole === 'chat' ? chatProviderType : embedProviderType;
  const setProviderType = activeAiRole === 'chat' ? setChatProviderType : setEmbedProviderType;
  const aiProvider = activeAiRole === 'chat' ? chatProviderKey : embedProviderKey;
  const setAiProvider = activeAiRole === 'chat' ? setChatProviderKey : setEmbedProviderKey;

  // Ollama
  const [ollamaHost, setOllamaHost] = useState('http://localhost:11434');
  const [ollamaStatus, setOllamaStatus] = useState('idle');
  const [ollamaModels, setOllamaModels] = useState([]);
  const [selectedOllamaModel, setSelectedOllamaModel] = useState('');
  const [selectedOllamaChatModel, setSelectedOllamaChatModel] = useState(''); // Modelo de Chat (opcional)
  const [ollamaEmbeddingModel, setOllamaEmbeddingModel] = useState('nomic-embed-text');

  // LM Studio
  const [lmStudioHost, setLmStudioHost] = useState('http://localhost:1234/v1');
  const [lmStudioStatus, setLmStudioStatus] = useState('idle');
  const [lmStudioModels, setLmStudioModels] = useState([]);
  const [selectedLmStudioModel, setSelectedLmStudioModel] = useState('');
  const [selectedLmStudioChatModel, setSelectedLmStudioChatModel] = useState('');
  const [lmStudioEmbeddingModel, setLmStudioEmbeddingModel] = useState('nomic-embed-text');

  // OpenAI
  const [openaiApiKey, setOpenaiApiKey] = useState('');
  const [openaiModels, setOpenaiModels] = useState([]);
  const [openaiModelsLoading, setOpenaiModelsLoading] = useState(false);
  const [selectedOpenaiModel, setSelectedOpenaiModel] = useState('');

  // Gemini
  const [geminiKey, setGeminiKey] = useState('');
  const [geminiModels, setGeminiModels] = useState([]);
  const [geminiModelsLoading, setGeminiModelsLoading] = useState(false);
  const [selectedGeminiModel, setSelectedGeminiModel] = useState('');

  // Kimi (lista estática, sin fetch)
  const [kimiApiKey, setKimiApiKey] = useState('');
  const [selectedKimiModel, setSelectedKimiModel] = useState(getKimiAvailableModels()[0]?.name || '');

  // DeepSeek (lista estática, sin fetch — no soporta embeddings)
  const [deepseekApiKey, setDeepseekApiKey] = useState('');
  const [selectedDeepseekModel, setSelectedDeepseekModel] = useState(getDeepseekAvailableModels()[0]?.name || '');

  // Conexión OpenAI personalizada
  const [customConnName, setCustomConnName] = useState('');
  const [customConnBaseUrl, setCustomConnBaseUrl] = useState('');
  const [customConnApiKey, setCustomConnApiKey] = useState('');
  const [customConnModels, setCustomConnModels] = useState([]);
  const [customConnTestStatus, setCustomConnTestStatus] = useState('idle'); // idle | testing | success | error
  const [selectedCustomChatModel, setSelectedCustomChatModel] = useState('');
  const [selectedCustomEmbedModel, setSelectedCustomEmbedModel] = useState('');

  const [isSaving, setIsSaving] = useState(false);
  const [selectedTheme, setSelectedTheme] = useState('system');
  const [appVersion, setAppVersion] = useState('');

  useEffect(() => {
    checkPermissions();
    window.electronAPI?.getAppVersion?.().then(r => {
      if (r?.success) setAppVersion(r.version);
    });
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

  const checkLmStudio = async () => {
    setLmStudioStatus('checking');
    try {
      const isAvailable = await checkLMStudioAvailability(lmStudioHost);
      if (isAvailable) {
        const models = await getLMStudioModels(lmStudioHost);
        setLmStudioModels(models);

        const chatModels = models.filter(m => !m.name.toLowerCase().includes('embed'));
        const embedModels = models.filter(m => m.name.toLowerCase().includes('embed'));

        if (chatModels.length > 0 && !selectedLmStudioModel) {
          setSelectedLmStudioModel(chatModels[0].name);
        }
        if (embedModels.length > 0) {
          setLmStudioEmbeddingModel(embedModels[0].name);
        }
        setLmStudioStatus('success');
      } else {
        setLmStudioStatus('error');
      }
    } catch (error) {
      console.error(error);
      setLmStudioStatus('error');
    }
  };

  const loadGeminiModelsOnboarding = async (apiKey) => {
    if (!apiKey) {
      setGeminiModels([]);
      return;
    }
    setGeminiModelsLoading(true);
    try {
      const models = await getGeminiAvailableModels(apiKey);
      setGeminiModels(models);
      if (models.length > 0 && !selectedGeminiModel) {
        setSelectedGeminiModel(models[0].name);
      }
    } catch (error) {
      console.error('Error cargando modelos de Gemini:', error);
      setGeminiModels([]);
    } finally {
      setGeminiModelsLoading(false);
    }
  };

  const loadOpenaiModelsOnboarding = async (apiKey) => {
    if (!apiKey) {
      setOpenaiModels([]);
      return;
    }
    setOpenaiModelsLoading(true);
    try {
      const client = new CustomOpenAIProvider({ baseUrl: OPENAI_BASE_URL, apiKey });
      const models = await client.listModels();
      setOpenaiModels(models);
      if (models.length > 0 && !selectedOpenaiModel) {
        setSelectedOpenaiModel(models[0].name);
      }
    } catch (error) {
      console.error('Error cargando modelos de OpenAI:', error);
      setOpenaiModels([]);
    } finally {
      setOpenaiModelsLoading(false);
    }
  };

  const testCustomConnection = async () => {
    if (!customConnBaseUrl.trim()) return;
    setCustomConnTestStatus('testing');
    try {
      const client = new CustomOpenAIProvider({ baseUrl: customConnBaseUrl.trim(), apiKey: customConnApiKey.trim() });
      const models = await client.listModels();
      setCustomConnModels(models);
      if (models.length > 0) {
        if (!selectedCustomChatModel) setSelectedCustomChatModel(models[0].name);
        if (!selectedCustomEmbedModel) setSelectedCustomEmbedModel(models[0].name);
      }
      setCustomConnTestStatus('success');
    } catch (error) {
      console.error('Error probando la conexión personalizada:', error);
      setCustomConnModels([]);
      setCustomConnTestStatus('error');
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
      const isChatCustom = chatProviderKey === 'custom';
      const isEmbedCustom = embedProviderKey === 'custom';
      const hasCustomConnection = isChatCustom || isEmbedCustom;
      const customConnectionId = hasCustomConnection ? crypto.randomUUID() : undefined;
      const resolveProvider = (key) => key === 'custom' ? `custom:${customConnectionId}` : key;

      const usesOllama = chatProviderKey === 'ollama' || embedProviderKey === 'ollama';
      const usesLmStudio = chatProviderKey === 'lmstudio' || embedProviderKey === 'lmstudio';

      const settingsToSave = {
        isFirstRun: false,
        aiProvider: resolveProvider(chatProviderKey),
        embeddingProvider: resolveProvider(embedProviderKey),
        ollamaHost,
        ollamaModel: usesOllama ? selectedOllamaModel : undefined,
        ollamaRagModel: chatProviderKey === 'ollama' ? (selectedOllamaChatModel || undefined) : undefined,
        ollamaEmbeddingModel: embedProviderKey === 'ollama' ? ollamaEmbeddingModel : undefined,
        lmStudioHost: usesLmStudio ? lmStudioHost : undefined,
        lmStudioModel: usesLmStudio ? selectedLmStudioModel : undefined,
        lmStudioRagModel: chatProviderKey === 'lmstudio' ? (selectedLmStudioChatModel || undefined) : undefined,
        lmStudioEmbeddingModel: embedProviderKey === 'lmstudio' ? lmStudioEmbeddingModel : undefined,
        openaiApiKey: (chatProviderKey === 'openai' || embedProviderKey === 'openai') ? openaiApiKey : undefined,
        openaiModel: chatProviderKey === 'openai' ? selectedOpenaiModel : undefined,
        geminiApiKey: (chatProviderKey === 'gemini' || embedProviderKey === 'gemini') ? geminiKey : undefined,
        geminiModel: chatProviderKey === 'gemini' ? selectedGeminiModel : undefined,
        kimiApiKey: (chatProviderKey === 'kimi' || embedProviderKey === 'kimi') ? kimiApiKey : undefined,
        kimiModel: chatProviderKey === 'kimi' ? selectedKimiModel : undefined,
        deepseekApiKey: chatProviderKey === 'deepseek' ? deepseekApiKey : undefined,
        deepseekModel: chatProviderKey === 'deepseek' ? selectedDeepseekModel : undefined,
        customConnections: hasCustomConnection
          ? [{ id: customConnectionId, name: customConnName.trim(), baseUrl: customConnBaseUrl.trim(), apiKey: customConnApiKey.trim() }]
          : undefined,
        customChatModel: isChatCustom ? selectedCustomChatModel : undefined,
        embeddingModel: isEmbedCustom ? selectedCustomEmbedModel : undefined,
        notificationsEnabled: notificationStatus === 'granted',
        theme: selectedTheme,
        uiLanguage: i18n.language?.split('-')[0] || 'es',
        outputDirectory: outputDirectory || undefined,
        databasePath: databaseDirectory ? `${databaseDirectory}/recordings.db` : undefined
      };

      await updateSettings(settingsToSave);

      if (databaseDirectory && window.electronAPI?.changeDbPath) {
        const newDbPath = `${databaseDirectory}/recordings.db`;
        await window.electronAPI.changeDbPath(newDbPath, false);
      }

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
          AI POWERED {appVersion ? `V${appVersion}` : ''}
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
            t('onboarding.steps.preferences'),
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
          border: '1px solid var(--color-border-primary)',
          borderRadius: '8px',
          padding: '6px 12px',
          background: 'var(--color-bg-secondary)',
          color: 'var(--color-text-primary)',
          cursor: 'pointer',
          boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
          outline: 'none',
        }}
      >
        <option value="es">🇪🇸 Español</option>
        <option value="en">🇬🇧 English</option>
      </select>
    </div>
  );

  const getModelName = () => {
    if (chatProviderKey === 'lmstudio') return 'LM Studio';
    if (chatProviderKey === 'openai') return 'OpenAI';
    if (chatProviderKey === 'gemini') return 'Gemini';
    if (chatProviderKey === 'kimi') return 'Kimi';
    if (chatProviderKey === 'deepseek') return 'DeepSeek';
    if (chatProviderKey === 'custom') return customConnName || 'Custom';
    return selectedOllamaModel;
  };

  const isProviderRoleValid = (type, key) => {
    if (type === 'local') {
      if (key === 'ollama') return ollamaStatus === 'success';
      if (key === 'lmstudio') return lmStudioStatus === 'success';
    }
    if (type === 'cloud') {
      if (key === 'openai') return !!openaiApiKey.trim();
      if (key === 'gemini') return !!geminiKey.trim();
      if (key === 'kimi') return !!kimiApiKey.trim();
      if (key === 'deepseek') return !!deepseekApiKey.trim();
      if (key === 'custom') return !!(customConnName.trim() && customConnBaseUrl.trim());
    }
    return false;
  };

  const aiCanProceed =
    isProviderRoleValid(chatProviderType, chatProviderKey) &&
    isProviderRoleValid(embedProviderType, embedProviderKey);

  const aiConfigCtx = {
    ollama: {
      host: ollamaHost, setHost: setOllamaHost,
      status: ollamaStatus, checkConnection: checkOllama,
      models: ollamaModels,
      selectedModel: selectedOllamaModel, setSelectedModel: setSelectedOllamaModel,
      selectedChatModel: selectedOllamaChatModel, setSelectedChatModel: setSelectedOllamaChatModel,
      embeddingModel: ollamaEmbeddingModel, setEmbeddingModel: setOllamaEmbeddingModel,
    },
    lmStudio: {
      host: lmStudioHost, setHost: setLmStudioHost,
      status: lmStudioStatus, checkConnection: checkLmStudio,
      models: lmStudioModels,
      selectedModel: selectedLmStudioModel, setSelectedModel: setSelectedLmStudioModel,
      selectedChatModel: selectedLmStudioChatModel, setSelectedChatModel: setSelectedLmStudioChatModel,
      embeddingModel: lmStudioEmbeddingModel, setEmbeddingModel: setLmStudioEmbeddingModel,
    },
    openai: {
      apiKey: openaiApiKey, setApiKey: setOpenaiApiKey,
      models: openaiModels, modelsLoading: openaiModelsLoading, loadModels: loadOpenaiModelsOnboarding,
      selectedModel: selectedOpenaiModel, setSelectedModel: setSelectedOpenaiModel,
    },
    gemini: {
      apiKey: geminiKey, setApiKey: setGeminiKey,
      models: geminiModels, modelsLoading: geminiModelsLoading, loadModels: loadGeminiModelsOnboarding,
      selectedModel: selectedGeminiModel, setSelectedModel: setSelectedGeminiModel,
    },
    kimi: {
      apiKey: kimiApiKey, setApiKey: setKimiApiKey,
      models: getKimiAvailableModels(),
      selectedModel: selectedKimiModel, setSelectedModel: setSelectedKimiModel,
    },
    deepseek: {
      apiKey: deepseekApiKey, setApiKey: setDeepseekApiKey,
      models: getDeepseekAvailableModels(),
      selectedModel: selectedDeepseekModel, setSelectedModel: setSelectedDeepseekModel,
    },
    custom: {
      name: customConnName, setName: setCustomConnName,
      baseUrl: customConnBaseUrl, setBaseUrl: setCustomConnBaseUrl,
      apiKey: customConnApiKey, setApiKey: setCustomConnApiKey,
      testStatus: customConnTestStatus, testConnection: testCustomConnection,
      models: customConnModels,
      chatModel: selectedCustomChatModel, setChatModel: setSelectedCustomChatModel,
      embedModel: selectedCustomEmbedModel, setEmbedModel: setSelectedCustomEmbedModel,
    },
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
        activeAiRole={activeAiRole}
        setActiveAiRole={setActiveAiRole}
        providerType={providerType}
        setProviderType={setProviderType}
        aiProvider={aiProvider}
        setAiProvider={setAiProvider}
        ctx={aiConfigCtx}
        canProceed={aiCanProceed}
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
      <PreferencesStep
        t={t}
        outputDirectory={outputDirectory}
        setOutputDirectory={setOutputDirectory}
        databaseDirectory={databaseDirectory}
        setDatabaseDirectory={setDatabaseDirectory}
        selectedTheme={selectedTheme}
        onThemeChange={(th) => { setSelectedTheme(th); applyTheme(th); }}
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
