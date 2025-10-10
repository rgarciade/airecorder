import React, { useState } from 'react'
import { useSelector } from 'react-redux'
import Home from './pages/Home/Home'
import RecordingDetailWithTranscription from './pages/RecordingDetail/RecordingDetailWithTranscription';
import Settings from './pages/Settings/Settings'
import Projects from './pages/Projects/Projects'
import ProjectDetail from './pages/ProjectDetail/ProjectDetail'
import RecordingOverlay from './components/RecordingOverlay/RecordingOverlay'
import './App.css'

export default function App() {
  const [currentView, setCurrentView] = useState('home')
  const [selectedRecording, setSelectedRecording] = useState(null)
  const [selectedProjectId, setSelectedProjectId] = useState(null)
  const [selectedProject, setSelectedProject] = useState(null)
  const [currentRecorder, setCurrentRecorder] = useState(null)
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

  const handleSaveAndExit = async (recordingName) => {
    if (currentRecorder && currentRecorder.isRecording) {
      // Detener la grabación mezclada
      currentRecorder.stopMixedRecording()
    }
    
    // Limpiar el recorder
    setCurrentRecorder(null)
    
    console.log('Grabación guardada:', recordingName)
  }

  return (
    <>
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
      
      {/* Mostrar RecordingOverlay cuando está grabando */}
      {isRecording && (
        <RecordingOverlay
          recorder={currentRecorder}
          onFinish={() => {
            setCurrentRecorder(null);
          }}
        />
      )}
    </>
  )
}
