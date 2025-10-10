import React, { useState, useEffect } from 'react';
import styles from './RecordingList.module.css';
import recordingsService from '../../services/recordingsService';
import projectsService from '../../services/projectsService';
import TranscriptionViewer from '../TranscriptionViewer/TranscriptionViewer';

// Modal de confirmación para borrar grabación
function DeleteConfirmationModal({ recording, isOpen, onClose, onConfirm }) {
  const [inputText, setInputText] = useState('');
  
  const handleConfirm = () => {
    if (recording && inputText.trim().toLowerCase() === 'borrar') {
      onConfirm(recording);
      setInputText('');
      onClose();
    }
  };

  const isTextMatch = inputText.trim().toLowerCase() === 'borrar';

  if (!isOpen || !recording) return null;

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modal}>
        <h3 className={styles.modalTitle}>Confirmar eliminación</h3>
        <p className={styles.modalText}>
          ¿Estás seguro de que quieres eliminar la grabación "{recording.name}"?
        </p>
        <p className={styles.modalText}>
          Esta acción eliminará tanto la grabación como su análisis y no se puede deshacer.
        </p>
        <div className={styles.modalInput}>
          <label className={styles.modalLabel}>
            Escribe "Borrar" para confirmar:
          </label>
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Borrar"
            className={styles.confirmInput}
          />
        </div>
        <div className={styles.modalButtons}>
          <button 
            onClick={onClose}
            className={styles.cancelButton}
          >
            Cancelar
          </button>
          <button 
            onClick={handleConfirm}
            disabled={!isTextMatch}
            className={`${styles.deleteButton} ${!isTextMatch ? styles.disabled : ''}`}
          >
            Eliminar
          </button>
        </div>
      </div>
    </div>
  );
}

