import React, { useState, useEffect } from 'react';
import { getSystemMicrophones } from '../../services/audioService';
import { getSettings, updateSettings, testNotification } from '../../services/settingsService';
import { getAvailableModels, checkOllamaAvailability } from '../../services/ollamaService';
import { 
  MdMic, MdClose, MdCloud, MdAutoAwesome, MdComputer, MdTerminal, 
  MdFolder, MdVisibility, MdVisibilityOff, MdRefresh, MdInfo, MdCheck,
  MdTextFormat, MdTranslate, MdNotifications
} from 'react-icons/md';
import styles from './Settings.module.css';

const mockLanguages = [
  { value: 'es', label: 'Español' },
  { value: 'en', label: 'English' },
  { value: 'fr', label: 'Français' },
];

const fontSizes = [
  { value: 'small', label: 'Small' },
  { value: 'medium', label: 'Medium' },
  { value: 'large', label: 'Large' },
  { value: 'xlarge', label: 'Extra Large' },
];

const whisperModels = [
  { value: 'tiny', label: 'Tiny (Fastest)' },
  { value: 'base', label: 'Base' },
  { value: 'small', label: 'Small (Recommended)' },
  { value: 'medium', label: 'Medium' },
  { value: 'large', label: 'Large (Precise)' },
];

