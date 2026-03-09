import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useSelector, useDispatch } from 'react-redux';
import { startRecording } from '../../store/recordingSlice';
import { MixedAudioRecorder, getSystemMicrophones } from '../../services/audioService';
import { getSettings } from '../../services/settingsService';
import recordingsService from '../../services/recordingsService';
import { MdChevronLeft, MdChevronRight } from 'react-icons/md';
import styles from './Home.module.css';

import NewSessionCard from './components/NewSessionCard';
import StatsRow from './components/StatsRow';
import RecordingCard from '../../components/RecordingCard/RecordingCard';

export default function Home({ onSettings, onProjects, onRecordingStart, onRecordingSelect, onNavigateToProject, refreshTrigger }) {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const { isRecording } = useSelector((state) => state.recording);
  
  const [recordings, setRecordings] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;
  
  // Settings display
  const [currentMicLabel, setCurrentMicLabel] = useState('');
  const [currentLangLabel, setCurrentLangLabel] = useState('');

  // Stats
  const [totalTimeStr, setTotalTimeStr] = useState("0h 0m");
  const [totalFiles, setTotalFiles] = useState(0);
  const [savedTimeStr, setSavedTimeStr] = useState("0h 0m");

  // Import Modal
  const [importModal, setImportModal] = useState(null);
  const [importName, setImportName] = useState('');

  useEffect(() => {
    loadRecordings();
    loadDashboardStats();
    checkPermissions();
    loadSettingsInfo();
  }, [refreshTrigger]); 
  
  const loadDashboardStats = async () => {
    if (window.electronAPI?.getDashboardStats) {
      try {
        const stats = await window.electronAPI.getDashboardStats();
        // stats = { totalHours: "1.5", weekHours: "0.5", totalTranscriptions: 5, totalRecordings: 10 }

        const totalHoursNum = parseFloat(stats.totalHours);
        const hours = Math.floor(totalHoursNum);
        const minutes = Math.floor((totalHoursNum - hours) * 60);

        // Week time (Monday to Friday)
        const weekHoursNum = parseFloat(stats.weekHours);
        const weekHours = Math.floor(weekHoursNum);
        const weekMinutes = Math.floor((weekHoursNum - weekHours) * 60);

        setTotalTimeStr(`${hours}h ${minutes}m`);
        setTotalFiles(stats.totalTranscriptions); // Or totalRecordings if you prefer total files
        setSavedTimeStr(`${weekHours}h ${weekMinutes}m`);

      } catch (err) {
        console.error("Error loading dashboard stats:", err);
      }
    }
  };

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
      } else {
        setCurrentMicLabel(t('home.defaultMic'));
      }

      // Update Language Label (transcription language)
      if (settings?.language) {
        const langMap = { 'en': 'English', 'es': 'Español', 'fr': 'Français' };
        setCurrentLangLabel(langMap[settings.language] || settings.language);
      } else {
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
      return list;

    } catch (err) {
      console.error("Error loading recordings:", err);
      setError("Failed to load recordings");
      return [];
    } finally {
      setLoading(false);
    }
  };

  const handleTranscribe = async (recordingId) => {
    try {
      const settings = await getSettings();
      const defaultModel = settings.whisperModel || 'small';
      
      const result = await window.electronAPI.transcribeRecording(recordingId, defaultModel);
      
      if (result.success) {
        loadRecordings(); 
      } else {
        alert(t('home.errorTranscribing', { error: result.error }));
      }
    } catch (err) {
      console.error('Error transcribing:', err);
      alert('Error: ' + err.message);
    }
  };

  const handleImportTeams = async () => {
    try {
      const result = await window.electronAPI.importTeamsTranscript();
      if (result?.canceled) return;
      if (result?.success && result?.recording) {
        // Tracking Sentry
        if (import.meta.env.VITE_SENTRY_DSN) {
          if (window.electronAPI && window.electronAPI.sentryLogInfo) {
            window.electronAPI.sentryLogInfo('Nueva grabación guardada con éxito (Importación Teams)');
          }
        }

        const list = await loadRecordings();
        if (onRecordingSelect) {
          // Buscar el objeto completo por carpeta (relative_path) o ID de BD
          const rec = list.find(r => r.id === result.recording.relative_path || r.dbId === result.recording.id);
          if (rec) {
            onRecordingSelect(rec);
          }
        }
      } else {
        alert(t('home.errorImporting', { error: result?.error || 'Error desconocido' }));
      }
    } catch (err) {
      console.error('Error importando transcripción de Teams:', err);
      alert('Error: ' + err.message);
    }
  };

  const handleImportAudio = async () => {
    try {
      const result = await window.electronAPI.importAudioFile();
      if (result?.canceled) return;
      if (result?.success && result?.recording) {
        let recordingId = result.recording.id;
        let recordingPath = result.recording.relative_path;

        // Mostrar modal para pedir nombre
        const suggestedName = result.recording.relative_path.replace(/^imported_audio_/, '').replace(/_[0-9-]+$/, '');
        
        setImportName(suggestedName);
        setImportModal({ recordingId, recordingPath });
      } else {
        alert(t('home.errorImportingAudio', { error: result?.error || 'Error desconocido' }));
      }
    } catch (err) {
      console.error('Error importando archivo de audio:', err);
      alert('Error: ' + err.message);
    }
  };

  const handleConfirmImport = async () => {
    if (!importModal) return;
    
    let { recordingId, recordingPath } = importModal;
    setImportModal(null); // Cerrar modal
    
    try {
      // Tracking Sentry
      if (import.meta.env.VITE_SENTRY_DSN) {
        if (window.electronAPI && window.electronAPI.sentryLogInfo) {
          window.electronAPI.sentryLogInfo('Nueva grabación guardada con éxito (Importación Audio)');
        }
      }

      if (importName && importName.trim() !== '') {
        const renameResult = await window.electronAPI.renameRecording(recordingId || recordingPath, importName);
        if (renameResult?.success) {
          recordingPath = renameResult.folderName;
        }
      }

      // Iniciar transcripción automáticamente
      const settings = await getSettings();
      const defaultModel = settings.whisperModel || 'small';
      await window.electronAPI.transcribeRecording(recordingId || recordingPath, defaultModel);

      const list = await loadRecordings();
      if (onRecordingSelect) {
        const rec = list.find(r => r.id === recordingId || r.folderName === recordingPath || r.id === recordingPath);
        if (rec) {
          onRecordingSelect(rec);
        }
      }
    } catch (err) {
      console.error('Error confirmando importación:', err);
    }
  };

  const handleStart = async () => {
    if (isRecording) return;

    if (permissionDenied) {
      if (window.confirm(t('home.micPermissionDeniedConfirm'))) {
        if (window.electronAPI?.openMicrophonePreferences) {
          window.electronAPI.openMicrophonePreferences();
        }
      }
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
      
      let errorMessage = t('home.errorStartingRecording', { error: err.message });

      if (err.name === 'NotAllowedError' || err.message.toLowerCase().includes('permission denied')) {
        setPermissionDenied(true);
        if (window.confirm(t('home.micPermissionDeniedSystem') + '\n\n' + t('home.micPermissionDeniedConfirm').split('\n\n')[2])) {
          if (window.electronAPI?.openMicrophonePreferences) {
            window.electronAPI.openMicrophonePreferences();
          }
        }
        return;
      } else if (err.name === 'NotFoundError') {
        errorMessage = t('home.micNotFound');
      }

      alert(errorMessage);
    }
  };

  const filteredRecordings = recordings.filter(rec => 
    rec.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPages = Math.ceil(filteredRecordings.length / itemsPerPage);
  const paginatedRecordings = filteredRecordings.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.greeting}>{t('home.greeting')}</h1>
          <p className={styles.subtitle}>{t('home.subtitle')}</p>
        </div>
        <div className={styles.headerActions}>
          <input 
            type="text" 
            placeholder={t('home.searchPlaceholder')}
            className={styles.searchInput} 
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1); // Reset to first page on search
            }}
          />
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span>
              {t('home.micPermissionDenied')}
              <br />
              <span style={{ fontSize: '0.85rem', fontWeight: 400 }}>{t('home.micPermissionDeniedDesc')}</span>
            </span>
            <button 
              onClick={() => window.electronAPI?.openMicrophonePreferences?.()}
              style={{
                alignSelf: 'flex-start',
                backgroundColor: 'transparent',
                border: '1px solid currentColor',
                borderRadius: '4px',
                padding: '4px 8px',
                fontSize: '0.85rem',
                cursor: 'pointer',
                color: 'inherit'
              }}
            >
              {t('home.openSystemSettings')}
            </button>
          </div>
        </div>
      )}

      <NewSessionCard
        onStart={handleStart}
        onImport={handleImportTeams}
        onImportAudio={handleImportAudio}
        microphoneLabel={currentMicLabel}
        languageLabel={currentLangLabel}
        onOpenSettings={() => onSettings('general')}
      />
      
      <StatsRow 
        totalTime={totalTimeStr} 
        totalFiles={totalFiles} 
        savedTime={savedTimeStr} 
      />
      
      <div className={styles.sectionHeader}>
        <h2>{t('home.recentRecordings')}</h2>
        <button onClick={onProjects}>{t('home.viewProjects')}</button>
      </div>
      
      {loading && <p>{t('home.loadingRecordings')}</p>}
      
      <div className={styles.grid}>
        {paginatedRecordings.map(rec => (
            <RecordingCard 
              key={rec.id} 
              recording={rec} 
              onClick={onRecordingSelect}
              onTranscribe={handleTranscribe}
            />
          ))}
        {!loading && recordings.length === 0 && (
          <p className={styles.noRecordingsMessage}>{t('home.noRecordings')}</p>
        )}
      </div>

      {totalPages > 1 && (
        <div className={styles.pagination}>
          <button 
            className={styles.pageBtn} 
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(prev => prev - 1)}
          >
            <MdChevronLeft size={20} />
          </button>
          <span className={styles.pageInfo}>
            {t('home.page', { current: currentPage, total: totalPages })}
          </span>
          <button 
            className={styles.pageBtn} 
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage(prev => prev + 1)}
          >
            <MdChevronRight size={20} />
          </button>
        </div>
      )}

      {/* Modal para renombrar la grabación importada */}
      {importModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <h3 className={styles.modalTitle}>{t('home.importAudio.title')}</h3>
            <p className={styles.modalText}>
              {t('home.importAudio.description')}
            </p>
            <div className={styles.formGroup}>
              <label className={styles.label}>{t('home.importAudio.recordingName')}</label>
              <input
                type="text"
                className={styles.input}
                value={importName}
                onChange={(e) => setImportName(e.target.value)}
                placeholder={t('home.importAudio.namePlaceholder')}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleConfirmImport();
                }}
              />
            </div>
            <div className={styles.buttonGroup}>
              <button
                className={styles.cancelBtn}
                onClick={() => setImportModal(null)}
              >
                {t('home.importAudio.cancel')}
              </button>
              <button
                className={styles.confirmBtn}
                onClick={handleConfirmImport}
              >
                {t('home.importAudio.startTranscription')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
