import React, { useState } from 'react'
import { useSelector } from 'react-redux'
import Home from './pages/Home/Home'
import RecordingDetail from './pages/RecordingDetail/RecordingDetail'
import Settings from './pages/Settings/Settings'
import TestRecorderPage from './pages/TestRecorder/TestRecorder'
import Recording from './components/Recording/Recording'
import './App.css'

export default function App() {
  const [currentView, setCurrentView] = useState('home')
  const [selectedRecording, setSelectedRecording] = useState(null)
  const { isRecording } = useSelector((state) => state.recording)

  const handleSelectRecording = (recording) => {
    setSelectedRecording(recording)
    setCurrentView('recording-detail')
  }

  const handleBack = () => {
    setCurrentView('home')
    setSelectedRecording(null)
  }

  return (
    <>
      {currentView === 'home' && (
        <Home
          onSettings={() => setCurrentView('settings')}
          onSelectRecording={handleSelectRecording}
          onTestRecorder={() => setCurrentView('test-recorder')}
        />
      )}
      {currentView === 'settings' && (
        <Settings onBack={handleBack} />
      )}
      {currentView === 'test-recorder' && (
        <TestRecorderPage onBack={handleBack} />
      )}
      {currentView === 'recording-detail' && selectedRecording && (
        <RecordingDetail recording={selectedRecording} onBack={handleBack} />
      )}
      {isRecording && <Recording />}
    </>
  )
}
