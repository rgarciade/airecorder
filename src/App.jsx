import React, { useState, useEffect } from 'react'
import { useSelector } from 'react-redux'
import i18n from './i18n/index.js'
import Home from './pages/Home/Home'
import RecordingDetailWithTranscription from './pages/RecordingDetail/RecordingDetailWithTranscription';
import Settings from './pages/Settings/Settings'
import Projects from './pages/Projects/Projects'
import ProjectDetail from './pages/ProjectDetail/ProjectDetail'
import TranscriptionQueue from './pages/TranscriptionQueue/TranscriptionQueue'
import AiQueue from './pages/AiQueue/AiQueue'
import RecordingOverlay from './components/RecordingOverlay/RecordingOverlay'
import Sidebar from './components/Sidebar/Sidebar';
import Onboarding from './pages/Onboarding/Onboarding';
import { getSettings, updateSettings } from './services/settingsService';
import styles from './App.module.css'
import './App.css'

export default function App() {
  const [currentView, setCurrentView] = useState('loading') // Cambiado inicial a loading
  const [selectedRecording, setSelectedRecording] = useState(null)
  const [selectedProjectId, setSelectedProjectId] = useState(null)
  const [selectedProject, setSelectedProject] = useState(null)
  const [currentRecorder, setCurrentRecorder] = useState(null)
  const [refreshTrigger, setRefreshTrigger] = useState(0) // Trigger para refrescar Home
  const [appSettings, setAppSettings] = useState(null)
  const [queueCount, setQueueCount] = useState(0)
  const [queueState, setQueueState] = useState({ active: [], history: [] })
  const [settingsInitialTab, setSettingsInitialTab] = useState('agents')
  const { isRecording } = useSelector((state) => state.recording)

  useEffect(() => {
    loadAppSettings();
    loadQueueData();

    if (window.electronAPI?.onQueueUpdate) {
      window.electronAPI.onQueueUpdate((data) => {
        if (data) {
          updateQueueState(data);
        } else {
          loadQueueData();
        }
      });
    }

    // Listen for notification clicks
    if (window.electronAPI?.onNotificationClick) {
      window.electronAPI.onNotificationClick((payload) => {
        console.log('Notification clicked:', payload);
        if (payload && payload.recordingId) {
          handleNavigateToRecording(payload.recordingId);
        }
      });
    }

    // No cleanup for root app listener
  }, []);

  useEffect(() => {
    if (appSettings?.fontSize) {
      document.documentElement.setAttribute('data-font-size', appSettings.fontSize);
    } else {
      document.documentElement.setAttribute('data-font-size', 'medium');
    }
  }, [appSettings?.fontSize]);

  const loadQueueData = async () => {
    try {
      if (window.electronAPI?.getTranscriptionQueue) {
        const result = await window.electronAPI.getTranscriptionQueue();
        if (result.success) {
          updateQueueState(result);
        }
      }
    } catch (error) {
      console.error('Error loading queue data:', error);
    }
  };

  const updateQueueState = (data) => {
    setQueueState(data);
    if (data && data.active) {
      setQueueCount(data.active.length);
    }
  };

  const loadAppSettings = async () => {
    try {
      const settings = await getSettings();
      setAppSettings(settings);

      // Tracking: Primer inicio del día
      if (import.meta.env.VITE_SENTRY_DSN) {
        const today = new Date().toISOString().split('T')[0];
        if (settings.lastLoginDate !== today) {
          if (window.electronAPI && window.electronAPI.sentryLogInfo) {
            window.electronAPI.sentryLogInfo('Usuario ha entrado en la app (Daily Login)');
          }
          // Actualizamos el settings de forma asíncrona pero sin bloquear la carga principal
          updateSettings({ lastLoginDate: today }).catch(err => console.error(err));
        }
      }
      
      // Tracking: Actualización de versión
      if (window.electronAPI?.getAppVersion) {
        const r = await window.electronAPI.getAppVersion();
        if (r?.success) {
          const currentVersion = r.version;
          if (settings.lastVersion && settings.lastVersion !== currentVersion) {
            if (import.meta.env.VITE_SENTRY_DSN) {
              if (window.electronAPI && window.electronAPI.sentryLogInfo) {
                window.electronAPI.sentryLogInfo(`App actualizada: de v${settings.lastVersion} a v${currentVersion}`);
              }
            }
          }
          if (settings.lastVersion !== currentVersion) {
            await updateSettings({ lastVersion: currentVersion });
          }
        }
      }

      // Aplicar idioma de interfaz
      if (settings.uiLanguage) {
        i18n.changeLanguage(settings.uiLanguage);
      } else if (settings.isFirstRun && window.electronAPI?.getSystemLanguage) {
        // Primera ejecución: detectar idioma del SO
        try {
          const systemLang = await window.electronAPI.getSystemLanguage();
          i18n.changeLanguage(systemLang);
          updateSettings({ uiLanguage: systemLang }).catch(err => console.error('Error guardando uiLanguage:', err));
        } catch (err) {
          console.error('Error detectando idioma del sistema:', err);
        }
      }

      // Check onboarding
      if (settings.isFirstRun) {
        setCurrentView('onboarding');
      } else if (currentView === 'loading') {
        setCurrentView('home');
      }
    } catch (error) {
      console.error('Error loading app settings:', error);
      // Fallback
      if (currentView === 'loading') setCurrentView('home');
    }
  };

  const handleOnboardingComplete = () => {
    loadAppSettings().then(() => {
        setCurrentView('home');
    });
  };

  const handleBack = () => {
    if (currentView === 'recording-detail' && selectedProject) {
      setCurrentView('project-detail');
      setSelectedRecording(null);
    } else {
      setCurrentView('home')
      setSelectedRecording(null)
      setSelectedProjectId(null)
      setSelectedProject(null)
    }
  }

  const handleNavigateToProject = (project) => {
    setSelectedProjectId(project.id)
    setCurrentView('projects')
  }

  const handleProjectDetail = (project) => {
    setSelectedProject(project)
    setCurrentView('project-detail')
  }

  const handleNavigateToRecording = async (recordingId) => {
    try {
      // Intentar obtener todas las grabaciones para encontrar la que coincide
      const { default: recordingsService } = await import('./services/recordingsService');
      const recordings = await recordingsService.getRecordings();
      
      // Buscar por dbId o por id (dependiendo de cómo se maneje en el servicio)
      const recording = recordings.find(r => r.dbId === recordingId || r.id === recordingId || r.name === recordingId);
      
      if (recording) {
        setSelectedRecording(recording);
        setCurrentView('recording-detail');
      } else {
        console.error('No se pudo encontrar la grabación con ID:', recordingId);
      }
    } catch (error) {
      console.error('Error navegando a la grabación:', error);
    }
  };

  const handleRecordingStart = (recorder) => {
    setCurrentRecorder(recorder)
  }

  return (
    <div className={styles.appContainer} data-font-size={appSettings?.fontSize || 'medium'}>
      {currentView !== 'onboarding' && (
        <Sidebar currentView={currentView} onViewChange={setCurrentView} queueCount={queueCount} />
      )}
      
      <div className={`${styles.mainContent} ${currentView !== 'onboarding' ? styles.mainContentWithSidebar : ''}`}>
        {currentView === 'onboarding' && (
            <Onboarding onComplete={handleOnboardingComplete} />
        )}
        {currentView === 'home' && (
          <Home
            onSettings={(tab = 'agents') => {
              setSettingsInitialTab(tab);
              setCurrentView('settings');
            }}
            onProjects={() => setCurrentView('projects')}
            onRecordingStart={handleRecordingStart}
            onRecordingSelect={(recording) => {
              setSelectedRecording(recording);
              setCurrentView('recording-detail');
            }}
            onNavigateToProject={handleNavigateToProject}
            refreshTrigger={refreshTrigger}
          />
        )}
        {currentView === 'settings' && (
          <Settings 
            onBack={handleBack} 
            onSettingsSaved={loadAppSettings} 
            initialTab={settingsInitialTab} 
          />
        )}
        {currentView === 'projects' && (
          <Projects 
            onBack={handleBack} 
            initialProjectId={selectedProjectId}
            onProjectDetail={handleProjectDetail}
            onRecordingSelect={(recording) => {
              setSelectedRecording(recording);
              setCurrentView('recording-detail');
            }}
          />
        )}
        {currentView === 'project-detail' && selectedProject && (
          <ProjectDetail 
            project={selectedProject} 
            onBack={() => {
              setCurrentView('projects');
              setSelectedProject(null);
            }}
            onNavigateToRecording={handleNavigateToRecording}
          />
        )}
        {currentView === 'recording-detail' && selectedRecording && (
          <RecordingDetailWithTranscription 
            recording={selectedRecording} 
            onBack={handleBack}
            onNavigateToProject={handleProjectDetail}
          />
        )}
        {currentView === 'queue' && (
          <TranscriptionQueue
            onBack={handleBack}
            queueState={queueState}
            onNavigateToRecording={handleNavigateToRecording}
          />
        )}
        {currentView === 'ai-queue' && (
          <AiQueue />
        )}
      </div>
      
      {/* Mostrar RecordingOverlay cuando está grabando */}
      {isRecording && currentView !== 'onboarding' && (
        <RecordingOverlay
          recorder={currentRecorder}
          onFinish={() => {
            setCurrentRecorder(null);
            setRefreshTrigger(prev => prev + 1); // Refrescar Home al finalizar
          }}
        />
      )}
    </div>
  )
}
