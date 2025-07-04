import React, { useState } from 'react'
import Home from './pages/Home/Home'
import RecordingDetail from './pages/RecordingDetail/RecordingDetail'
import Settings from './pages/Settings/Settings'
import './App.css'

export default function App() {
  const [page, setPage] = useState('home')

  // Por ahora solo Home, luego añadiremos Detalle y Settings
  if (page === 'home') {
    return <Home onSettings={() => setPage('settings')} onSelectRecording={() => setPage('detail')} />
  }
  // Placeholder para las otras páginas
  if (page === 'settings') {
    return <Settings onBack={() => setPage('home')} />
  }
  if (page === 'detail') {
    return <RecordingDetail onBack={() => setPage('home')} />
  }
  return null
}
