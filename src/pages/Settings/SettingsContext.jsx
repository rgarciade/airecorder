import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { getSystemMicrophones } from '../../services/audioService';
import { getSettings, updateSettings } from '../../services/settingsService';
import { getAvailableModels, checkOllamaAvailability, checkModelSupportsStreaming, getOllamaModelInfo } from '../../services/ai/ollamaProvider';
import { getGeminiAvailableModels } from '../../services/ai/geminiProvider';
import { getDeepseekAvailableModels, getKimiAvailableModels, getLMStudioModels } from '../../services/ai/providerRouter';
import { checkLMStudioAvailability, getLMStudioModelInfo } from '../../services/ai/lmStudioProvider';
import { applyTheme } from '../../services/themeService';
import { useCustomConnections } from '../../hooks/useCustomConnections';
import { CustomOpenAIProvider, OPENAI_BASE_URL } from '../../services/ai/customOpenAIProvider';

export const mockLanguages = [
  { value: 'es', label: 'Español' },
  { value: 'en', label: 'English' },
  { value: 'fr', label: 'Français' },
];

export const fontSizes = [
  { value: 'small', label: 'Pequeño' },
  { value: 'medium', label: 'Mediano' },
  { value: 'large', label: 'Grande' },
  { value: 'xlarge', label: 'Muy Grande' },
];

export const whisperModels = [
  { value: 'tiny', label: 'Tiny (Muy Rápido)' },
  { value: 'base', label: 'Base' },
  { value: 'small', label: 'Small (Recomendado)' },
  { value: 'medium', label: 'Medium' },
  { value: 'large', label: 'Large (Preciso)' },
];

const SettingsContext = createContext(null);

export const useSettings = () => {
  const ctx = useContext(SettingsContext);
  if (!ctx) {
    throw new Error('useSettings must be used inside a SettingsProvider');
  }
  return ctx;
};

