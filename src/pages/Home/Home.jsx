import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { startRecording } from '../../store/recordingSlice';
import { MixedAudioRecorder, getSystemMicrophones } from '../../services/audioService';
import { getSettings } from '../../services/settingsService';
import recordingsService from '../../services/recordingsService';
import styles from './Home.module.css';

import NewSessionCard from './components/NewSessionCard';
import StatsRow from './components/StatsRow';
import RecordingCard from '../../components/RecordingCard/RecordingCard';

export default function Home({ onSettings, onProjects, onRecordingStart, onRecordingSelect, onNavigateToProject, refreshTrigger }) {
  const dispatch = useDispatch();
  const { isRecording } = useSelector((state) => state.recording);
  
  const [recordings, setRecordings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  
  // Settings display
  const [currentMicLabel, setCurrentMicLabel] = useState('Default Mic');
  const [currentLangLabel, setCurrentLangLabel] = useState('English (US)');

  // Stats
  const [totalTimeStr, setTotalTimeStr] = useState("0h 0m");
  const [totalFiles, setTotalFiles] = useState(0);
  const [savedTimeStr, setSavedTimeStr] = useState("0h 0m");

  useEffect(() => {
    loadRecordings();
    checkPermissions();
    loadSettingsInfo();
  }, [refreshTrigger]); 

  const loadSettingsInfo = async () => {
    try {
      const settings = await getSettings();
      const devices = await getSystemMicrophones();
      
      // Update Mic Label
      if (settings?.microphone) {
        const mic = devices.find(d => d.value === settings.microphone);
        if (mic) setCurrentMicLabel(mic.label);
      } else if (devices.length > 0) {
        setCurrentMicLabel(devices[0].label);
      }

      // Update Language Label
      if (settings?.language) {
        const langMap = {
          'en': 'English',
          'es': 'Español',
          'fr': 'Français',
        };
        setCurrentLangLabel(langMap[settings.language] || settings.language);
      } else {
        // Default if no language set
        setCurrentLangLabel('English');
      }
    } catch (error) {
      console.error("Error loading settings info:", error);
    }
  };

  const checkPermissions = async () => {
    if (window.electronAPI && window.electronAPI.getMicrophonePermission) {
      try {
        const status = await window.electronAPI.getMicrophonePermission();
        if (status === 'denied') {
          setPermissionDenied(true);
        }
      } catch (err) {
        console.error('Error checking permissions:', err);
      }
    }
  };

  const loadRecordings = async () => {
    try {
      setLoading(true);
      
      const list = await recordingsService.getRecordings();
      // Sort by date desc
      list.sort((a, b) => new Date(b.date) - new Date(a.date));
      setRecordings(list);
      
      // Calculate stats
      let totalSeconds = 0;
      list.forEach(r => {
        if (r.duration) totalSeconds += r.duration;
      });
      
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      setTotalTimeStr(`${hours}h ${minutes}m`);
      setTotalFiles(list.length);
      
      setSavedTimeStr(`${hours}h ${minutes}m`); 
      
    } catch (err) {
      console.error("Error loading recordings:", err);
      setError("Failed to load recordings");
    } finally {
      setLoading(false);
    }
  };

  const handleTranscribe = async (recordingId) => {
    try {
      alert('Iniciando transcripción...'); 
      
      const result = await window.electronAPI.transcribeRecording(recordingId);
      
      if (result.success) {
        loadRecordings(); 
      } else {
        alert('Error iniciando transcripción: ' + result.error);
      }
    } catch (err) {
      console.error('Error transcribing:', err);
      alert('Error: ' + err.message);
    }
  };

  const handleStart = async () => {
    if (isRecording) return;

    if (permissionDenied) {
      alert('⚠️ Acceso al micrófono denegado.\n\nPor favor, habilita el permiso en Ajustes del Sistema > Privacidad y Seguridad > Micrófono.');
      return;
    }

    try {
      // 1. Get Settings/Microphone
      const devices = await getSystemMicrophones();
      const settings = await getSettings();
      
      let selectedMic = '';
      if (settings && settings.microphone) {
        selectedMic = settings.microphone;
      } else if (devices.length > 0) {
        selectedMic = devices[0].value;
      }

      if (!selectedMic) {
        alert('No microphone selected or available. Please check settings.');
        return;
      }

      // 2. Start Recording
      const recorder = new MixedAudioRecorder();
      await recorder.startMixedRecording(selectedMic, null);
      
      dispatch(startRecording());
      
      if (onRecordingStart) {
        onRecordingStart(recorder);
      }
      
    } catch (err) {
      console.error('Error starting recording:', err);
      
      let errorMessage = 'No se pudo iniciar la grabación: ' + err.message;
      
      if (err.name === 'NotAllowedError' || err.message.toLowerCase().includes('permission denied')) {
        setPermissionDenied(true); 
        errorMessage = '⚠️ Acceso al micrófono denegado.\n\nPor favor, habilita el permiso de micrófono para la aplicación en:\n\nAjustes del Sistema > Privacidad y Seguridad > Micrófono.';
      } else if (err.name === 'NotFoundError') {
        errorMessage = '⚠️ No se encontró ningún micrófono.\n\nPor favor, conecta un micrófono e intenta de nuevo.';
      }
      
      alert(errorMessage);
    }
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.greeting}>Good Morning, User</h1>
          <p className={styles.subtitle}>Ready to capture your next big idea?</p>
        </div>
        <div className={styles.headerActions}>
          <input type="text" placeholder="Search recordings..." className={styles.searchInput} />
          <button className={styles.bellBtn} onClick={onSettings} title="Settings">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.1a2 2 0 0 1-1-1.72v-.51a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
          </button>
        </div>
      </header>

      {permissionDenied && (
        <div className={styles.permissionWarning}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 9a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0v-8a3 3 0 0 0-3-3z"/>
            <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
            <line x1="12" y1="19" x2="12" y2="23"/>
            <line x1="8" y1="23" x2="16" y2="23"/>
            <line x1="1" y1="1" x2="23" y2="23"/>
          </svg>
          <span>
            Acceso al micrófono denegado. La aplicación no podrá grabar audio.
            <br />
            <span style={{ fontSize: '0.85rem', fontWeight: 400 }}>Ve a Ajustes del Sistema &gt; Privacidad y Seguridad &gt; Micrófono y habilita AIRecorder.</span>
          </span>
        </div>
      )}

      <NewSessionCard 
        onStart={handleStart} 
        microphoneLabel={currentMicLabel}
        languageLabel={currentLangLabel}
        onOpenSettings={onSettings}
      />
      
      <StatsRow 
        totalTime={totalTimeStr} 
        totalFiles={totalFiles} 
        savedTime={savedTimeStr} 
      />
      
      <div className={styles.sectionHeader}>
        <h2>Recent Recordings</h2>
        <button onClick={onProjects}>View Projects</button>
      </div>
      
      {loading && <p>Loading recordings...</p>}
      
      <div className={styles.grid}>
        {recordings.map(rec => (
          <RecordingCard 
            key={rec.id} 
            recording={rec} 
            onClick={onRecordingSelect}
            onTranscribe={handleTranscribe}
          />
        ))}
        {!loading && recordings.length === 0 && (
          <p className={styles.noRecordingsMessage}>No recordings yet. Start a new session!</p>
        )}
      </div>
    </div>
  );
}
