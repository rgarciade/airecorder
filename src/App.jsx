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
    setCurrentView('home')
    setSelectedRecording(null)
    setSelectedProjectId(null)
    setSelectedProject(null)
  }

  const handleNavigateToProject = (project) => {
    setSelectedProjectId(project.id)
    setCurrentView('projects')
  }

  const handleProjectDetail = (project) => {
    setSelectedProject(project)
    setCurrentView('project-detail')
  }

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
            onBack={() => setCurrentView('projects')}
          />
        )}
        {currentView === 'recording-detail' && selectedRecording && (
          <RecordingDetailWithTranscription 
            recording={selectedRecording} 
            onBack={handleBack}
            onNavigateToProject={handleNavigateToProject}
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
