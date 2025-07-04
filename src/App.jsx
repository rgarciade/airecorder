import React, { useState } from 'react'
import Home from './pages/Home/Home'
import './App.css'

export default function App() {
  const [page, setPage] = useState('home')
  const [selectedRecording, setSelectedRecording] = useState(null)

  // Por ahora solo Home, luego añadiremos Detalle y Settings
  if (page === 'home') {
    return <Home onSettings={() => setPage('settings')} onSelectRecording={(rec) => { setSelectedRecording(rec); setPage('detail') }} />
  }
  // Placeholder para las otras páginas
  if (page === 'settings') {
    return <div style={{ color: '#fff', background: '#2a1919', minHeight: '100vh' }}>Settings (en construcción) <button onClick={() => setPage('home')}>Volver</button></div>
  }
  if (page === 'detail') {
    return <div style={{ color: '#fff', background: '#2a1919', minHeight: '100vh' }}>Detalle de grabación: {selectedRecording?.name} <button onClick={() => setPage('home')}>Volver</button></div>
  }
  return null
}
