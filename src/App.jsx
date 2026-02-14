import React, { useState } from 'react'
import { useSelector } from 'react-redux'
import Home from './pages/Home/Home'
import RecordingDetailWithTranscription from './pages/RecordingDetail/RecordingDetailWithTranscription';
import Settings from './pages/Settings/Settings'
import Projects from './pages/Projects/Projects'
import ProjectDetail from './pages/ProjectDetail/ProjectDetail'
import RecordingOverlay from './components/RecordingOverlay/RecordingOverlay'
import Sidebar from './components/Sidebar/Sidebar';
import styles from './App.module.css'
import './App.css'

export default function App() {
  const [currentView, setCurrentView] = useState('home')
  const [selectedRecording, setSelectedRecording] = useState(null)
  const [selectedProjectId, setSelectedProjectId] = useState(null)
  const [selectedProject, setSelectedProject] = useState(null)
  const [currentRecorder, setCurrentRecorder] = useState(null)
  const [refreshTrigger, setRefreshTrigger] = useState(0) // Trigger para refrescar Home
  const { isRecording } = useSelector((state) => state.recording)

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
    <div className={styles.appContainer}>
      <Sidebar currentView={currentView} onViewChange={setCurrentView} />
      
      <div className={styles.mainContent}>
        {currentView === 'home' && (
          <Home
            onSettings={() => setCurrentView('settings')}
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
          <Settings onBack={handleBack} />
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
      </div>
      
      {/* Mostrar RecordingOverlay cuando está grabando */}
      {isRecording && (
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