export default function RecordingList({ onRecordingSelect, onNavigateToProject }) {
  const [recordings, setRecordings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, recording: null });
  const [transcribingId, setTranscribingId] = useState(null);
  const [transcribeError, setTranscribeError] = useState(null);
  const [durations, setDurations] = useState({});
  const [recordingProjects, setRecordingProjects] = useState({});

  useEffect(() => {
    loadRecordings();
  }, []);

  useEffect(() => {
    // Calcular duración para grabaciones que no la tengan
    if (recordings.length > 0) {
      recordings.forEach((rec) => {
        if (!rec.duration && rec.files && rec.files.length > 0 && !durations[rec.id]) {
          const audioFile = rec.files.find(f => f && f.name && (f.name.endsWith('.webm') || f.name.endsWith('.mp3') || f.name.endsWith('.wav')));
          if (audioFile && audioFile.url) {
            const audio = new window.Audio(audioFile.url);
            audio.addEventListener('loadedmetadata', () => {
              setDurations(prev => ({ ...prev, [rec.id]: audio.duration }));
            });
          }
        }
      });
    }
  }, [recordings]);

  const loadRecordings = async () => {
    try {
      setLoading(true);
      setError(null);
      const recordingsList = await recordingsService.getRecordings();
      setRecordings(recordingsList);
      
      // Cargar proyectos para cada grabación
      const projectsMap = {};
      for (const recording of recordingsList) {
        const project = await projectsService.getRecordingProject(recording.id);
        if (project) {
          projectsMap[recording.id] = project;
        }
      }
      setRecordingProjects(projectsMap);
    } catch (err) {
      setError('Error al cargar las grabaciones');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (e, recording) => {
    e.stopPropagation();
    try {
      await recordingsService.downloadRecording(recording.id);
    } catch (err) {
      alert('Error al descargar la grabación');
    }
  };

  const handleDeleteClick = (e, recording) => {
    e.stopPropagation();
    setDeleteModal({ isOpen: true, recording });
  };

  const handleDeleteConfirm = async (recording) => {
    try {
      await recordingsService.deleteRecording(recording.id);
      await loadRecordings();
    } catch (err) {
      alert('Error al eliminar la grabación');
    }
  };

  const handleTranscribe = async (e, recording) => {
    e.stopPropagation();
    setTranscribeError(null);
    setTranscribingId(recording.id);
    const result = await recordingsService.transcribeRecording(recording.id);
    if (result.success) {
      await loadRecordings();
    } else {
      setTranscribeError(result.error || 'Error al transcribir');
    }
    setTranscribingId(null);
  };

  // Vista de lista de grabaciones
  return (
    <div className={styles.container}>
      <div className={styles.list}>
        <div className={styles.listHeader}>
          <h2 className={styles.title}>Grabaciones</h2>
          <button onClick={loadRecordings} className={styles.refreshButton}>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 256 256">
              <path d="M197.67,186.37a8,8,0,0,1,0,11.29C196.58,198.73,170.82,224,128,224c-37.39,0-64.53-22.4-80-39.85V208a8,8,0,0,1-16,0V160a8,8,0,0,1,8-8H88a8,8,0,0,1,0,16H55.44C67.76,183.35,93,208,128,208c36,0,58.14-21.46,58.36-21.68A8,8,0,0,1,197.67,186.37ZM216,40a8,8,0,0,0-8,8V71.85C192.53,54.4,165.39,32,128,32,85.18,32,59.42,57.27,58.34,58.34a8,8,0,0,0,11.3,11.34C69.86,69.46,92,48,128,48c35,0,60.24,24.65,72.56,40H168a8,8,0,0,0,0,16h48a8,8,0,0,0,8-8V48A8,8,0,0,0,216,40Z"></path>
            </svg>
            Actualizar
          </button>
        </div>
        {loading && (
          <div className={styles.loading}>
            <div className={styles.spinner}></div>
            <p>Cargando grabaciones...</p>
          </div>
        )}
        {error && (
          <div className={styles.error}>
            <p>{error}</p>
            <button onClick={loadRecordings} className={styles.retryButton}>
              Reintentar
            </button>
          </div>
        )}
        {transcribeError && (
          <div className={styles.error}>
            <p>{transcribeError}</p>
          </div>
        )}
        {!loading && !error && recordings.length === 0 && (
          <div className={styles.noRecordings}>
            <h3>No hay grabaciones</h3>
            <p>Crea tu primera grabación usando el botón de grabar.</p>
          </div>
        )}
        {!loading && !error && recordings.length > 0 && (
          <ul className={styles.recordingsList}>
            {recordings.map((recording) => {
              // Duración
              let duration = recording.duration || durations[recording.id];
              let durationStr = duration ? `${Math.floor(duration/60).toString().padStart(2,'0')}:${Math.floor(duration%60).toString().padStart(2,'0')}` : '';

              return (
                <li key={recording.id} className={styles.item} onClick={() => onRecordingSelect(recording)}>
                  <div className={styles.icon}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" fill="white" viewBox="0 0 256 256">
                      <path d="M128,176a48.05,48.05,0,0,0,48-48V64a48,48,0,0,0-96,0v64A48.05,48.05,0,0,0,128,176ZM96,64a32,32,0,0,1,64,0v64a32,32,0,0,1-64,0Zm40,143.6V232a8,8,0,0,1-16,0V207.6A80.11,80.11,0,0,1,48,128a8,8,0,0,1,16,0,64,64,0,0,0,128,0,8,8,0,0,1,16,0A80.11,80.11,0,0,1,136,207.6Z"></path>
                    </svg>
                  </div>
                  <div className={styles.info}>
                    <div className={styles.name}>{recording.name}</div>
                    <div className={styles.date}>{recording.date}{durationStr && <span className={styles.duration}> · {durationStr}</span>}</div>
                    {recordingProjects[recording.id] && (
                      <div 
                        className={styles.projectBadge}
                        onClick={(e) => {
                          e.stopPropagation();
                          onNavigateToProject && onNavigateToProject(recordingProjects[recording.id]);
                        }}
                        title="Ir al proyecto"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="currentColor" viewBox="0 0 256 256">
                          <path d="M245,110.64A16,16,0,0,0,232,104H216V88a16,16,0,0,0-16-16H130.67L102.94,51.2a16.14,16.14,0,0,0-9.6-3.2H40A16,16,0,0,0,24,64V208h0a8,8,0,0,0,8,8H211.1a8,8,0,0,0,7.59-5.47l28.49-85.47A16.05,16.05,0,0,0,245,110.64ZM93.34,64l27.73,20.8a16.12,16.12,0,0,0,9.6,3.2H200v16H69.77a16,16,0,0,0-15.18,10.94L40,158.7V64Zm112,136H43.1l26.67-80H232Z"></path>
                        </svg>
                        {recordingProjects[recording.id].name}
                      </div>
                    )}
                    {recording.hasTranscription && (
                      <div className={styles.transcriptionBadge}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="currentColor" viewBox="0 0 256 256">
                          <path d="M213.66,82.34l-56-56A8,8,0,0,0,152,24H56A16,16,0,0,0,40,40V216a16,16,0,0,0,16,16H200a16,16,0,0,0,16-16V88A8,8,0,0,0,213.66,82.34ZM160,51.31,188.69,80H160ZM200,216H56V40h88V88a8,8,0,0,0,8,8h48V216Z"></path>
                        </svg>
                        Transcripción disponible
                      </div>
                    )}
                  </div>
                  <div className={styles.actions} onClick={(e) => e.stopPropagation()}>
                    {!recording.hasTranscription && (
                      <button
                        className={styles.transcribe}
                        onClick={(e) => handleTranscribe(e, recording)}
                        disabled={!!transcribingId}
                        title={transcribingId ? 'Ya hay una transcripción en curso' : 'Transcribir grabación'}
                      >
                        {transcribingId === recording.id ? (
                          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <circle cx="10" cy="10" r="8" stroke="#f7b731" strokeWidth="2" strokeDasharray="4 4" opacity="0.6"/>
                          </svg>
                        ) : (
                          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <circle cx="10" cy="10" r="9" fill="#f7b731"/>
                            <path d="M10 5a2 2 0 0 1 2 2v3a2 2 0 0 1-4 0V7a2 2 0 0 1 2-2zm3 5a3 3 0 0 1-6 0" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                            <path d="M10 13v1.5m-2 0h4" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/>
                          </svg>
                        )}
                      </button>
                    )}
                    <button
                      className={styles.play}
                      onClick={(e) => {
                        e.stopPropagation();
                        onRecordingSelect(recording);
                      }}
                      title="Reproducir o ver detalles"
                    >
                      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <circle cx="10" cy="10" r="9" fill="#2563eb"/>
                        <polygon points="8,6 15,10 8,14" fill="#fff"/>
                      </svg>
                    </button>
                    <button
                      className={styles.delete}
                      onClick={(e) => handleDeleteClick(e, recording)}
                      title="Eliminar grabación"
                    >
                      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <circle cx="10" cy="10" r="9" fill="#e92932"/>
                        <path d="M7 13L13 7M7 7l6 6" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/>
                      </svg>
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <DeleteConfirmationModal
        recording={deleteModal.recording}
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, recording: null })}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
} 