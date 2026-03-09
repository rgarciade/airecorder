import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { getSystemMicrophones } from '../../services/audioService';
import { getSettings, updateSettings } from '../../services/settingsService';
import { getAvailableModels, checkOllamaAvailability, checkModelSupportsStreaming, getOllamaModelInfo } from '../../services/ai/ollamaProvider';
import { getGeminiAvailableModels } from '../../services/ai/geminiProvider';
import { getDeepseekAvailableModels, getKimiAvailableModels, getLMStudioModels } from '../../services/ai/providerRouter';
import { checkLMStudioAvailability } from '../../services/ai/lmStudioProvider';
import { 
  MdMic, MdClose, MdCloud, MdAutoAwesome, MdComputer, MdTerminal,
  MdFolder, MdVisibility, MdVisibilityOff, MdRefresh, MdInfo, MdCheck,
  MdTextFormat, MdTranslate, MdNotifications, MdSmartToy, MdSettings, MdSecurity,
  MdSystemUpdate
} from 'react-icons/md';
import styles from './Settings.module.css';
import InfoTooltip from '../../components/InfoTooltip/InfoTooltip';

const mockLanguages = [
  { value: 'es', label: 'Español' },
  { value: 'en', label: 'English' },
  { value: 'fr', label: 'Français' },
];

  const fontSizes = [
  { value: 'small', label: 'Pequeño' },
  { value: 'medium', label: 'Mediano' },
  { value: 'large', label: 'Grande' },
  { value: 'xlarge', label: 'Muy Grande' },
];

const whisperModels = [
  { value: 'tiny', label: 'Tiny (Muy Rápido)' },
  { value: 'base', label: 'Base' },
  { value: 'small', label: 'Small (Recomendado)' },
  { value: 'medium', label: 'Medium' },
  { value: 'large', label: 'Large (Preciso)' },
];

