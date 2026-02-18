import React, { useState, useEffect, useRef } from 'react';
import { getSystemMicrophones } from '../../services/audioService';
import { getSettings, updateSettings } from '../../services/settingsService';
import { getAvailableModels, checkOllamaAvailability, checkModelSupportsStreaming } from '../../services/ai/ollamaProvider';
import { getGeminiAvailableModels } from '../../services/ai/geminiProvider';
import { getDeepseekAvailableModels, getKimiAvailableModels, getLMStudioModels } from '../../services/ai/providerRouter';
import { checkLMStudioAvailability } from '../../services/ai/lmStudioProvider';
import { 
  MdMic, MdClose, MdCloud, MdAutoAwesome, MdComputer, MdTerminal, 
  MdFolder, MdVisibility, MdVisibilityOff, MdRefresh, MdInfo, MdCheck,
  MdTextFormat, MdTranslate, MdNotifications, MdSmartToy, MdSettings
} from 'react-icons/md';
import styles from './Settings.module.css';

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
  // State
  const [selectedLanguage, setSelectedLanguage] = useState('en');
  const [selectedMicrophone, setSelectedMicrophone] = useState('');
  const [fontSize, setFontSize] = useState('medium');
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [whisperModel, setWhisperModel] = useState('small');
  const [microphones, setMicrophones] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Storage
  const [outputDirectory, setOutputDirectory] = useState('');

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
  const [ollamaModels, setOllamaModels] = useState([]);
  const [ollamaAvailable, setOllamaAvailable] = useState(false);
  const [ollamaHost, setOllamaHost] = useState('http://localhost:11434');
  const [ollamaModelSupportsStreaming, setOllamaModelSupportsStreaming] = useState(false);
  const [isCheckingModel, setIsCheckingModel] = useState(false);

  // LM Studio
  const [lmStudioModel, setLmStudioModel] = useState('');
  const [lmStudioModels, setLmStudioModels] = useState([]);
  const [lmStudioHost, setLmStudioHost] = useState('http://localhost:1234/v1');
  const [lmStudioAvailable, setLmStudioAvailable] = useState(false);

  // UI State
  const [activeTab, setActiveTab] = useState(initialTab); // 'general' | 'agents'
  const [showApiKey, setShowApiKey] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [hasLoadedSettings, setHasLoadedSettings] = useState(false);
  const hasScrolledRef = useRef(false);

  useEffect(() => {
    loadSettings();
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
      
      // Load settings
      const savedSettings = await getSettings();
      
      if (savedSettings) {
        setSelectedLanguage(savedSettings.language || 'en');
        setSelectedMicrophone(savedSettings.microphone || (systemMicrophones.length > 0 ? systemMicrophones[0].value : ''));
        setFontSize(savedSettings.fontSize || 'medium');
        setNotificationsEnabled(savedSettings.notificationsEnabled !== false); // Default true
        setWhisperModel(savedSettings.whisperModel || 'small');
        
        // Gemini Free
        setGeminiFreeApiKey(savedSettings.geminiFreeApiKey || '');
        setGeminiFreeModel(savedSettings.geminiFreeModel || 'gemini-2.0-flash');
        
        // Gemini Pro
        setGeminiApiKey(savedSettings.geminiApiKey || '');
        setGeminiModel(savedSettings.geminiModel || 'gemini-2.0-flash');
        
        // DeepSeek
        setDeepseekApiKey(savedSettings.deepseekApiKey || '');
        setDeepseekModel(savedSettings.deepseekModel || 'deepseek-chat');
        
        // Kimi
        setKimiApiKey(savedSettings.kimiApiKey || '');
        setKimiModel(savedSettings.kimiModel || 'kimi-k2');
        
        // LM Studio
        setLmStudioHost(savedSettings.lmStudioHost || 'http://localhost:1234/v1');
        setLmStudioModel(savedSettings.lmStudioModel || '');
        
        setAiProvider(savedSettings.aiProvider || 'ollama');
        setOllamaModel(savedSettings.ollamaModel || '');
        setOllamaModelSupportsStreaming(savedSettings.ollamaModelSupportsStreaming || false);
        if (savedSettings.ollamaHost) setOllamaHost(savedSettings.ollamaHost);
        if (savedSettings.outputDirectory) setOutputDirectory(savedSettings.outputDirectory);
      }
      
      // Check Ollama with loaded/default host
      checkOllamaConnection(savedSettings?.ollamaHost || ollamaHost);
      
      // Check LM Studio
      checkLMStudioConnection(savedSettings?.lmStudioHost || lmStudioHost);
      
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

  const checkOllamaConnection = async (hostToCheck) => {
    const host = hostToCheck || ollamaHost;
    const isAvailable = await checkOllamaAvailability(host);
    setOllamaAvailable(isAvailable);
    if (isAvailable) {
      try {
        const models = await getAvailableModels(host);
        setOllamaModels(models);
        // Default model selection logic
        if (!ollamaModel && models.length > 0) {
          setOllamaModel(models[0].name);
        }
      } catch (err) {
        console.error("Error obteniendo modelos de ollama", err);
      }
    } else {
      setOllamaModels([]);
    }
  };

  const checkLMStudioConnection = async (hostToCheck) => {
    const host = hostToCheck || lmStudioHost;
    const isAvailable = await checkLMStudioAvailability(host);
    setLmStudioAvailable(isAvailable);
    if (isAvailable) {
      try {
        const models = await getLMStudioModels(host);
        setLmStudioModels(models);
        if (!lmStudioModel && models.length > 0) {
          setLmStudioModel(models[0].name);
        }
      } catch (err) {
        console.error("Error fetching LM Studio models", err);
      }
    } else {
      setLmStudioModels([]);
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
      try {
        console.log(`🔍 Verificando modelo ${newModel}...`);
        const supportsStreaming = await checkModelSupportsStreaming(newModel, ollamaHost);
        setOllamaModelSupportsStreaming(supportsStreaming);
        console.log(`📝 Modelo ${newModel} - Streaming: ${supportsStreaming ? 'SÍ' : 'NO'}`);
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

  const handleSaveSettings = async () => {
    setIsSaving(true);
    setSaveMessage('');
    
    try {
      await updateSettings({
        language: selectedLanguage,
        microphone: selectedMicrophone,
        notificationsEnabled: notificationsEnabled,
        fontSize: fontSize,
        whisperModel: whisperModel,
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
        // Ollama
        aiProvider: aiProvider,
        ollamaModel: ollamaModel,
        ollamaHost: ollamaHost,
        ollamaModelSupportsStreaming: ollamaModelSupportsStreaming,
        outputDirectory: outputDirectory
      });
      setSaveMessage('Ajustes guardados con éxito');
      if (onSettingsSaved) onSettingsSaved();
      setTimeout(() => setSaveMessage(''), 3000);
    } catch (error) {
      console.error('Error guardando ajustes:', error);
      setSaveMessage('Error al guardar ajustes');
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangeDirectory = async () => {
    if (window.electronAPI && window.electronAPI.selectDirectory) {
      const path = await window.electronAPI.selectDirectory();
      if (path) {
        setOutputDirectory(path);
      }
    } else {
      alert('La selección de directorio no está soportada en este entorno');
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
          <h1 className={styles.headerTitle}>Ajustes de AIRecorder</h1>
        </div>
        <button onClick={onBack} className={styles.closeButton}>
          <MdClose size={20} />
        </button>
      </header>

      <div className={styles.content}>
        <div className={styles.maxWidthContainer}>
          
          <div className={styles.pageHeader}>
            <h2 className={styles.pageTitle}>Configuración</h2>
            <p className={styles.pageDescription}>Gestiona tus preferencias de aplicación y configuraciones de IA.</p>
          </div>

          <div className={styles.tabsContainer}>
            <button 
              className={`${styles.tab} ${activeTab === 'agents' ? styles.tabActive : ''}`}
              onClick={() => setActiveTab('agents')}
            >
              <MdSmartToy className={styles.tabIcon} />
              Agentes de IA
            </button>
            <button 
              className={`${styles.tab} ${activeTab === 'general' ? styles.tabActive : ''}`}
              onClick={() => setActiveTab('general')}
            >
              <MdSettings className={styles.tabIcon} />
              General
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
                    <h3 className={styles.sectionTitle}>Proveedores Locales</h3>
                  </div>
                  <span className={`${styles.badge} ${['ollama', 'lmstudio'].includes(aiProvider) ? styles.badgeActive : styles.badgeInactive}`}>
                    {aiProvider === 'ollama' ? 'Ollama Activo' : 
                     aiProvider === 'lmstudio' ? 'LM Studio Activo' : 'Inactivo'}
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
                        <h4 className={styles.providerName}>Ollama</h4>
                        <p className={styles.providerDesc}>Inferencia Local</p>
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
                    <label className={styles.label}>URL del Host</label>
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
                        Probar
                      </button>
                    </div>
                    {!ollamaAvailable ? (
                      <p className={styles.errorText}>
                        • Servicio no detectado en {ollamaHost}
                      </p>
                    ) : (
                      <p className={styles.helpText} style={{ color: '#059669' }}>
                        • Servicio conectado
                      </p>
                    )}
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.label}>Modelo</label>
                    <select
                      className={styles.input}
                      value={ollamaModel}
                      onChange={(e) => handleOllamaModelChange(e.target.value)}
                      disabled={aiProvider !== 'ollama' || !ollamaAvailable || isCheckingModel}
                    >
                      <option value="" disabled>Selecciona un modelo</option>
                      {ollamaModels.map(model => (
                        <option key={model.name} value={model.name}>{model.name}</option>
                      ))}
                    </select>
                    {isCheckingModel && (
                      <p className={styles.helpText} style={{ color: '#0ea5e9', display: 'flex', alignItems: 'center' }}>
                        <MdRefresh className={styles.spinner} style={{ marginRight: '4px' }} />
                        Verificando modelo...
                      </p>
                    )}
                    {ollamaModel && !isCheckingModel && (
                      <p className={styles.helpText} style={{ color: ollamaModelSupportsStreaming ? '#059669' : '#dc2626' }}>
                        {ollamaModelSupportsStreaming ? '✓ Soporta streaming' : '✗ No soporta streaming'}
                      </p>
                    )}
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
                        <h4 className={styles.providerName}>LM Studio</h4>
                        <p className={styles.providerDesc}>Servidor Local (Compatible con OpenAI)</p>
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
                    <label className={styles.label}>URL Base</label>
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
                        Probar
                      </button>
                    </div>
                    {!lmStudioAvailable ? (
                      <p className={styles.errorText}>
                        • Servicio no detectado en {lmStudioHost}
                      </p>
                    ) : (
                      <p className={styles.helpText} style={{ color: '#059669' }}>
                        • Servicio conectado
                      </p>
                    )}
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.label}>Modelo Cargado</label>
                    <select
                      className={styles.input}
                      value={lmStudioModel}
                      onChange={(e) => setLmStudioModel(e.target.value)}
                      disabled={aiProvider !== 'lmstudio' || !lmStudioAvailable}
                    >
                      <option value="" disabled>Selecciona un modelo</option>
                      {lmStudioModels.map(model => (
                        <option key={model.name} value={model.name}>{model.name}</option>
                      ))}
                    </select>
                    {lmStudioAvailable && lmStudioModels.length === 0 && (
                      <p className={styles.helpText} style={{ color: '#dc2626' }}>
                        • No se encontraron modelos. Asegúrate de tener uno cargado en LM Studio.
                      </p>
                    )}
                  </div>
                </div>
              </section>

              {/* --- Cloud Providers Section --- */}
              <section className={styles.section}>
                <div className={styles.sectionHeader}>
                  <div className={styles.sectionTitleGroup}>
                    <MdCloud className={styles.sectionIcon} size={20} />
                    <h3 className={styles.sectionTitle}>Proveedores en la Nube</h3>
                  </div>
                  <span className={`${styles.badge} ${['geminifree', 'gemini', 'deepseek', 'kimi'].includes(aiProvider) ? styles.badgeActive : styles.badgeInactive}`}>
                    {aiProvider === 'geminifree' ? 'Gemini Free' : 
                     aiProvider === 'gemini' ? 'Gemini Pro' :
                     aiProvider === 'deepseek' ? 'DeepSeek' :
                     aiProvider === 'kimi' ? 'Kimi' : 'Inactivo'}
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
                        <p className={styles.providerDesc}>Google AI - Nivel Gratuito</p>
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
                    <label className={styles.label}>API Key</label>
                    <div className={styles.inputWrapper}>
                      <input 
                        type={showApiKey ? "text" : "password"} 
                        className={styles.input}
                        placeholder="Pega tu Gemini Free API key"
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
                    <label className={styles.label}>Modelo</label>
                    <div className={styles.inputRow}>
                      <select
                        className={styles.input}
                        value={geminiFreeModel}
                        onChange={(e) => setGeminiFreeModel(e.target.value)}
                        disabled={aiProvider !== 'geminifree' || geminiFreeModelsLoading || geminiFreeModels.length === 0}
                      >
                        {geminiFreeModels.length === 0 ? (
                          <option value="" disabled>
                            {geminiFreeApiKey ? (geminiFreeModelsLoading ? 'Cargando...' : 'Sin modelos') : 'Introduce API Key'}
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
                        Refrescar
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
                        <p className={styles.providerDesc}>Google AI - Nivel de Pago</p>
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
                    <label className={styles.label}>API Key</label>
                    <div className={styles.inputWrapper}>
                      <input 
                        type={showApiKey ? "text" : "password"} 
                        className={styles.input}
                        placeholder="Pega tu Gemini Pro API key"
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
                    <label className={styles.label}>Modelo</label>
                    <div className={styles.inputRow}>
                      <select
                        className={styles.input}
                        value={geminiModel}
                        onChange={(e) => setGeminiModel(e.target.value)}
                        disabled={aiProvider !== 'gemini' || geminiModelsLoading || geminiModels.length === 0}
                      >
                        {geminiModels.length === 0 ? (
                          <option value="" disabled>
                            {geminiApiKey ? (geminiModelsLoading ? 'Cargando...' : 'Sin modelos') : 'Introduce API Key'}
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
                        Refrescar
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
                    <label className={styles.label}>API Key</label>
                    <div className={styles.inputWrapper}>
                      <input 
                        type={showApiKey ? "text" : "password"} 
                        className={styles.input}
                        placeholder="Pega tu DeepSeek API key"
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
                    <label className={styles.label}>Modelo</label>
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
                    <label className={styles.label}>API Key</label>
                    <div className={styles.inputWrapper}>
                      <input 
                        type={showApiKey ? "text" : "password"} 
                        className={styles.input}
                        placeholder="Pega tu Kimi API key"
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
                    <label className={styles.label}>Modelo</label>
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
                    <h3 className={styles.sectionTitle}>Almacenamiento</h3>
                  </div>
                </div>
                <div className={styles.card}>
                  <label className={styles.label}>Directorio de Salida</label>
                  <div className={styles.inputRow}>
                    <div className={`${styles.input} truncate bg-gray-50 text-gray-500`} title={outputDirectory}>
                      {outputDirectory || "Por defecto"}
                    </div>
                    <button 
                      className={styles.checkBtn}
                      onClick={handleChangeDirectory}
                    >
                      Cambiar
                    </button>
                  </div>
                </div>
              </section>

              {/* --- Transcription Section --- */}
              <section className={styles.section}>
                <div className={styles.sectionHeader}>
                  <div className={styles.sectionTitleGroup}>
                    <MdTranslate className={styles.sectionIcon} size={20} />
                    <h3 className={styles.sectionTitle}>Motor de Transcripción</h3>
                  </div>
                </div>
                <div className={styles.card}>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>Idioma</label>
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
                      Idioma utilizado para la transcripción con Whisper.
                    </p>
                  </div>

                  <div className={styles.formGroup} style={{ marginBottom: 0 }}>
                    <label className={styles.label}>Tamaño del Modelo Whisper</label>
                    <select 
                      className={styles.input}
                      value={whisperModel}
                      onChange={(e) => setWhisperModel(e.target.value)}
                    >
                      {whisperModels.map(model => (
                        <option key={model.value} value={model.value}>{model.label}</option>
                      ))}
                    </select>
                    <p className={styles.helpText}>
                      Elige el modelo por defecto para nuevas transcripciones. Los modelos pequeños son más rápidos pero menos precisos.
                    </p>
                  </div>
                </div>
              </section>

              {/* --- Appearance Section --- */}
              <section className={styles.section}>
                <div className={styles.sectionHeader}>
                  <div className={styles.sectionTitleGroup}>
                    <MdTextFormat className={styles.sectionIcon} size={20} />
                    <h3 className={styles.sectionTitle}>Apariencia de la Interfaz</h3>
                  </div>
                </div>
                <div className={styles.card}>
                  <div className={styles.formGroup} style={{ marginBottom: 0 }}>
                    <label className={styles.label}>Tamaño de Fuente</label>
                    <select 
                      className={styles.input}
                      value={fontSize}
                      onChange={(e) => setFontSize(e.target.value)}
                    >
                      {fontSizes.map(size => (
                        <option key={size.value} value={size.value}>{size.label}</option>
                      ))}
                    </select>
                    <p className={styles.helpText}>
                      Ajusta el tamaño de letra para los chats, transcripciones y resúmenes.
                    </p>
                  </div>
                </div>
              </section>

              {/* --- Audio Section --- */}
              <section className={styles.section} id="microphone-settings">
                <div className={styles.sectionHeader}>
                  <div className={styles.sectionTitleGroup}>
                    <MdMic className={styles.sectionIcon} size={20} />
                    <h3 className={styles.sectionTitle}>Ajustes de Audio</h3>
                  </div>
                </div>
                <div className={styles.card}>
                  <div className={styles.formGroup} style={{ marginBottom: 0 }}>
                    <label className={styles.label}>Micrófono por Defecto</label>
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
                      Selecciona el dispositivo de entrada para tus grabaciones.
                    </p>
                  </div>
                </div>
              </section>

              {/* --- System Section --- */}
              <section className={styles.section}>
                <div className={styles.sectionHeader}>
                  <div className={styles.sectionTitleGroup}>
                    <MdNotifications className={styles.sectionIcon} size={20} />
                    <h3 className={styles.sectionTitle}>Preferencias del Sistema</h3>
                  </div>
                </div>
                <div className={styles.card}>
                  <div className={styles.cardHeader}>
                    <div className={styles.providerInfo}>
                      <div className={`${styles.providerIcon}`} style={{backgroundColor: '#e0f2fe', color: '#0ea5e9'}}>
                        <MdNotifications size={24} />
                      </div>
                      <div>
                        <h4 className={styles.providerName}>Notificaciones de Escritorio</h4>
                        <p className={styles.providerDesc}>Mostrar notificaciones nativas al completar tareas</p>
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
          <button className={styles.btnSecondary} onClick={() => {}}>
            Restaurar valores
          </button>
          <button
            className={styles.btnPrimary}
            onClick={handleSaveSettings}
            disabled={isSaving || isCheckingModel}
          >
            {isCheckingModel ? 'Verificando...' : (isSaving ? 'Guardando...' : 'Guardar Cambios')}
          </button>
        </div>
      </footer>
    </div>
  );
}
