import React, { useState, useEffect, useCallback } from 'react'
import { useSelector } from 'react-redux'
import useAutoAnalyze from './hooks/useAutoAnalyze'
import useAppearance from './hooks/useAppearance'
import useDatabaseStatus from './hooks/useDatabaseStatus'
import useQueueManager from './hooks/useQueueManager'
import useNotificationHandler from './hooks/useNotificationHandler'
import useNavigation from './hooks/useNavigation'
import useSession from './hooks/useSession'
import WhatsNewModal from './components/WhatsNewModal/WhatsNewModal'
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
import styles from './App.module.css'
import './App.css'

export default function App() {
  const [currentRecorder, setCurrentRecorder] = useState(null)
  const [refreshTrigger, setRefreshTrigger] = useState(0) // Trigger para refrescar Home
  const { isRecording } = useSelector((state) => state.recording)

  const {
    currentView,
    setCurrentView,
    selectedRecording,
    setSelectedRecording,
    selectedProjectId,
    selectedProject,
    settingsInitialTab,
    handleNavigateToRecording,
    handleNavigateToProject,
    handleBack,
    navigateTo,
    handleOpenSettings,
    handleSelectRecording
  } = useNavigation();

  const onSessionLoaded = useCallback((settings) => {
    // Solo inicializamos la vista si estamos en 'loading' o es el primer arranque
    if (settings?.isFirstRun) {
      setCurrentView('onboarding');
    } else {
      // Usamos una función de actualización de estado para evitar depender de currentView
      setCurrentView(prev => (prev === 'loading' ? 'home' : prev));
    }
  }, [setCurrentView]);

  const {
    appSettings,
    showWhatsNew,
    setShowWhatsNew,
    loadAppSettings
  } = useSession(onSessionLoaded);

  // Hooks de lógica desacoplada
  useAutoAnalyze();
  useAppearance(appSettings);
  const { queueCount, queueState, loadQueueData } = useQueueManager();
  const { dbFallbackBanner } = useDatabaseStatus();
  useNotificationHandler(handleNavigateToRecording);

  const handleOnboardingComplete = () => {
    loadAppSettings().then(() => {
      setCurrentView('home');
    });
  };

  const handleRecordingStart = (recorder) => {
    setCurrentRecorder(recorder)
  }

  return (
    <div className={styles.appContainer} data-font-size={appSettings?.fontSize || 'medium'}>
      {/* Banner de aviso: base de datos en modo fallback */}
      {dbFallbackBanner && currentView !== 'onboarding' && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
          background: '#FEF3C7', borderBottom: '1px solid #F59E0B',
          padding: '10px 20px', display: 'flex', alignItems: 'center', gap: '10px',
          fontSize: '0.85rem', color: '#92400E'
        }}>
          <span style={{ fontSize: '1rem' }}>⚠️</span>
          <span style={{ flex: 1 }}>
            <strong>Base de datos temporal.</strong> El disco con la BD configurada no está accesible.
            Los cambios de esta sesión no se guardarán en ella. Conecta el disco y reinicia la app.
          </span>
          <button
            onClick={() => setDbFallbackBanner(false)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: '1.1rem', color: '#92400E', padding: '0 4px'
            }}
            aria-label="Cerrar aviso"
          >
            ✕
          </button>
        </div>
      )}

      {/* Modal de novedades (dev: siempre; prod: cuando la versión cambia) */}
      {showWhatsNew && currentView !== 'onboarding' && (
        <WhatsNewModal onClose={() => setShowWhatsNew(false)} />
      )}

      {currentView !== 'onboarding' && (
        <Sidebar 
          currentView={currentView} 
          onViewChange={(view) => {
            if (view === 'settings') {
              handleOpenSettings('agents');
            } else {
              navigateTo(view);
            }
          }} 
          queueCount={queueCount} 
        />
      )}
      
      <div className={`${styles.mainContent} ${currentView !== 'onboarding' ? styles.mainContentWithSidebar : ''}`}>
        {currentView === 'onboarding' && (
            <Onboarding onComplete={handleOnboardingComplete} />
        )}
        {currentView === 'home' && (
          <Home
            onSettings={handleOpenSettings}
            onProjects={() => navigateTo('projects')}
            onRecordingStart={handleRecordingStart}
            onRecordingSelect={handleSelectRecording}
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
            onProjectDetail={handleNavigateToProject}
            onRecordingSelect={handleSelectRecording}
          />
        )}
        {currentView === 'project-detail' && selectedProject && (
          <ProjectDetail 
            project={selectedProject} 
            onBack={handleBack}
            onNavigateToRecording={handleNavigateToRecording}
          />
        )}
        {currentView === 'recording-detail' && selectedRecording && (
          <RecordingDetailWithTranscription 
            recording={selectedRecording} 
            onBack={handleBack}
            onNavigateToProject={handleNavigateToProject}
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
          <AiQueue onBack={handleBack} onNavigateToRecording={handleNavigateToRecording} />
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