export default function Settings({ onBack, onSettingsSaved, initialTab = 'agents' }) {
  const { t } = useTranslation();

  // State
  const [selectedLanguage, setSelectedLanguage] = useState('en');
  const [selectedUiLanguage, setSelectedUiLanguage] = useState('es');
  const [selectedMicrophone, setSelectedMicrophone] = useState('');
  const [fontSize, setFontSize] = useState('medium');
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [whisperModel, setWhisperModel] = useState('small');
  const [cpuThreads, setCpuThreads] = useState(4);
  const [maxCpuThreads, setMaxCpuThreads] = useState(4);
  const [microphones, setMicrophones] = useState([]);
  const [micStatus, setMicStatus] = useState('unknown');
  const [isLoading, setIsLoading] = useState(true);
  
  // Storage
  const [outputDirectory, setOutputDirectory] = useState('');
  const [databasePath, setDatabasePath] = useState('');
  const [dbMigrateModal, setDbMigrateModal] = useState(null); // { newPath } | null
  const [dbChangeError, setDbChangeError] = useState('');

  // Gemini Free
  const [geminiFreeApiKey, setGeminiFreeApiKey] = useState('');
  const [geminiFreeModel, setGeminiFreeModel] = useState('gemini-2.0-flash');
  const [geminiFreeModels, setGeminiFreeModels] = useState([]);
  const [geminiFreeModelsLoading, setGeminiFreeModelsLoading] = useState(false);
  const [geminiFreeModelsError, setGeminiFreeModelsError] = useState('');

  // Gemini Pro
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [geminiModel, setGeminiModel] = useState('gemini-2.0-flash');
  const [geminiModels, setGeminiModels] = useState([]);
  const [geminiModelsLoading, setGeminiModelsLoading] = useState(false);
  const [geminiModelsError, setGeminiModelsError] = useState('');

  // DeepSeek
  const [deepseekApiKey, setDeepseekApiKey] = useState('');
  const [deepseekModel, setDeepseekModel] = useState('deepseek-chat');
  const [deepseekModels] = useState(getDeepseekAvailableModels());

  // Kimi
  const [kimiApiKey, setKimiApiKey] = useState('');
  const [kimiModel, setKimiModel] = useState('kimi-k2');
  const [kimiModels] = useState(getKimiAvailableModels());

  const [aiProvider, setAiProvider] = useState('geminifree'); // 'geminifree' | 'gemini' | 'deepseek' | 'kimi' | 'ollama'

  // Ollama
  const [ollamaModel, setOllamaModel] = useState('');
  const [ollamaEmbeddingModel, setOllamaEmbeddingModel] = useState('');
  const [ollamaModels, setOllamaModels] = useState([]);
  const [ollamaEmbeddingModels, setOllamaEmbeddingModels] = useState([]);
  const [ollamaAvailable, setOllamaAvailable] = useState(false);
  const [ollamaHost, setOllamaHost] = useState('http://localhost:11434');
  const [ollamaModelSupportsStreaming, setOllamaModelSupportsStreaming] = useState(false);
  const [isCheckingModel, setIsCheckingModel] = useState(false);

  // LM Studio
  const [lmStudioModel, setLmStudioModel] = useState('');
  const [lmStudioEmbeddingModel, setLmStudioEmbeddingModel] = useState('');
  const [lmStudioModels, setLmStudioModels] = useState([]);
  const [lmStudioChatModels, setLmStudioChatModels] = useState([]);
  const [lmStudioEmbeddingModels, setLmStudioEmbeddingModels] = useState([]);
  const [lmStudioHost, setLmStudioHost] = useState('http://localhost:1234/v1');
  const [lmStudioAvailable, setLmStudioAvailable] = useState(false);

  // Ollama context length (se obtiene de la API al cambiar de modelo)
  const [ollamaContextLength, setOllamaContextLength] = useState(null);

  // UI State
  const [activeTab, setActiveTab] = useState(initialTab); // 'general' | 'agents'
  const [showApiKey, setShowApiKey] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [hasLoadedSettings, setHasLoadedSettings] = useState(false);
  const hasScrolledRef = useRef(false);

  // Actualizaciones
  const [appVersion, setAppVersion] = useState('');
  const [updateInfo, setUpdateInfo] = useState(null);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updateMessage, setUpdateMessage] = useState('');

  useEffect(() => {
    loadSettings();
    window.electronAPI?.getAppVersion?.().then(r => {
      if (r?.success) setAppVersion(r.version);
    });
  }, []);

  useEffect(() => {
    // Solo hacemos el scroll automático la primera vez que entramos a 'general'
    // si el initialTab era 'general'.
    if (activeTab === 'general' && initialTab === 'general' && !hasScrolledRef.current) {
      setTimeout(() => {
        const micElement = document.getElementById('microphone-settings');
        if (micElement) {
          micElement.scrollIntoView({ behavior: 'smooth' });
          hasScrolledRef.current = true;
        }
      }, 100);
    }
  }, [activeTab, initialTab]);

  const loadSettings = async () => {
    try {
      setIsLoading(true);
      // Load microphones
      const systemMicrophones = await getSystemMicrophones();
      setMicrophones(systemMicrophones);
      
      // Load mic permission status
      if (window.electronAPI?.getMicrophonePermission) {
        const status = await window.electronAPI.getMicrophonePermission();
        setMicStatus(status);
      } else {
        setMicStatus('granted');
      }
      
      // Load settings
      const savedSettings = await getSettings();
      
      if (savedSettings) {
        setSelectedLanguage(savedSettings.language || 'en');
        setSelectedUiLanguage(savedSettings.uiLanguage || 'es');
        setSelectedMicrophone(savedSettings.microphone || (systemMicrophones.length > 0 ? systemMicrophones[0].value : ''));
        setFontSize(savedSettings.fontSize || 'medium');
        setNotificationsEnabled(savedSettings.notificationsEnabled !== false); // Default true
        setWhisperModel(savedSettings.whisperModel || 'small');
        
        try {
          const sysInfo = await window.electronAPI.getSystemInfo();
          if (sysInfo && sysInfo.cpuCores) {
            setMaxCpuThreads(sysInfo.cpuCores);
            setCpuThreads(savedSettings.cpuThreads || Math.floor(sysInfo.cpuCores / 2) || 4);
          }
        } catch (e) {
          console.warn("Could not fetch system info", e);
        }
        
        // Gemini Free
        setGeminiFreeApiKey(savedSettings.geminiFreeApiKey || '');
        setGeminiFreeModel(savedSettings.geminiFreeModel || 'gemini-2.0-flash');
        
        // Gemini Pro
        setGeminiApiKey(savedSettings.geminiApiKey || '');
        setGeminiModel(savedSettings.geminiModel || 'gemini-1.5-pro');
        
        // DeepSeek
        setDeepseekApiKey(savedSettings.deepseekApiKey || '');
        setDeepseekModel(savedSettings.deepseekModel || 'deepseek-chat');
        
        // Kimi
        setKimiApiKey(savedSettings.kimiApiKey || '');
        setKimiModel(savedSettings.kimiModel || 'kimi-k2');
        
        // LM Studio
        setLmStudioHost(savedSettings.lmStudioHost || 'http://localhost:1234/v1');
        setLmStudioModel(savedSettings.lmStudioModel || '');
        setLmStudioEmbeddingModel(savedSettings.lmStudioEmbeddingModel || '');
        
        setAiProvider(savedSettings.aiProvider || 'ollama');
        setOllamaModel(savedSettings.ollamaModel || '');
        setOllamaEmbeddingModel(savedSettings.ollamaEmbeddingModel || 'nomic-embed-text');
        setOllamaModelSupportsStreaming(savedSettings.ollamaModelSupportsStreaming || false);
        if (savedSettings.ollamaHost) setOllamaHost(savedSettings.ollamaHost);
        if (savedSettings.outputDirectory) setOutputDirectory(savedSettings.outputDirectory);
        if (savedSettings.databasePath) setDatabasePath(savedSettings.databasePath);
      }
      
      // Check Ollama with loaded/default host
      // Pasamos explícitamente los modelos guardados
      await checkOllamaConnection(
        savedSettings?.ollamaHost || ollamaHost, 
        savedSettings?.ollamaModel,
        savedSettings?.ollamaEmbeddingModel
      );
      
      // Check LM Studio (pasar modelos guardados)
      checkLMStudioConnection(
        savedSettings?.lmStudioHost || lmStudioHost,
        savedSettings?.lmStudioModel,
        savedSettings?.lmStudioEmbeddingModel
      );
      
      // Load Gemini models if API key exists
      if (savedSettings?.geminiFreeApiKey) {
        loadGeminiModels(savedSettings.geminiFreeApiKey, true);
      }
      if (savedSettings?.geminiApiKey) {
        loadGeminiModels(savedSettings.geminiApiKey, false);
      }
      
      setHasLoadedSettings(true);
    } catch (error) {
      console.error('Error cargando ajustes:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const checkOllamaConnection = async (hostToCheck, savedChatModel = null, savedEmbeddingModel = null) => {
    const host = hostToCheck || ollamaHost;
    const isAvailable = await checkOllamaAvailability(host);
    setOllamaAvailable(isAvailable);
    if (isAvailable) {
      try {
        const models = await getAvailableModels(host);
        
        // 1. Filtrar modelos de CHAT (sin 'embed')
        const chatModels = models.filter(m => !m.name.includes('embed'));
        const modelsToUse = chatModels.length > 0 ? chatModels : models;
        setOllamaModels(modelsToUse);
        
        // 2. Filtrar modelos de EMBEDDINGS (con 'embed' o todos)
        // Si no hay modelos con 'embed', mostramos todos para que el usuario elija
        const embeddingModels = models.filter(m => m.name.includes('embed'));
        const embeddingModelsToUse = embeddingModels.length > 0 ? embeddingModels : models;
        setOllamaEmbeddingModels(embeddingModelsToUse);

        // --- Selección Default Chat Model ---
        const currentChatModel = savedChatModel || ollamaModel;
        const isValidChatModel = modelsToUse.some(m => m.name === currentChatModel);
        
        if ((!currentChatModel || !isValidChatModel) && modelsToUse.length > 0) {
          setOllamaModel(modelsToUse[0].name);
        } else if (currentChatModel && isValidChatModel) {
            setOllamaModel(currentChatModel);
        }

        // --- Selección Default Embedding Model ---
        const currentEmbeddingModel = savedEmbeddingModel || ollamaEmbeddingModel;
        const isValidEmbeddingModel = embeddingModelsToUse.some(m => m.name === currentEmbeddingModel);

        if (currentEmbeddingModel && isValidEmbeddingModel) {
            setOllamaEmbeddingModel(currentEmbeddingModel);
        } else if (embeddingModelsToUse.length > 0) {
            // Preferir nomic-embed-text si existe
            const nomic = embeddingModelsToUse.find(m => m.name.includes('nomic'));
            setOllamaEmbeddingModel(nomic ? nomic.name : embeddingModelsToUse[0].name);
        }

      } catch (err) {
        console.error("Error obteniendo modelos de ollama", err);
      }
    } else {
      setOllamaModels([]);
      setOllamaEmbeddingModels([]);
    }
  };

  const checkLMStudioConnection = async (hostToCheck, savedChatModel = null, savedEmbeddingModel = null) => {
    const host = hostToCheck || lmStudioHost;
    const isAvailable = await checkLMStudioAvailability(host);
    setLmStudioAvailable(isAvailable);
    if (isAvailable) {
      try {
        const models = await getLMStudioModels(host);
        setLmStudioModels(models);

        // Filtrar modelos de CHAT (sin 'embed' en el nombre)
        const chatModels = models.filter(m => !m.name.toLowerCase().includes('embed'));
        const chatModelsToUse = chatModels.length > 0 ? chatModels : models;
        setLmStudioChatModels(chatModelsToUse);

        // Filtrar modelos de EMBEDDINGS (con 'embed' en el nombre)
        const embeddingModels = models.filter(m => m.name.toLowerCase().includes('embed'));
        const embeddingModelsToUse = embeddingModels.length > 0 ? embeddingModels : models;
        setLmStudioEmbeddingModels(embeddingModelsToUse);

        // Auto-seleccionar modelo de chat si no hay uno válido
        const currentChatModel = savedChatModel || lmStudioModel;
        const isValidChatModel = chatModelsToUse.some(m => m.name === currentChatModel);
        if ((!currentChatModel || !isValidChatModel) && chatModelsToUse.length > 0) {
          setLmStudioModel(chatModelsToUse[0].name);
        }

        // Auto-seleccionar modelo de embeddings si no hay uno válido
        const currentEmbeddingModel = savedEmbeddingModel || lmStudioEmbeddingModel;
        const isValidEmbeddingModel = embeddingModelsToUse.some(m => m.name === currentEmbeddingModel);
        if (currentEmbeddingModel && isValidEmbeddingModel) {
          setLmStudioEmbeddingModel(currentEmbeddingModel);
        } else if (embeddingModelsToUse.length > 0) {
          setLmStudioEmbeddingModel(embeddingModelsToUse[0].name);
        }
      } catch (err) {
        console.error("Error fetching LM Studio models", err);
      }
    } else {
      setLmStudioModels([]);
      setLmStudioChatModels([]);
      setLmStudioEmbeddingModels([]);
    }
  };

  const loadGeminiModels = async (apiKey, isFreeTier = false) => {
    if (!apiKey) {
      if (isFreeTier) {
        setGeminiFreeModels([]);
        setGeminiFreeModelsError('');
      } else {
        setGeminiModels([]);
        setGeminiModelsError('');
      }
      return;
    }

    if (isFreeTier) {
      setGeminiFreeModelsLoading(true);
      setGeminiFreeModelsError('');
    } else {
      setGeminiModelsLoading(true);
      setGeminiModelsError('');
    }

    try {
      const models = await getGeminiAvailableModels(apiKey);
      if (isFreeTier) {
        setGeminiFreeModels(models);
        const currentModelExists = models.some(m => m.name === geminiFreeModel);
        if (!currentModelExists && models.length > 0) {
          setGeminiFreeModel(models[0].name);
        }
      } else {
        setGeminiModels(models);
        const currentModelExists = models.some(m => m.name === geminiModel);
        if (!currentModelExists && models.length > 0) {
          setGeminiModel(models[0].name);
        }
      }
    } catch (error) {
      console.error('Error cargando modelos de Gemini:', error);
      if (isFreeTier) {
        setGeminiFreeModelsError('No se pudieron cargar los modelos. Verifica tu API Key.');
        setGeminiFreeModels([]);
      } else {
        setGeminiModelsError('No se pudieron cargar los modelos. Verifica tu API Key.');
        setGeminiModels([]);
      }
    } finally {
      if (isFreeTier) {
        setGeminiFreeModelsLoading(false);
      } else {
        setGeminiModelsLoading(false);
      }
    }
  };

  const handleOllamaModelChange = async (newModel) => {
    setOllamaModel(newModel);

    if (newModel && ollamaAvailable) {
      setIsCheckingModel(true);
      setOllamaContextLength(null);
      try {
        console.log(`🔍 Verificando modelo ${newModel}...`);
        const [supportsStreaming, modelInfo] = await Promise.all([
          checkModelSupportsStreaming(newModel, ollamaHost),
          getOllamaModelInfo(newModel, ollamaHost)
        ]);
        setOllamaModelSupportsStreaming(supportsStreaming);
        if (modelInfo?.numCtx) setOllamaContextLength(modelInfo.numCtx);
        console.log(`📝 Modelo ${newModel} - Streaming: ${supportsStreaming ? 'SÍ' : 'NO'} | numCtx: ${modelInfo?.numCtx}`);
      } catch (error) {
        console.error(`❌ Error verificando modelo ${newModel}:`, error);
        setOllamaModelSupportsStreaming(false);
      } finally {
        setIsCheckingModel(false);
      }
    } else {
      setOllamaModelSupportsStreaming(false);
      setOllamaContextLength(null);
      setIsCheckingModel(false);
    }
  };

  const handleRequestMicPermission = async () => {
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
      
      // Recargar micrófonos ahora que hay permisos
      const systemMicrophones = await getSystemMicrophones();
      setMicrophones(systemMicrophones);
    } catch (error) {
      console.error("Microphone permission denied:", error);
      setMicStatus('denied');
    }
  };

  const handleSaveSettings = async () => {
    setIsSaving(true);
    setSaveMessage('');
    
    try {
      await updateSettings({
        language: selectedLanguage,
        uiLanguage: selectedUiLanguage,
        microphone: selectedMicrophone,
        notificationsEnabled: notificationsEnabled,
        fontSize: fontSize,
        whisperModel: whisperModel,
        cpuThreads: cpuThreads,
        // Gemini Free
        geminiFreeApiKey: geminiFreeApiKey,
        geminiFreeModel: geminiFreeModel,
        // Gemini Pro
        geminiApiKey: geminiApiKey,
        geminiModel: geminiModel,
        // DeepSeek
        deepseekApiKey: deepseekApiKey,
        deepseekModel: deepseekModel,
        // Kimi
        kimiApiKey: kimiApiKey,
        kimiModel: kimiModel,
        // LM Studio
        lmStudioHost: lmStudioHost,
        lmStudioModel: lmStudioModel,
        lmStudioEmbeddingModel: lmStudioEmbeddingModel,
        // Ollama
        aiProvider: aiProvider,
        ollamaModel: ollamaModel,
        ollamaEmbeddingModel: ollamaEmbeddingModel,
        ollamaHost: ollamaHost,
        ollamaModelSupportsStreaming: ollamaModelSupportsStreaming,
        outputDirectory: outputDirectory,
        databasePath: databasePath || undefined
      });
      setSaveMessage(t('settings.messages.saveSuccess'));
      if (onSettingsSaved) onSettingsSaved();
      setTimeout(() => setSaveMessage(''), 3000);
    } catch (error) {
      console.error('Error guardando ajustes:', error);
      setSaveMessage(t('settings.messages.saveError'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleUiLanguageChange = (lang) => {
    setSelectedUiLanguage(lang);
  };

  const handleChangeDirectory = async () => {
    if (window.electronAPI && window.electronAPI.selectDirectory) {
      const path = await window.electronAPI.selectDirectory();
      if (path) {
        setOutputDirectory(path);
      }
    } else {
      alert(t('settings.misc.directoryNotSupported'));
    }
  };

  const handleChangeDatabasePath = async () => {
    if (window.electronAPI && window.electronAPI.selectDirectory) {
      const dir = await window.electronAPI.selectDirectory();
      if (!dir) return;
      const newPath = dir + '/recordings.db';
      if (newPath === databasePath) return;
      setDbChangeError('');
      setDbMigrateModal({ newPath });
    } else {
      alert(t('settings.misc.directoryNotSupported'));
    }
  };

  const handleConfirmDbChange = async (migrate) => {
    if (!dbMigrateModal) return;
    const result = await window.electronAPI.changeDbPath(dbMigrateModal.newPath, migrate);
    if (result.success) {
      setDatabasePath(dbMigrateModal.newPath);
      setDbMigrateModal(null);
      setDbChangeError('');
    } else {
      setDbChangeError(`Error: ${result.error}`);
    }
  };

  const toggleProvider = (provider) => {
    // Radio button logic: only switch if clicking the non-active one
    // But since the toggle visually represents "Active", clicking the active one implies turning it off?
    // User requirement: "viceversa". 
    // If I click 'ollama' (inactive), set 'ollama'.
    // If I click 'gemini' (active), typically in radio groups you can't deselect.
    // I'll stick to: clicking forces selection.
    setAiProvider(provider);
  };

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
            <h2 className={styles.pageTitle}>{t('settings.subtitle')}</h2>
            <p className={styles.pageDescription}>{t('settings.description')}</p>
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
          </div>

          {activeTab === 'agents' ? (
            /* --- AI Agents Tab --- */
            <>
              {/* --- Local Providers Section --- */}
              <section className={styles.section}>
                <div className={styles.sectionHeader}>
                  <div className={styles.sectionTitleGroup}>
                    <MdComputer className={styles.sectionIcon} size={20} />
                    <h3 className={styles.sectionTitle}>{t('settings.sections.localProviders')}</h3>
                  </div>
                  <span className={`${styles.badge} ${['ollama', 'lmstudio'].includes(aiProvider) ? styles.badgeActive : styles.badgeInactive}`}>
                    {aiProvider === 'ollama' ? t('settings.providers.ollamaActive') :
                     aiProvider === 'lmstudio' ? t('settings.providers.lmStudioActive') : t('settings.providers.inactive')}
                  </span>
                </div>

                {/* Ollama (1st) */}
                <div className={`${styles.card} ${aiProvider !== 'ollama' ? styles.cardDisabled : ''}`}>
                  <div className={styles.cardHeader}>
                    <div className={styles.providerInfo}>
                      <div className={`${styles.providerIcon} ${styles.ollamaIcon}`}>
                        <MdTerminal size={24} />
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <h4 className={styles.providerName}>Ollama</h4>
                          <InfoTooltip
                            title={t('modelInfo.title')}
                            sections={[
                              {
                                title: t('modelInfo.generalModel'),
                                items: [
                                  { icon: '⭐', label: t('modelInfo.bestPerformance'), value: 'deepseek-r1:8b' },
                                  { icon: '🪶', label: t('modelInfo.lessResources'), value: 'gemma-7b-it' },
                                ],
                              },
                              {
                                title: t('modelInfo.embedding'),
                                items: [
                                  { icon: '⭐', label: t('modelInfo.bestPerformance'), value: 'mxbai-embed-large' },
                                  { icon: '🪶', label: t('modelInfo.lessResources'), value: 'nomic-embed-text' },
                                ],
                              },
                            ]}
                          />
                        </div>
                        <p className={styles.providerDesc}>{t('settings.providers.localInference')}</p>
                      </div>
                    </div>
                    <label className={styles.toggleWrapper}>
                      <input 
                        type="checkbox" 
                        className={styles.toggleInput}
                        checked={aiProvider === 'ollama'}
                        onChange={() => toggleProvider('ollama')}
                      />
                      <div className={styles.toggleSlider}></div>
                    </label>
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.label}>{t('settings.fields.hostUrl')}</label>
                    <div className={styles.inputRow}>
                      <input
                        type="text"
                        className={styles.input}
                        value={ollamaHost}
                        onChange={(e) => setOllamaHost(e.target.value)}
                        placeholder="http://localhost:11434"
                        disabled={aiProvider !== 'ollama'}
                      />
                      <button
                        className={styles.checkBtn}
                        onClick={() => checkOllamaConnection(ollamaHost)}
                        disabled={aiProvider !== 'ollama'}
                      >
                        <MdRefresh size={18} />
                        {t('settings.buttons.test')}
                      </button>
                    </div>
                    {!ollamaAvailable ? (
                      <p className={styles.errorText}>
                        {t('settings.messages.serviceNotDetected', { host: ollamaHost })}
                      </p>
                    ) : (
                      <p className={styles.helpText} style={{ color: '#059669' }}>
                        {t('settings.messages.serviceConnected')}
                      </p>
                    )}
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.label}>{t('settings.fields.model')}</label>
                    <select
                      className={styles.input}
                      value={ollamaModel}
                      onChange={(e) => handleOllamaModelChange(e.target.value)}
                      disabled={aiProvider !== 'ollama' || !ollamaAvailable || isCheckingModel}
                    >
                      <option value="" disabled>{t('settings.misc.selectModel')}</option>
                      {ollamaModels.map(model => (
                        <option key={model.name} value={model.name}>{model.name}</option>
                      ))}
                    </select>
                    {isCheckingModel && (
                      <p className={styles.helpText} style={{ color: '#0ea5e9', display: 'flex', alignItems: 'center' }}>
                        <MdRefresh className={styles.spinner} style={{ marginRight: '4px' }} />
                        {t('settings.messages.verifyingModel')}
                      </p>
                    )}
                    {ollamaModel && !isCheckingModel && (
                      <p className={styles.helpText} style={{ color: ollamaModelSupportsStreaming ? '#059669' : '#dc2626' }}>
                        {ollamaModelSupportsStreaming ? t('settings.messages.supportsStreaming') : t('settings.messages.noStreaming')}
                      </p>
                    )}
                    {ollamaModel && !isCheckingModel && ollamaContextLength && (
                      <p className={styles.helpText} style={{ color: '#6B7280', marginTop: '4px' }}>
                        {t('settings.messages.contextLength', { n: ollamaContextLength.toLocaleString() })}
                        {' '}<span style={{ color: '#9CA3AF' }}>({t('settings.messages.configureInOllama')})</span>
                      </p>
                    )}
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.label}>{t('settings.fields.embeddingModel', { provider: 'Ollama' })}</label>
                    <select
                      className={styles.input}
                      value={ollamaEmbeddingModel}
                      onChange={(e) => setOllamaEmbeddingModel(e.target.value)}
                      disabled={aiProvider !== 'ollama' || !ollamaAvailable}
                    >
                      {ollamaEmbeddingModels.length === 0 && <option value="">{t('settings.misc.loading')}</option>}
                      {ollamaEmbeddingModels.map(model => (
                        <option key={model.name} value={model.name}>{model.name}</option>
                      ))}
                    </select>
                    <p className={styles.helpText}>
                      {t('settings.helpText.embeddingModel')}
                    </p>
                  </div>
                </div>

                {/* LM Studio (2nd) */}
                <div className={`${styles.card} ${aiProvider !== 'lmstudio' ? styles.cardDisabled : ''}`} style={{marginTop: '16px'}}>
                  <div className={styles.cardHeader}>
                    <div className={styles.providerInfo}>
                      <div className={`${styles.providerIcon} ${styles.lmStudioIcon}`}>
                        <MdSmartToy size={24} />
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <h4 className={styles.providerName}>LM Studio</h4>
                          <InfoTooltip
                            title={t('modelInfo.title')}
                            sections={[
                              {
                                title: t('modelInfo.generalModel'),
                                items: [
                                  { icon: '⭐', label: t('modelInfo.bestPerformance'), value: 'deepseek-r1:8b' },
                                  { icon: '🪶', label: t('modelInfo.lessResources'), value: 'gemma-7b-it' },
                                ],
                              },
                              {
                                title: t('modelInfo.embedding'),
                                items: [
                                  { icon: '⭐', label: t('modelInfo.bestPerformance'), value: 'mxbai-embed-large' },
                                  { icon: '🪶', label: t('modelInfo.lessResources'), value: 'nomic-embed-text' },
                                ],
                              },
                            ]}
                          />
                        </div>
                        <p className={styles.providerDesc}>{t('settings.providers.localServer')}</p>
                      </div>
                    </div>
                    <label className={styles.toggleWrapper}>
                      <input 
                        type="checkbox" 
                        className={styles.toggleInput}
                        checked={aiProvider === 'lmstudio'}
                        onChange={() => toggleProvider('lmstudio')}
                      />
                      <div className={styles.toggleSlider}></div>
                    </label>
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.label}>{t('settings.fields.baseUrl')}</label>
                    <div className={styles.inputRow}>
                      <input
                        type="text"
                        className={styles.input}
                        value={lmStudioHost}
                        onChange={(e) => setLmStudioHost(e.target.value)}
                        placeholder="http://localhost:1234/v1"
                        disabled={aiProvider !== 'lmstudio'}
                      />
                      <button
                        className={styles.checkBtn}
                        onClick={() => checkLMStudioConnection(lmStudioHost)}
                        disabled={aiProvider !== 'lmstudio'}
                      >
                        <MdRefresh size={18} />
                        {t('settings.buttons.test')}
                      </button>
                    </div>
                    {!lmStudioAvailable ? (
                      <p className={styles.errorText}>
                        {t('settings.messages.serviceNotDetected', { host: lmStudioHost })}
                      </p>
                    ) : (
                      <p className={styles.helpText} style={{ color: '#059669' }}>
                        {t('settings.messages.serviceConnected')}
                      </p>
                    )}
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.label}>{t('settings.fields.model')}</label>
                    <select
                      className={styles.input}
                      value={lmStudioModel}
                      onChange={(e) => setLmStudioModel(e.target.value)}
                      disabled={aiProvider !== 'lmstudio' || !lmStudioAvailable}
                    >
                      <option value="" disabled>{t('settings.misc.selectModel')}</option>
                      {(lmStudioChatModels.length > 0 ? lmStudioChatModels : lmStudioModels).map(model => (
                        <option key={model.name} value={model.name}>{model.name}</option>
                      ))}
                    </select>
                    {lmStudioAvailable && lmStudioModels.length === 0 && (
                      <p className={styles.helpText} style={{ color: '#dc2626' }}>
                        {t('settings.messages.modelError')}
                      </p>
                    )}
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.label}>{t('settings.fields.embeddingModel', { provider: 'LM Studio' })}</label>
                    <select
                      className={styles.input}
                      value={lmStudioEmbeddingModel}
                      onChange={(e) => setLmStudioEmbeddingModel(e.target.value)}
                      disabled={aiProvider !== 'lmstudio' || !lmStudioAvailable}
                    >
                      {lmStudioEmbeddingModels.length === 0 && <option value="">{t('settings.misc.noModels')}</option>}
                      {lmStudioEmbeddingModels.map(model => (
                        <option key={model.name} value={model.name}>{model.name}</option>
                      ))}
                    </select>
                    <p className={styles.helpText}>
                      {t('settings.helpText.embeddingModel')}
                    </p>
                  </div>
                </div>
              </section>

              {/* --- Cloud Providers Section --- */}
              <section className={styles.section}>
                <div className={styles.sectionHeader}>
                  <div className={styles.sectionTitleGroup}>
                    <MdCloud className={styles.sectionIcon} size={20} />
                    <h3 className={styles.sectionTitle}>{t('settings.sections.cloudProviders')}</h3>
                  </div>
                  <span className={`${styles.badge} ${['geminifree', 'gemini', 'deepseek', 'kimi'].includes(aiProvider) ? styles.badgeActive : styles.badgeInactive}`}>
                    {aiProvider === 'geminifree' ? 'Gemini Free' :
                     aiProvider === 'gemini' ? 'Gemini Pro' :
                     aiProvider === 'deepseek' ? 'DeepSeek' :
                     aiProvider === 'kimi' ? 'Kimi' : t('settings.providers.inactive')}
                  </span>
                </div>

                {/* Gemini Free */}
                <div className={`${styles.card} ${aiProvider !== 'geminifree' ? styles.cardDisabled : ''}`}>
                  <div className={styles.cardHeader}>
                    <div className={styles.providerInfo}>
                      <div className={`${styles.providerIcon} ${styles.geminiIcon}`}>
                        <MdAutoAwesome size={24} />
                      </div>
                      <div>
                        <h4 className={styles.providerName}>Gemini Free</h4>
                        <p className={styles.providerDesc}>{t('settings.providers.googleFree')}</p>
                      </div>
                    </div>
                    <label className={styles.toggleWrapper}>
                      <input 
                        type="checkbox" 
                        className={styles.toggleInput}
                        checked={aiProvider === 'geminifree'}
                        onChange={() => toggleProvider('geminifree')}
                      />
                      <div className={styles.toggleSlider}></div>
                    </label>
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.label}>{t('settings.fields.apiKey')}</label>
                    <div className={styles.inputWrapper}>
                      <input 
                        type={showApiKey ? "text" : "password"} 
                        className={styles.input}
                        placeholder={t('settings.misc.enterApiKey')}
                        value={geminiFreeApiKey}
                        onChange={(e) => {
                          const newKey = e.target.value;
                          setGeminiFreeApiKey(newKey);
                          if (newKey && newKey.length > 10) {
                            clearTimeout(window.geminiFreeKeyTimeout);
                            window.geminiFreeKeyTimeout = setTimeout(() => {
                              loadGeminiModels(newKey, true);
                            }, 1000);
                          }
                        }}
                        disabled={aiProvider !== 'geminifree'}
                      />
                      <button 
                        className={styles.inputIcon}
                        onClick={() => setShowApiKey(!showApiKey)}
                      >
                        {showApiKey ? <MdVisibilityOff /> : <MdVisibility />}
                      </button>
                    </div>
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.label}>{t('settings.fields.model')}</label>
                    <div className={styles.inputRow}>
                      <select
                        className={styles.input}
                        value={geminiFreeModel}
                        onChange={(e) => setGeminiFreeModel(e.target.value)}
                        disabled={aiProvider !== 'geminifree' || geminiFreeModelsLoading || geminiFreeModels.length === 0}
                      >
                        {geminiFreeModels.length === 0 ? (
                          <option value="" disabled>
                            {geminiFreeApiKey ? (geminiFreeModelsLoading ? t('settings.misc.loading') : t('settings.misc.noModels')) : t('settings.misc.enterApiKey')}
                          </option>
                        ) : (
                          geminiFreeModels.map(model => (
                            <option key={model.name} value={model.name}>
                              {model.label}
                            </option>
                          ))
                        )}
                      </select>
                      <button
                        className={styles.checkBtn}
                        onClick={() => loadGeminiModels(geminiFreeApiKey, true)}
                        disabled={aiProvider !== 'geminifree' || !geminiFreeApiKey || geminiFreeModelsLoading}
                      >
                        <MdRefresh size={18} className={geminiFreeModelsLoading ? styles.spinner : ''} />
                        {t('settings.buttons.refresh')}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Gemini Pro */}
                <div className={`${styles.card} ${aiProvider !== 'gemini' ? styles.cardDisabled : ''}`} style={{marginTop: '16px'}}>
                  <div className={styles.cardHeader}>
                    <div className={styles.providerInfo}>
                      <div className={`${styles.providerIcon} ${styles.geminiIcon}`}>
                        <MdAutoAwesome size={24} />
                      </div>
                      <div>
                        <h4 className={styles.providerName}>Gemini Pro</h4>
                        <p className={styles.providerDesc}>{t('settings.providers.googlePaid')}</p>
                      </div>
                    </div>
                    <label className={styles.toggleWrapper}>
                      <input 
                        type="checkbox" 
                        className={styles.toggleInput}
                        checked={aiProvider === 'gemini'}
                        onChange={() => toggleProvider('gemini')}
                      />
                      <div className={styles.toggleSlider}></div>
                    </label>
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.label}>{t('settings.fields.apiKey')}</label>
                    <div className={styles.inputWrapper}>
                      <input 
                        type={showApiKey ? "text" : "password"} 
                        className={styles.input}
                        placeholder={t('settings.misc.enterApiKey')}
                        value={geminiApiKey}
                        onChange={(e) => {
                          const newKey = e.target.value;
                          setGeminiApiKey(newKey);
                          if (newKey && newKey.length > 10) {
                            clearTimeout(window.geminiKeyTimeout);
                            window.geminiKeyTimeout = setTimeout(() => {
                              loadGeminiModels(newKey, false);
                            }, 1000);
                          }
                        }}
                        disabled={aiProvider !== 'gemini'}
                      />
                      <button 
                        className={styles.inputIcon}
                        onClick={() => setShowApiKey(!showApiKey)}
                      >
                        {showApiKey ? <MdVisibilityOff /> : <MdVisibility />}
                      </button>
                    </div>
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.label}>{t('settings.fields.model')}</label>
                    <div className={styles.inputRow}>
                      <select
                        className={styles.input}
                        value={geminiModel}
                        onChange={(e) => setGeminiModel(e.target.value)}
                        disabled={aiProvider !== 'gemini' || geminiModelsLoading || geminiModels.length === 0}
                      >
                        {geminiModels.length === 0 ? (
                          <option value="" disabled>
                            {geminiApiKey ? (geminiModelsLoading ? t('settings.misc.loading') : t('settings.misc.noModels')) : t('settings.misc.enterApiKey')}
                          </option>
                        ) : (
                          geminiModels.map(model => (
                            <option key={model.name} value={model.name}>
                              {model.label}
                            </option>
                          ))
                        )}
                      </select>
                      <button
                        className={styles.checkBtn}
                        onClick={() => loadGeminiModels(geminiApiKey, false)}
                        disabled={aiProvider !== 'gemini' || !geminiApiKey || geminiModelsLoading}
                      >
                        <MdRefresh size={18} className={geminiModelsLoading ? styles.spinner : ''} />
                        {t('settings.buttons.refresh')}
                      </button>
                    </div>
                  </div>
                </div>

                {/* DeepSeek */}
                <div className={`${styles.card} ${aiProvider !== 'deepseek' ? styles.cardDisabled : ''}`} style={{marginTop: '16px'}}>
                  <div className={styles.cardHeader}>
                    <div className={styles.providerInfo}>
                      <div className={`${styles.providerIcon}`} style={{backgroundColor: '#dbeafe', color: '#3b82f6'}}>
                        <MdAutoAwesome size={24} />
                      </div>
                      <div>
                        <h4 className={styles.providerName}>DeepSeek</h4>
                        <p className={styles.providerDesc}>DeepSeek AI</p>
                      </div>
                    </div>
                    <label className={styles.toggleWrapper}>
                      <input 
                        type="checkbox" 
                        className={styles.toggleInput}
                        checked={aiProvider === 'deepseek'}
                        onChange={() => toggleProvider('deepseek')}
                      />
                      <div className={styles.toggleSlider}></div>
                    </label>
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.label}>{t('settings.fields.apiKey')}</label>
                    <div className={styles.inputWrapper}>
                      <input 
                        type={showApiKey ? "text" : "password"} 
                        className={styles.input}
                        placeholder={t('settings.misc.enterApiKey')}
                        value={deepseekApiKey}
                        onChange={(e) => setDeepseekApiKey(e.target.value)}
                        disabled={aiProvider !== 'deepseek'}
                      />
                      <button 
                        className={styles.inputIcon}
                        onClick={() => setShowApiKey(!showApiKey)}
                      >
                        {showApiKey ? <MdVisibilityOff /> : <MdVisibility />}
                      </button>
                    </div>
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.label}>{t('settings.fields.model')}</label>
                    <select
                      className={styles.input}
                      value={deepseekModel}
                      onChange={(e) => setDeepseekModel(e.target.value)}
                      disabled={aiProvider !== 'deepseek'}
                    >
                      {deepseekModels.map(model => (
                        <option key={model.name} value={model.name}>
                          {model.label}
                        </option>
                      ))}
                    </select>
                    <p className={styles.helpText} style={{ color: '#059669' }}>
                      ✓ {deepseekModels.find(m => m.name === deepseekModel)?.description}
                    </p>
                  </div>
                </div>

                {/* Kimi */}
                <div className={`${styles.card} ${aiProvider !== 'kimi' ? styles.cardDisabled : ''}`} style={{marginTop: '16px'}}>
                  <div className={styles.cardHeader}>
                    <div className={styles.providerInfo}>
                      <div className={`${styles.providerIcon}`} style={{backgroundColor: '#fce7f3', color: '#ec4899'}}>
                        <MdAutoAwesome size={24} />
                      </div>
                      <div>
                        <h4 className={styles.providerName}>Kimi</h4>
                        <p className={styles.providerDesc}>Moonshot AI</p>
                      </div>
                    </div>
                    <label className={styles.toggleWrapper}>
                      <input 
                        type="checkbox" 
                        className={styles.toggleInput}
                        checked={aiProvider === 'kimi'}
                        onChange={() => toggleProvider('kimi')}
                      />
                      <div className={styles.toggleSlider}></div>
                    </label>
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.label}>{t('settings.fields.apiKey')}</label>
                    <div className={styles.inputWrapper}>
                      <input 
                        type={showApiKey ? "text" : "password"} 
                        className={styles.input}
                        placeholder={t('settings.misc.enterApiKey')}
                        value={kimiApiKey}
                        onChange={(e) => setKimiApiKey(e.target.value)}
                        disabled={aiProvider !== 'kimi'}
                      />
                      <button 
                        className={styles.inputIcon}
                        onClick={() => setShowApiKey(!showApiKey)}
                      >
                        {showApiKey ? <MdVisibilityOff /> : <MdVisibility />}
                      </button>
                    </div>
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.label}>{t('settings.fields.model')}</label>
                    <select
                      className={styles.input}
                      value={kimiModel}
                      onChange={(e) => setKimiModel(e.target.value)}
                      disabled={aiProvider !== 'kimi'}
                    >
                      {kimiModels.map(model => (
                        <option key={model.name} value={model.name}>
                          {model.label}
                        </option>
                      ))}
                    </select>
                    <p className={styles.helpText} style={{ color: '#059669' }}>
                      ✓ {kimiModels.find(m => m.name === kimiModel)?.description}
                    </p>
                  </div>
                </div>
              </section>
            </>
          ) : (
            /* --- General Tab --- */
            <>
              {/* --- Storage Section --- */}
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
                    <div className={`${styles.input} truncate bg-gray-50 text-gray-500`} title={outputDirectory}>
                      {outputDirectory || t('settings.misc.default')}
                    </div>
                    <button
                      className={styles.checkBtn}
                      onClick={handleChangeDirectory}
                    >
                      {t('settings.buttons.change')}
                    </button>
                  </div>

                  <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #F1F5F9' }}>
                    <label className={styles.label}>{t('settings.fields.databasePath')}</label>
                    <div className={styles.inputRow}>
                      <div className={`${styles.input} truncate bg-gray-50 text-gray-500`} title={databasePath}>
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
                    background: 'white', borderRadius: '16px', padding: '32px',
                    maxWidth: '480px', width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,0.2)'
                  }}>
                    <h4 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0F172A', marginBottom: '8px' }}>
                      {t('settings.misc.changeDbTitle')}
                    </h4>
                    <p style={{ fontSize: '0.875rem', color: '#475569', marginBottom: '4px' }}>
                      {t('settings.misc.changeDbNewPath')}
                    </p>
                    <code style={{
                      display: 'block', background: '#F8FAFC', border: '1px solid #E2E8F0',
                      borderRadius: '8px', padding: '8px 12px', fontSize: '0.8rem', color: '#334155',
                      wordBreak: 'break-all', marginBottom: '16px'
                    }}>
                      {dbMigrateModal.newPath}
                    </code>
                    <p style={{ fontSize: '0.875rem', color: '#475569', marginBottom: '16px' }}>
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

              {/* --- Transcription Section --- */}
              <section className={styles.section}>
                <div className={styles.sectionHeader}>
                  <div className={styles.sectionTitleGroup}>
                    <MdTranslate className={styles.sectionIcon} size={20} />
                    <h3 className={styles.sectionTitle}>{t('settings.sections.transcription')}</h3>
                  </div>
                </div>
                <div className={styles.card}>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>{t('settings.fields.language')}</label>
                    <select
                      className={styles.input}
                      value={selectedLanguage}
                      onChange={(e) => setSelectedLanguage(e.target.value)}
                    >
                      {mockLanguages.map(lang => (
                        <option key={lang.value} value={lang.value}>{lang.label}</option>
                      ))}
                    </select>
                    <p className={styles.helpText}>
                      {t('settings.helpText.transcriptionLanguage')}
                    </p>
                  </div>

                  <div className={styles.formGroup} style={{ marginBottom: '1rem' }}>
                    <label className={styles.label}>{t('settings.fields.whisperModel')}</label>
                    <select
                      className={styles.input}
                      value={whisperModel}
                      onChange={(e) => setWhisperModel(e.target.value)}
                    >
                      {whisperModels.map(model => (
                        <option key={model.value} value={model.value}>{t(`settings.whisperModels.${model.value}`)}</option>
                      ))}
                    </select>
                    <p className={styles.helpText}>
                      {t('settings.helpText.whisperModel')}
                    </p>
                  </div>

                  <div className={styles.formGroup} style={{ marginBottom: 0 }}>
                    <label className={styles.label}>{t('settings.fields.cpuThreads')}</label>
                    <select
                      className={styles.input}
                      value={cpuThreads}
                      onChange={(e) => setCpuThreads(parseInt(e.target.value))}
                    >
                      {Array.from({ length: maxCpuThreads }, (_, i) => i + 1).map(num => (
                        <option key={num} value={num}>
                          {num} {num === Math.floor(maxCpuThreads / 2) ? t('settings.misc.recommended') : ''} {num === maxCpuThreads ? t('settings.misc.maximum') : ''}
                        </option>
                      ))}
                    </select>
                    <p className={styles.helpText}>
                      {t('settings.helpText.cpuThreads')}
                    </p>
                  </div>
                </div>
              </section>

              {/* --- Appearance Section --- */}
              <section className={styles.section}>
                <div className={styles.sectionHeader}>
                  <div className={styles.sectionTitleGroup}>
                    <MdTextFormat className={styles.sectionIcon} size={20} />
                    <h3 className={styles.sectionTitle}>{t('settings.sections.appearance')}</h3>
                  </div>
                </div>
                <div className={styles.card}>
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
                  <div className={styles.formGroup} style={{ marginBottom: 0 }}>
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

              {/* --- Audio Section --- */}
              <section className={styles.section} id="microphone-settings">
                <div className={styles.sectionHeader}>
                  <div className={styles.sectionTitleGroup}>
                    <MdMic className={styles.sectionIcon} size={20} />
                    <h3 className={styles.sectionTitle}>{t('settings.sections.audio')}</h3>
                  </div>
                </div>
                <div className={styles.card}>
                  <div className={styles.formGroup} style={{ marginBottom: 0 }}>
                    <label className={styles.label}>{t('settings.fields.microphone')}</label>
                    <select
                      className={styles.input}
                      value={selectedMicrophone}
                      onChange={(e) => setSelectedMicrophone(e.target.value)}
                    >
                      {microphones.map(mic => (
                        <option key={mic.value} value={mic.value}>{mic.label}</option>
                      ))}
                    </select>
                    <p className={styles.helpText}>
                      {t('settings.helpText.microphone')}
                    </p>
                  </div>
                </div>
              </section>

              {/* --- System Section --- */}
              <section className={styles.section}>
                <div className={styles.sectionHeader}>
                  <div className={styles.sectionTitleGroup}>
                    <MdNotifications className={styles.sectionIcon} size={20} />
                    <h3 className={styles.sectionTitle}>{t('settings.sections.system')}</h3>
                  </div>
                </div>
                <div className={styles.card}>
                  <div className={styles.cardHeader}>
                    <div className={styles.providerInfo}>
                      <div className={`${styles.providerIcon}`} style={{backgroundColor: '#e0f2fe', color: '#0ea5e9'}}>
                        <MdNotifications size={24} />
                      </div>
                      <div>
                        <h4 className={styles.providerName}>{t('settings.misc.notifications.title')}</h4>
                        <p className={styles.providerDesc}>{t('settings.misc.notifications.desc')}</p>
                      </div>
                    </div>
                    <label className={styles.toggleWrapper}>
                      <input
                        type="checkbox"
                        className={styles.toggleInput}
                        checked={notificationsEnabled}
                        onChange={(e) => setNotificationsEnabled(e.target.checked)}
                      />
                      <div className={styles.toggleSlider}></div>
                    </label>
                  </div>
                </div>

                {/* Developer Tools */}
                <div className={styles.card} style={{marginTop: '16px'}}>
                  <div className={styles.cardHeader}>
                    <div className={styles.providerInfo}>
                      <div className={`${styles.providerIcon}`} style={{backgroundColor: '#fef3c7', color: '#d97706'}}>
                        <MdTerminal size={24} />
                      </div>
                      <div>
                        <h4 className={styles.providerName}>{t('settings.misc.devTools.title')}</h4>
                        <p className={styles.providerDesc}>{t('settings.misc.devTools.desc')}</p>
                      </div>
                    </div>
                    <button
                      className={styles.checkBtn}
                      onClick={() => window.electronAPI?.toggleDevTools?.()}
                    >
                      <MdTerminal size={18} />
                      {t('settings.buttons.openDevTools')}
                    </button>
                  </div>
                </div>
              </section>

              {/* --- Permissions Section --- */}
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

              {/* --- Acerca de / Actualizaciones --- */}
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
                          style={{backgroundColor: '#10b981', color: '#fff', border: 'none'}}
                          onClick={() => window.electronAPI?.openDownloadUrl?.(updateInfo.downloadUrl)}
                        >
                          {t('settings.buttons.download')}
                        </button>
                      )}
                      {import.meta.env.DEV && (
                        <button
                          className={styles.checkBtn}
                          style={{backgroundColor: '#f59e0b', color: '#fff', border: 'none'}}
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
            </>
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
