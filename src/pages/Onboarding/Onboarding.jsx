import React, { useState, useEffect } from 'react';
import styles from './Onboarding.module.css';
import { FaMicrophone, FaCheckCircle, FaExclamationTriangle, FaRobot, FaServer, FaArrowRight, FaArrowLeft, FaWaveSquare, FaBrain, FaFolder, FaMagic, FaVolumeUp, FaBell, FaCheck } from 'react-icons/fa';
import { getAvailableModels, checkOllamaAvailability } from '../../services/ollamaService';
import { updateSettings } from '../../services/settingsService';
import PermissionsStep from './PermissionsStep';
import ReadyStep from './ReadyStep';
import AiConfigStep from './AiConfigStep';

const STEPS = [
  { id: 'welcome', title: 'Welcome to AIRecorder' },
  { id: 'ai', title: 'Configuración de IA' },
  { id: 'permissions', title: 'Permisos del Sistema' },
  { id: 'finish', title: 'Todo listo' }
];

export default function Onboarding({ onComplete }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [micStatus, setMicStatus] = useState('unknown'); 
  const [systemAudioStatus, setSystemAudioStatus] = useState('unknown'); // Mock state for now
  const [notificationStatus, setNotificationStatus] = useState('unknown');
  
  // AI Settings State
  const [aiProvider, setAiProvider] = useState('ollama'); 
  const [geminiKey, setGeminiKey] = useState('');
  const [ollamaHost, setOllamaHost] = useState('http://localhost:11434');
  const [ollamaModels, setOllamaModels] = useState([]);
  const [selectedOllamaModel, setSelectedOllamaModel] = useState('');
  const [ollamaStatus, setOllamaStatus] = useState('idle');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    checkPermissions();
  }, []);

  const checkPermissions = async () => {
    // Check Mic
    if (window.electronAPI?.getMicrophonePermission) {
      const status = await window.electronAPI.getMicrophonePermission();
      setMicStatus(status);
    } else {
      setMicStatus('granted');
    }

    // Check Notifications (Web API)
    if ("Notification" in window) {
      if (Notification.permission === 'granted') {
        setNotificationStatus('granted');
      } else if (Notification.permission === 'denied') {
        setNotificationStatus('denied');
      } else {
        setNotificationStatus('unknown'); // 'default'
      }
    }
  };

  const requestPermission = async () => {
    if (window.electronAPI?.requestMicrophonePermission) {
      const status = await window.electronAPI.requestMicrophonePermission();
      setMicStatus(status);
    }
  };

  const requestSystemAudio = async () => {
    // There is no direct "request permission" API for system audio that doesn't involve starting a stream.
    // However, on macOS, trying to list sources might trigger it or we can just guide them.
    // For this UI, we'll pretend we checked it or trigger a dummy getSources.
    if (window.electronAPI?.getDesktopSources) {
       try {
         await window.electronAPI.getDesktopSources();
         // If successful, we likely have permission or it will prompt.
         setSystemAudioStatus('granted');
       } catch (e) {
         console.error("System audio check failed", e);
       }
    } else {
        setSystemAudioStatus('granted'); // Dev fallback
    }
  };

  const toggleNotifications = async () => {
    if (notificationStatus === 'granted') {
        // Can't really revoke in web, but we can simulate state for the UI
        // Actually, let's just leave it as is if granted.
    } else {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            setNotificationStatus('granted');
        } else {
            setNotificationStatus('denied');
        }
    }
  };

  const checkOllama = async () => {
    setOllamaStatus('checking');
    try {
      const isAvailable = await checkOllamaAvailability(ollamaHost);
      if (isAvailable) {
        const models = await getAvailableModels(ollamaHost);
        setOllamaModels(models.map(m => m.name || m));
        if (models.length > 0 && !selectedOllamaModel) {
          setSelectedOllamaModel(models[0].name || models[0]);
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
        geminiApiKey: geminiKey,
        ollamaHost: ollamaHost,
        ollamaModel: selectedOllamaModel
      };
      
      await updateSettings(settingsToSave);
      if (onComplete) onComplete();
    } catch (error) {
      console.error("Error saving settings:", error);
      setIsSaving(false);
    }
  };

  // --- RENDER FUNCTIONS ---

  // New Split Layout for Step 0 (Welcome)
  const renderWelcomeSplit = () => {
    return (
      <div className={styles.splitLayout}>
        {/* Left Panel: Graphics */}
        <div className={styles.leftPanel}>
          <div className={styles.graphicContainer}>
            <div className={`${styles.circle} ${styles.outerCircle2}`}></div>
            <div className={`${styles.circle} ${styles.outerCircle1}`}></div>
            <div className={`${styles.circle} ${styles.mainCircle}`}>
              <FaMicrophone className={styles.mainIcon} />
            </div>
            
            {/* Floating Badges */}
            <div className={`${styles.floatingBadge} ${styles.badgeTop}`}>
              <FaWaveSquare size={16} />
            </div>
            <div className={`${styles.floatingBadge} ${styles.badgeRight}`}>
              <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#f87171', border: '2px solid white' }}></div>
            </div>
            <div className={`${styles.floatingBadge} ${styles.badgeBottom}`}>
              <FaMagic size={16} />
            </div>
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
          {/* Header & Progress */}
          <div className={styles.topNav}>
            <span className={styles.stepText}>Step 1 of 3</span>
            <div className={styles.progressBar}>
              <div className={`${styles.progressDot} ${styles.active}`}></div>
              <div className={styles.progressDot}></div>
              <div className={styles.progressDot}></div>
            </div>
          </div>

          {/* Main Content */}
          <div className={styles.contentArea}>
            <h1 className={styles.mainTitle}>
              Welcome to <span className={styles.highlight}>AIRecorder</span>
            </h1>
            <p className={styles.description}>
              Your intelligent companion for recording, transcribing, and managing audio projects. 
              Let's get you set up for perfect clarity.
            </p>

            <div className={styles.sectionLabel}>WHAT TO EXPECT</div>

            <div className={styles.expectList}>
              <div className={styles.expectItem}>
                <div className={styles.iconCircle}>
                  <FaMicrophone />
                </div>
                <div className={styles.itemContent}>
                  <h3>Microphone Setup</h3>
                  <p>We'll test your input device for optimal recording quality.</p>
                </div>
              </div>

              <div className={styles.expectItem}>
                <div className={styles.iconCircle}>
                  <FaBrain />
                </div>
                <div className={styles.itemContent}>
                  <h3>AI Customization</h3>
                  <p>Tailor the transcription engine to recognize your voice patterns.</p>
                </div>
              </div>

              <div className={styles.expectItem}>
                <div className={styles.iconCircle}>
                  <FaFolder />
                </div>
                <div className={styles.itemContent}>
                  <h3>Workspace Organization</h3>
                  <p>Setup where your projects and transcripts will live.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className={styles.footerArea}>
            <p className={styles.termsText}>
              By continuing, you agree to our <a href="#" className={styles.link}>Terms of Service</a> & <a href="#" className={styles.link}>Privacy Policy</a>.
            </p>
            <button className={styles.setupButton} onClick={handleNext}>
              Begin Setup
              <FaArrowRight />
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Reusable Step Progress Component
  const renderStepProgress = () => (
    <div className={styles.stepProgressContainer}>
      <div className={styles.stepProgressGrid}>
        {STEPS.map((step, index) => {
          const isActive = index === currentStep;
          const isCompleted = index < currentStep;
          const labels = ["Welcome", "AI Config", "Permissions", "Ready"];
          const label = labels[index] || step.title;

          return (
            <div key={step.id} className={styles.stepColumn}>
              <div className={`${styles.stepBar} ${isCompleted ? styles.completed : ''} ${isActive ? styles.active : ''}`}></div>
              <div className={`${styles.stepLabel} ${isActive || isCompleted ? styles.active : ''}`}>
                {label}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  // Original Card Layout for Steps 1, 2, 3 (Now using Permissions specific structure too)
  const renderCardLayout = (content, footerOverride = null) => (
    <div className={styles.cardLayout}>
      <div className={styles.card}>
        {/* We generally don't use this wrapper for the new designs, creating specific containers instead */}
        {content}
      </div>
    </div>
  );


  // Main Render Switch
  if (currentStep === 0) return renderWelcomeSplit();
  if (currentStep === 1) return (
    <AiConfigStep 
      aiProvider={aiProvider}
      setAiProvider={setAiProvider}
      ollamaHost={ollamaHost}
      setOllamaHost={setOllamaHost}
      checkOllama={checkOllama}
      ollamaStatus={ollamaStatus}
      ollamaModels={ollamaModels}
      selectedOllamaModel={selectedOllamaModel}
      setSelectedOllamaModel={setSelectedOllamaModel}
      geminiKey={geminiKey}
      setGeminiKey={setGeminiKey}
      onBack={handleBack}
      onNext={handleNext}
      StepProgressComponent={renderStepProgress()}
    />
  );
  if (currentStep === 2) return (
    <PermissionsStep 
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
  );
  if (currentStep === 3) return (
    <ReadyStep 
      aiProvider={aiProvider}
      modelName={aiProvider === 'gemini' ? 'Gemini Pro' : selectedOllamaModel}
      onComplete={saveAndClose}
      StepProgressComponent={renderStepProgress()}
    />
  );

  // Fallback (should not be reached normally if steps align)
  return renderCardLayout(null);
}