export function SettingsProvider({ children, onSettingsSaved, initialActiveTab }) {
  const { t } = useTranslation();

  // State
  const [selectedLanguage, setSelectedLanguage] = useState('en');
  const [selectedUiLanguage, setSelectedUiLanguage] = useState('es');
  const [selectedMicrophone, setSelectedMicrophone] = useState('');
  const [fontSize, setFontSize] = useState('medium');
  const [theme, setTheme] = useState('system');
  const [projectHighlightsCount, setProjectHighlightsCount] = useState(2);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [autoTranscribe, setAutoTranscribe] = useState(true);
  const [autoAnalyze, setAutoAnalyze] = useState(true);
  const [autoGenerateSchema, setAutoGenerateSchema] = useState(false);
  const [enableDiarization, setEnableDiarization] = useState(false);
  const [hfToken, setHfToken] = useState('');
  const [speakerSimilarityThreshold, setSpeakerSimilarityThreshold] = useState(0.85);
  const [whisperModel, setWhisperModel] = useState('small');
  const [cpuThreads, setCpuThreads] = useState(4);
  const [maxCpuThreads, setMaxCpuThreads] = useState(4);
  const [microphones, setMicrophones] = useState([]);
  const [micStatus, setMicStatus] = useState('unknown');
  const [isLoading, setIsLoading] = useState(true);

  // Storage
  const [outputDirectory, setOutputDirectory] = useState('');
  const [outputDirectorySize, setOutputDirectorySize] = useState(null); // GB | null
  const [databasePath, setDatabasePath] = useState('');
  const [dbMigrateModal, setDbMigrateModal] = useState(null); // { newPath } | null
  const [dbChangeError, setDbChangeError] = useState('');

  // Gemini
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

  // OpenAI
  const [openaiApiKey, setOpenaiApiKey] = useState('');
  const [openaiModel, setOpenaiModel] = useState('');
  const [openaiModels, setOpenaiModels] = useState([]);
  const [openaiModelsLoading, setOpenaiModelsLoading] = useState(false);
  const [openaiModelsError, setOpenaiModelsError] = useState('');

  const [aiProvider, setAiProvider] = useState('gemini'); // 'gemini' | 'deepseek' | 'kimi' | 'openai' | 'ollama'

  // Ollama
  const [ollamaModel, setOllamaModel] = useState('');
  const [ollamaRagModel, setOllamaRagModel] = useState(''); // Modelo de Chat
  const [ollamaEmbeddingModel, setOllamaEmbeddingModel] = useState('');
  const [ollamaModels, setOllamaModels] = useState([]);
  const [ollamaEmbeddingModels, setOllamaEmbeddingModels] = useState([]);
  const [ollamaAvailable, setOllamaAvailable] = useState(false);
  const [ollamaHost, setOllamaHost] = useState('http://localhost:11434');
  const [ollamaModelSupportsStreaming, setOllamaModelSupportsStreaming] = useState(false);
  const [isCheckingModel, setIsCheckingModel] = useState(false);

  // LM Studio
  const [lmStudioModel, setLmStudioModel] = useState('');
  const [lmStudioRagModel, setLmStudioRagModel] = useState(''); // Modelo de Chat
  const [lmStudioEmbeddingModel, setLmStudioEmbeddingModel] = useState('');
  const [lmStudioModels, setLmStudioModels] = useState([]);
  const [lmStudioChatModels, setLmStudioChatModels] = useState([]);
  const [lmStudioEmbeddingModels, setLmStudioEmbeddingModels] = useState([]);
  const [lmStudioHost, setLmStudioHost] = useState('http://localhost:1234/v1');
  const [lmStudioAvailable, setLmStudioAvailable] = useState(false);

  // Context length guardado en settings (persiste, se usa para evitar llamadas a API)
  const [ollamaContextLengthSaved, setOllamaContextLengthSaved] = useState('');
  const [lmStudioContextLengthSaved, setLmStudioContextLengthSaved] = useState('');
  // Estado de detección automática del context length
  const [ollamaCtxStatus, setOllamaCtxStatus] = useState(null); // null | 'success' | 'error'
  const [lmStudioCtxStatus, setLmStudioCtxStatus] = useState(null); // null | 'success' | 'error'
  const [isDetectingLmCtx, setIsDetectingLmCtx] = useState(false);

  // UI State
  const [activeTab, setActiveTab] = useState(initialActiveTab);
  const [showApiKey, setShowApiKey] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [hasLoadedSettings, setHasLoadedSettings] = useState(false);
  const hasScrolledRef = useRef(false);

  // Custom OpenAI-compatible connections
  const {
    connections: customConnections,
    stagedDeletions,
    setConnections: setCustomConnections,
    addConnection: addCustomConnection,
    updateConnection: updateCustomConnection,
    stageDelete: stageDeleteCustomConnection,
    cancelDelete: cancelDeleteCustomConnection,
    testConnection: testCustomConnection,
    testingConnectionId: testingCustomConnectionId,
    testResults: customConnectionTestResults,
    validateSave: validateCustomConnectionsSaveState,
    getConnectionsToSave: getCustomConnectionsToSave,
  } = useCustomConnections([]);
  const [embeddingProvider, setEmbeddingProvider] = useState('');
  const [customGeneralModel, setCustomGeneralModel] = useState('');
  const [embeddingModel, setEmbeddingModel] = useState('');
  const [lastEmbeddingModelId, setLastEmbeddingModelId] = useState('');
  const [embeddingModelChanged, setEmbeddingModelChanged] = useState(false);
  const [isReindexingRag, setIsReindexingRag] = useState(false);
  const [reindexRagMessage, setReindexRagMessage] = useState('');

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
        setTheme(savedSettings.theme || 'system');
        setProjectHighlightsCount(savedSettings.projectHighlightsCount || 2);
        setNotificationsEnabled(savedSettings.notificationsEnabled !== false); // Default true
        setAutoTranscribe(savedSettings.autoTranscribe !== false); // Default true
        setAutoAnalyze(savedSettings.autoAnalyze !== false); // Default true
        setAutoGenerateSchema(savedSettings.autoGenerateSchema === true); // Default false
        setEnableDiarization(savedSettings.enableDiarization || false);
        setHfToken(savedSettings.hfToken || '');
        setSpeakerSimilarityThreshold(savedSettings.speakerSimilarityThreshold ?? 0.85);
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

        // Gemini
        setGeminiApiKey(savedSettings.geminiApiKey || '');
        setGeminiModel(savedSettings.geminiModel || 'gemini-1.5-pro');

        // DeepSeek
        setDeepseekApiKey(savedSettings.deepseekApiKey || '');
        setDeepseekModel(savedSettings.deepseekModel || 'deepseek-chat');

        // Kimi
        setKimiApiKey(savedSettings.kimiApiKey || '');
        setKimiModel(savedSettings.kimiModel || 'kimi-k2');

        // OpenAI
        setOpenaiApiKey(savedSettings.openaiApiKey || '');
        setOpenaiModel(savedSettings.openaiModel || '');

        // Custom OpenAI-compatible connections
        setCustomConnections(savedSettings.customConnections || []);
        setEmbeddingProvider(savedSettings.embeddingProvider || '');
        setCustomGeneralModel(savedSettings.customGeneralModel || '');
        setEmbeddingModel(savedSettings.embeddingModel || '');
        setLastEmbeddingModelId(savedSettings.lastEmbeddingModelId || '');
        setEmbeddingModelChanged(false);

        // LM Studio
        setLmStudioHost(savedSettings.lmStudioHost || 'http://localhost:1234/v1');
        setLmStudioModel(savedSettings.lmStudioModel || '');
        setLmStudioRagModel(savedSettings.lmStudioRagModel || '');
        setLmStudioEmbeddingModel(savedSettings.lmStudioEmbeddingModel || '');
        setLmStudioContextLengthSaved(savedSettings.lmStudioContextLength ? String(savedSettings.lmStudioContextLength) : '');

        // Ollama context length guardado
        setOllamaContextLengthSaved(savedSettings.ollamaContextLength ? String(savedSettings.ollamaContextLength) : '');

        setAiProvider(savedSettings.aiProvider || 'ollama');
        setOllamaModel(savedSettings.ollamaModel || '');
        setOllamaRagModel(savedSettings.ollamaRagModel || '');
        setOllamaEmbeddingModel(savedSettings.ollamaEmbeddingModel || 'nomic-embed-text');
        setOllamaModelSupportsStreaming(savedSettings.ollamaModelSupportsStreaming || false);
        if (savedSettings.ollamaHost) setOllamaHost(savedSettings.ollamaHost);
        if (savedSettings.outputDirectory) {
          setOutputDirectory(savedSettings.outputDirectory);
          if (window.electronAPI?.getDirectorySize) {
            window.electronAPI.getDirectorySize(savedSettings.outputDirectory).then(r => {
              if (r?.success) setOutputDirectorySize(r.gb);
            }).catch(() => {});
          }
        }
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
      if (savedSettings?.geminiApiKey) {
        loadGeminiModels(savedSettings.geminiApiKey);
      }
      if (savedSettings?.openaiApiKey) {
        loadOpenaiModels(savedSettings.openaiApiKey);
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

  const loadGeminiModels = async (apiKey) => {
    if (!apiKey) {
      setGeminiModels([]);
      setGeminiModelsError('');
      return;
    }

    setGeminiModelsLoading(true);
    setGeminiModelsError('');

    try {
      const models = await getGeminiAvailableModels(apiKey);
      setGeminiModels(models);
      const currentModelExists = models.some(m => m.name === geminiModel);
      if (!currentModelExists && models.length > 0) {
        setGeminiModel(models[0].name);
      }
    } catch (error) {
      console.error('Error cargando modelos de Gemini:', error);
      setGeminiModelsError('No se pudieron cargar los modelos. Verifica tu API Key.');
      setGeminiModels([]);
    } finally {
      setGeminiModelsLoading(false);
    }
  };

  const loadOpenaiModels = async (apiKey) => {
    if (!apiKey) {
      setOpenaiModels([]);
      setOpenaiModelsError('');
      return;
    }

    setOpenaiModelsLoading(true);
    setOpenaiModelsError('');

    try {
      const client = new CustomOpenAIProvider({ baseUrl: OPENAI_BASE_URL, apiKey });
      const models = await client.listModels();
      setOpenaiModels(models);
      setOpenaiModel((current) => {
        const currentModelExists = models.some(m => m.name === current);
        return currentModelExists || models.length === 0 ? current : models[0].name;
      });
    } catch (error) {
      console.error('Error cargando modelos de OpenAI:', error);
      setOpenaiModelsError('No se pudieron cargar los modelos. Verifica tu API Key.');
      setOpenaiModels([]);
    } finally {
      setOpenaiModelsLoading(false);
    }
  };

  const handleOllamaModelChange = async (newModel) => {
    setOllamaModel(newModel);
    setOllamaCtxStatus(null); // Resetear estado de detección al cambiar modelo

    if (newModel && ollamaAvailable) {
      setIsCheckingModel(true);
      try {
        console.log(`🔍 Verificando modelo ${newModel}...`);
        const [supportsStreaming, modelInfo] = await Promise.all([
          checkModelSupportsStreaming(newModel, ollamaHost),
          getOllamaModelInfo(newModel, ollamaHost)
        ]);
        setOllamaModelSupportsStreaming(supportsStreaming);
        // Auto-actualizar el campo de context length si se detecta (silencioso, sin mostrar status)
        if (modelInfo?.numCtx) {
          setOllamaContextLengthSaved(String(modelInfo.numCtx));
        }
        console.log(`📝 Modelo ${newModel} - Streaming: ${supportsStreaming ? 'SÍ' : 'NO'} | numCtx: ${modelInfo?.numCtx}`);
      } catch (error) {
        console.error(`❌ Error verificando modelo ${newModel}:`, error);
        setOllamaModelSupportsStreaming(false);
      } finally {
        setIsCheckingModel(false);
      }
    } else {
      setOllamaModelSupportsStreaming(false);
      setIsCheckingModel(false);
    }
  };

  /** Detecta el context length de Ollama explícitamente (con feedback de estado) */
  const handleDetectOllamaContextLength = async () => {
    if (!ollamaModel || !ollamaAvailable) return;
    setIsCheckingModel(true);
    setOllamaCtxStatus(null);
    try {
      const info = await getOllamaModelInfo(ollamaModel, ollamaHost);
      if (info?.numCtx) {
        setOllamaContextLengthSaved(String(info.numCtx));
        setOllamaCtxStatus('success');
      } else {
        setOllamaCtxStatus('error');
      }
    } catch {
      setOllamaCtxStatus('error');
    } finally {
      setIsCheckingModel(false);
    }
  };

  /** Maneja el cambio de modelo en LM Studio con detección silenciosa de context length */
  const handleLmStudioModelChange = async (newModel) => {
    setLmStudioModel(newModel);
    setLmStudioCtxStatus(null); // Resetear estado de detección al cambiar modelo
    // Auto-detectar context length de forma silenciosa
    if (newModel && lmStudioAvailable) {
      try {
        const info = await getLMStudioModelInfo(newModel, lmStudioHost);
        if (info?.numCtx) {
          setLmStudioContextLengthSaved(String(info.numCtx));
        }
      } catch {
        // Fallo silencioso — el usuario puede usar el botón "Detectar"
      }
    }
  };

  /** Detecta el context length de LM Studio explícitamente (con feedback de estado) */
  const handleDetectLmStudioContextLength = async () => {
    if (!lmStudioModel || !lmStudioAvailable) return;
    setIsDetectingLmCtx(true);
    setLmStudioCtxStatus(null);
    try {
      const info = await getLMStudioModelInfo(lmStudioModel, lmStudioHost);
      if (info?.numCtx) {
        setLmStudioContextLengthSaved(String(info.numCtx));
        setLmStudioCtxStatus('success');
      } else {
        setLmStudioCtxStatus('error');
      }
    } catch {
      setLmStudioCtxStatus('error');
    } finally {
      setIsDetectingLmCtx(false);
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
    setReindexRagMessage('');

    const customConnectionsValidation = validateCustomConnectionsSaveState({
      aiProvider,
      embeddingProvider,
    });
    if (customConnectionsValidation.blocked) {
      setSaveMessage(t(customConnectionsValidation.error));
      setIsSaving(false);
      return;
    }

    try {
      const newEmbeddingModelId = `${embeddingProvider}:${embeddingModel}`;
      setEmbeddingModelChanged(newEmbeddingModelId !== lastEmbeddingModelId);

      await updateSettings({
        language: selectedLanguage,
        uiLanguage: selectedUiLanguage,
        microphone: selectedMicrophone,
        notificationsEnabled: notificationsEnabled,
        autoTranscribe: autoTranscribe,
        autoAnalyze: autoAnalyze,
        autoGenerateSchema: autoGenerateSchema,
        enableDiarization: enableDiarization,
        hfToken: hfToken,
        speakerSimilarityThreshold: speakerSimilarityThreshold,
        fontSize: fontSize,
        theme: theme,
        projectHighlightsCount: projectHighlightsCount,
        whisperModel: whisperModel,
        cpuThreads: cpuThreads,
        // Gemini
        geminiApiKey: geminiApiKey,
        geminiModel: geminiModel,
        // DeepSeek
        deepseekApiKey: deepseekApiKey,
        deepseekModel: deepseekModel,
        // Kimi
        kimiApiKey: kimiApiKey,
        kimiModel: kimiModel,
        // OpenAI
        openaiApiKey: openaiApiKey,
        openaiModel: openaiModel,
        // LM Studio
        lmStudioHost: lmStudioHost,
        lmStudioModel: lmStudioModel,
        lmStudioRagModel: lmStudioRagModel,
        lmStudioEmbeddingModel: lmStudioEmbeddingModel,
        // Ollama
        aiProvider: aiProvider,
        ollamaModel: ollamaModel,
        ollamaRagModel: ollamaRagModel,
        ollamaEmbeddingModel: ollamaEmbeddingModel,
        ollamaHost: ollamaHost,
        ollamaModelSupportsStreaming: ollamaModelSupportsStreaming,
        ollamaContextLength: ollamaContextLengthSaved ? parseInt(ollamaContextLengthSaved) : null,
        // LM Studio (context length)
        lmStudioContextLength: lmStudioContextLengthSaved ? parseInt(lmStudioContextLengthSaved) : null,
        // Custom OpenAI-compatible connections
        customConnections: getCustomConnectionsToSave(),
        embeddingProvider: embeddingProvider,
        customGeneralModel: customGeneralModel,
        embeddingModel: embeddingModel,
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

  const handleReindexAllRag = async () => {
    if (!window.electronAPI?.ragReindexAll) {
      setReindexRagMessage(t('settings.customConnections.reindexError'));
      return;
    }

    setIsReindexingRag(true);
    setReindexRagMessage('');

    try {
      const result = await window.electronAPI.ragReindexAll();
      if (result?.success) {
        await updateSettings({ lastEmbeddingModelId: result.lastEmbeddingModelId });
        setLastEmbeddingModelId(result.lastEmbeddingModelId || '');
        setEmbeddingModelChanged(false);
        setReindexRagMessage(t('settings.customConnections.reindexSuccess', { count: result.reindexed || 0 }));
      } else {
        setReindexRagMessage(t('settings.customConnections.reindexError', { error: result?.error || 'Unknown error' }));
      }
    } catch (error) {
      console.error('Error reindexando RAG:', error);
      setReindexRagMessage(t('settings.customConnections.reindexError', { error: error.message || 'Unknown error' }));
    } finally {
      setIsReindexingRag(false);
      setTimeout(() => setReindexRagMessage(''), 5000);
    }
  };

  const handleUiLanguageChange = (lang) => {
    setSelectedUiLanguage(lang);
  };

  const handleThemeChange = (newTheme) => {
    setTheme(newTheme);
    applyTheme(newTheme);
  };

  const handleChangeDirectory = async () => {
    if (window.electronAPI && window.electronAPI.selectDirectory) {
      const path = await window.electronAPI.selectDirectory();
      if (path) {
        setOutputDirectory(path);
        setOutputDirectorySize(null);
        if (window.electronAPI?.getDirectorySize) {
          window.electronAPI.getDirectorySize(path).then(r => {
            if (r?.success) setOutputDirectorySize(r.gb);
          }).catch(() => {});
        }
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

  const toggleEmbeddingProvider = (provider) => {
    setEmbeddingProvider(provider);
  };

  const value = {
    // i18n
    t,

    // Tabs
    activeTab,
    setActiveTab,
    hasScrolledRef,

    // Generic UI state
    isLoading,
    isSaving,
    saveMessage,
    hasLoadedSettings,
    showApiKey,
    setShowApiKey,
    isCheckingModel,
    isDetectingLmCtx,

    // Transcription
    selectedLanguage, setSelectedLanguage,
    whisperModel, setWhisperModel,
    cpuThreads, setCpuThreads,
    maxCpuThreads,
    autoTranscribe, setAutoTranscribe,
    autoAnalyze, setAutoAnalyze,
    autoGenerateSchema, setAutoGenerateSchema,
    enableDiarization, setEnableDiarization,
    hfToken, setHfToken,
    speakerSimilarityThreshold, setSpeakerSimilarityThreshold,

    // Appearance
    selectedUiLanguage, setSelectedUiLanguage,
    fontSize, setFontSize,
    theme, setTheme,
    handleUiLanguageChange,
    handleThemeChange,

    // Projects
    projectHighlightsCount, setProjectHighlightsCount,

    // Audio
    selectedMicrophone, setSelectedMicrophone,
    microphones,

    // System
    notificationsEnabled, setNotificationsEnabled,

    // Permissions
    micStatus,
    handleRequestMicPermission,

    // About / updates
    appVersion,
    updateInfo, setUpdateInfo,
    checkingUpdate, setCheckingUpdate,
    updateMessage, setUpdateMessage,

    // Storage
    outputDirectory,
    outputDirectorySize,
    databasePath,
    dbMigrateModal, setDbMigrateModal,
    dbChangeError, setDbChangeError,
    handleChangeDirectory,
    handleChangeDatabasePath,
    handleConfirmDbChange,

    // Gemini
    loadGeminiModels,
    geminiApiKey, setGeminiApiKey,
    geminiModel, setGeminiModel,
    geminiModels,
    geminiModelsLoading,
    geminiModelsError,

    // DeepSeek
    deepseekApiKey, setDeepseekApiKey,
    deepseekModel, setDeepseekModel,
    deepseekModels,

    // Kimi
    kimiApiKey, setKimiApiKey,
    kimiModel, setKimiModel,
    kimiModels,

    // OpenAI
    openaiApiKey, setOpenaiApiKey,
    openaiModel, setOpenaiModel,
    openaiModels,
    openaiModelsLoading,
    openaiModelsError,
    loadOpenaiModels,

    // Provider selection
    aiProvider,
    setAiProvider,
    toggleProvider,
    toggleEmbeddingProvider,

    // Custom OpenAI-compatible connections
    customConnections,
    stagedDeletions,
    addCustomConnection,
    updateCustomConnection,
    stageDeleteCustomConnection,
    cancelDeleteCustomConnection,
    testCustomConnection,
    testingCustomConnectionId,
    customConnectionTestResults,
    customConnectionsSaveValidation: validateCustomConnectionsSaveState({
      aiProvider,
      embeddingProvider,
    }),
    embeddingProvider, setEmbeddingProvider,
    customGeneralModel, setCustomGeneralModel,
    embeddingModel, setEmbeddingModel,
    lastEmbeddingModelId,
    embeddingModelChanged,
    isReindexingRag,
    reindexRagMessage,
    handleReindexAllRag,

    // Ollama
    ollamaModel,
    ollamaRagModel, setOllamaRagModel,
    ollamaEmbeddingModel, setOllamaEmbeddingModel,
    ollamaModels,
    ollamaEmbeddingModels,
    ollamaAvailable,
    ollamaHost, setOllamaHost,
    ollamaModelSupportsStreaming,
    ollamaContextLengthSaved, setOllamaContextLengthSaved,
    ollamaCtxStatus, setOllamaCtxStatus,
    handleOllamaModelChange,
    handleDetectOllamaContextLength,
    checkOllamaConnection,

    // LM Studio
    lmStudioModel,
    lmStudioRagModel, setLmStudioRagModel,
    lmStudioEmbeddingModel, setLmStudioEmbeddingModel,
    lmStudioModels,
    lmStudioChatModels,
    lmStudioEmbeddingModels,
    lmStudioHost, setLmStudioHost,
    lmStudioAvailable,
    lmStudioContextLengthSaved, setLmStudioContextLengthSaved,
    lmStudioCtxStatus, setLmStudioCtxStatus,
    handleLmStudioModelChange,
    handleDetectLmStudioContextLength,
    checkLMStudioConnection,

    // Save
    handleSaveSettings,
  };

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}