export default function Settings({ onBack, onSettingsSaved }) {
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

  // AI Config
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [aiProvider, setAiProvider] = useState('gemini'); // 'gemini' | 'ollama'
  
  // Ollama
  const [ollamaModel, setOllamaModel] = useState('');
  const [ollamaModels, setOllamaModels] = useState([]);
  const [ollamaAvailable, setOllamaAvailable] = useState(false);
  const [ollamaHost, setOllamaHost] = useState('http://localhost:11434');

  // UI State
  const [showApiKey, setShowApiKey] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [hasLoadedSettings, setHasLoadedSettings] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

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
        setGeminiApiKey(savedSettings.geminiApiKey || '');
        setAiProvider(savedSettings.aiProvider || 'gemini');
        setOllamaModel(savedSettings.ollamaModel || '');
        if (savedSettings.ollamaHost) setOllamaHost(savedSettings.ollamaHost);
        if (savedSettings.outputDirectory) setOutputDirectory(savedSettings.outputDirectory);
      }
      
      // Check Ollama with loaded/default host
      checkOllamaConnection(savedSettings?.ollamaHost || ollamaHost);
      
      setHasLoadedSettings(true);
    } catch (error) {
      console.error('Error loading settings:', error);
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
        console.error("Error fetching ollama models", err);
      }
    } else {
      setOllamaModels([]);
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
        geminiApiKey: geminiApiKey,
        aiProvider: aiProvider,
        ollamaModel: ollamaModel,
        ollamaHost: ollamaHost,
        outputDirectory: outputDirectory
      });
      setSaveMessage('Changes saved successfully');
      if (onSettingsSaved) onSettingsSaved();
      setTimeout(() => setSaveMessage(''), 3000);
    } catch (error) {
      console.error('Error saving settings:', error);
      setSaveMessage('Error saving settings');
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
      alert('Directory selection not supported in this environment');
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
          <h1 className={styles.headerTitle}>AIRecorder Settings</h1>
        </div>
        <button onClick={onBack} className={styles.closeButton}>
          <MdClose size={20} />
        </button>
      </header>

      <div className={styles.content}>
        <div className={styles.maxWidthContainer}>
          
          <div className={styles.pageHeader}>
            <h2 className={styles.pageTitle}>AI Configuration</h2>
            <p className={styles.pageDescription}>Manage your cloud transcription engines and local LLMs for processing recordings.</p>
          </div>

          {/* --- System Section --- */}
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <div className={styles.sectionTitleGroup}>
                <MdNotifications className={styles.sectionIcon} size={20} />
                <h3 className={styles.sectionTitle}>System Preferences</h3>
              </div>
            </div>
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <div className={styles.providerInfo}>
                  <div className={`${styles.providerIcon}`} style={{backgroundColor: '#e0f2fe', color: '#0ea5e9'}}>
                    <MdNotifications size={24} />
                  </div>
                  <div>
                    <h4 className={styles.providerName}>Desktop Notifications</h4>
                    <p className={styles.providerDesc}>Show native notifications when tasks complete</p>
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

          {/* --- Cloud Provider Section --- */}
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <div className={styles.sectionTitleGroup}>
                <MdCloud className={styles.sectionIcon} size={20} />
                <h3 className={styles.sectionTitle}>Cloud Provider</h3>
              </div>
              <span className={`${styles.badge} ${aiProvider === 'gemini' ? styles.badgeActive : styles.badgeInactive}`}>
                {aiProvider === 'gemini' ? 'Active' : 'Inactive'}
              </span>
            </div>

            <div className={`${styles.card} ${aiProvider !== 'gemini' ? styles.cardDisabled : ''}`}>
              <div className={styles.cardHeader}>
                <div className={styles.providerInfo}>
                  <div className={`${styles.providerIcon} ${styles.geminiIcon}`}>
                    <MdAutoAwesome size={24} />
                  </div>
                  <div>
                    <h4 className={styles.providerName}>Gemini Pro</h4>
                    <p className={styles.providerDesc}>Google AI</p>
                  </div>
                </div>
                {/* Wrapped in label for better click area */}
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

              {/* Gemini Form */}
              <div className={styles.formGroup}>
                <label className={styles.label}>API Key</label>
                <div className={styles.inputWrapper}>
                  <input 
                    type={showApiKey ? "text" : "password"} 
                    className={styles.input}
                    placeholder="Paste your API key here"
                    value={geminiApiKey}
                    onChange={(e) => setGeminiApiKey(e.target.value)}
                    disabled={aiProvider !== 'gemini'}
                  />
                  <button 
                    className={styles.inputIcon}
                    onClick={() => setShowApiKey(!showApiKey)}
                  >
                    {showApiKey ? <MdVisibilityOff /> : <MdVisibility />}
                  </button>
                </div>
                <p className={styles.helpText}>
                  <MdInfo size={14} />
                  Keys are stored securely in your system keychain.
                </p>
              </div>
            </div>
          </section>

          {/* --- Local Provider Section --- */}
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <div className={styles.sectionTitleGroup}>
                <MdComputer className={styles.sectionIcon} size={20} />
                <h3 className={styles.sectionTitle}>Local Provider</h3>
              </div>
              <span className={`${styles.badge} ${aiProvider === 'ollama' ? styles.badgeActive : styles.badgeInactive}`}>
                {aiProvider === 'ollama' ? 'Active' : 'Inactive'}
              </span>
            </div>

            <div className={`${styles.card} ${aiProvider !== 'ollama' ? styles.cardDisabled : ''}`}>
              <div className={styles.cardHeader}>
                <div className={styles.providerInfo}>
                  <div className={`${styles.providerIcon} ${styles.ollamaIcon}`}>
                    <MdTerminal size={24} />
                  </div>
                  <div>
                    <h4 className={styles.providerName}>Ollama</h4>
                    <p className={styles.providerDesc}>Local Inference</p>
                  </div>
                </div>
                {/* Wrapped in label */}
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

              {/* Ollama Form */}
              <div className={styles.formGroup}>
                <label className={styles.label}>Host URL</label>
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
                    Check
                  </button>
                </div>
                {!ollamaAvailable ? (
                  <p className={styles.errorText}>
                    • Service not detected at {ollamaHost}
                  </p>
                ) : (
                  <p className={styles.helpText} style={{ color: '#059669' }}>
                    • Service connected
                  </p>
                )}
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Model</label>
                <select 
                  className={styles.input}
                  value={ollamaModel}
                  onChange={(e) => setOllamaModel(e.target.value)}
                  disabled={aiProvider !== 'ollama' || !ollamaAvailable}
                >
                  <option value="" disabled>Select a model</option>
                  {ollamaModels.map(model => (
                    <option key={model.name} value={model.name}>{model.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          {/* --- Storage Section --- */}
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <div className={styles.sectionTitleGroup}>
                <MdFolder className={styles.sectionIcon} size={20} />
                <h3 className={styles.sectionTitle}>Recording Storage</h3>
              </div>
            </div>
            <div className={styles.card}>
              <label className={styles.label}>Output Directory</label>
              <div className={styles.inputRow}>
                <div className={`${styles.input} truncate bg-gray-50 text-gray-500`} title={outputDirectory}>
                  {outputDirectory || "Default"}
                </div>
                <button 
                  className={styles.checkBtn}
                  onClick={handleChangeDirectory}
                >
                  Change
                </button>
              </div>
            </div>
          </section>

          {/* --- Transcription Section --- */}
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <div className={styles.sectionTitleGroup}>
                <MdTranslate className={styles.sectionIcon} size={20} />
                <h3 className={styles.sectionTitle}>Transcription Engine</h3>
              </div>
            </div>
            <div className={styles.card}>
              <div className={styles.formGroup}>
                <label className={styles.label}>Language</label>
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
                  Language used for Whisper transcription.
                </p>
              </div>

              <div className={styles.formGroup} style={{ marginBottom: 0 }}>
                <label className={styles.label}>Whisper Model Size</label>
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
                  Choose the default model for new transcriptions. Smaller models are faster but less precise.
                </p>
              </div>
            </div>
          </section>

          {/* --- Appearance Section --- */}
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <div className={styles.sectionTitleGroup}>
                <MdTextFormat className={styles.sectionIcon} size={20} />
                <h3 className={styles.sectionTitle}>Interface Appearance</h3>
              </div>
            </div>
            <div className={styles.card}>
              <div className={styles.formGroup} style={{ marginBottom: 0 }}>
                <label className={styles.label}>Text Size</label>
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
                  Adjust the font size for chats, transcriptions, and summaries.
                </p>
              </div>
            </div>
          </section>

          {/* --- Audio Section --- */}
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <div className={styles.sectionTitleGroup}>
                <MdMic className={styles.sectionIcon} size={20} />
                <h3 className={styles.sectionTitle}>Audio Settings</h3>
              </div>
            </div>
            <div className={styles.card}>
              <div className={styles.formGroup} style={{ marginBottom: 0 }}>
                <label className={styles.label}>Default Microphone</label>
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
                  Select the input device for your recordings.
                </p>
              </div>
            </div>
          </section>

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
            Reset to Defaults
          </button>
          <button 
            className={styles.btnPrimary} 
            onClick={handleSaveSettings}
            disabled={isSaving}
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </footer>
    </div>
  );
}
