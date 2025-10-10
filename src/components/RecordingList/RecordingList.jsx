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
          <h2 className={styles.title}>📁 Grabaciones</h2>
          <button onClick={loadRecordings} className={styles.refreshButton}>
            <span role="img" aria-label="refresh">🔄</span> Actualizar
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
            <p>❌ {error}</p>
            <button onClick={loadRecordings} className={styles.retryButton}>
              Reintentar
            </button>
          </div>
        )}
        {transcribeError && (
          <div className={styles.error}>
            <p>❌ {transcribeError}</p>
          </div>
        )}
        {!loading && !error && recordings.length === 0 && (
          <div className={styles.noRecordings}>
            <h3>📭 No hay grabaciones</h3>
            <p>Crea tu primera grabación usando el botón de grabar.</p>
          </div>
        )}
        {!loading && !error && recordings.length > 0 && (
          <ul className={styles.recordingsList}>
            {recordings.map((recording) => {
              // Icono según nombre
              let icon = '🎤';
              if (/podcast/i.test(recording.name)) icon = '🎧';
              else if (/gama|clapper|video|cine/i.test(recording.name)) icon = '🎬';
              else if (/micro/i.test(recording.name)) icon = '🎙️';
              else if (/voz|voice/i.test(recording.name)) icon = '🔊';
              else if (/audio/i.test(recording.name)) icon = '🔈';

              // Duración
              let duration = recording.duration || durations[recording.id];
              let durationStr = duration ? `${Math.floor(duration/60).toString().padStart(2,'0')}:${Math.floor(duration%60).toString().padStart(2,'0')}` : '';

              return (
                <li key={recording.id} className={styles.item}>
                  <div className={styles.icon}>
                    <span role="img" aria-label="icon">{icon}</span>
                  </div>
                  <div className={styles.info}>
                    <div className={styles.name} onClick={() => onRecordingSelect(recording)}>{recording.name}</div>
                    <div className={styles.date} onClick={() => onRecordingSelect(recording)}>{recording.date}{durationStr && <span className={styles.duration}> · {durationStr}</span>}</div>
                    {recordingProjects[recording.id] && (
                      <div 
                        className={styles.projectBadge}
                        onClick={(e) => {
                          e.stopPropagation();
                          onNavigateToProject && onNavigateToProject(recordingProjects[recording.id]);
                        }}
                        style={{ cursor: 'pointer' }}
                        title="Ir al proyecto"
                      >
                        <span role="img" aria-label="folder">📁</span> {recordingProjects[recording.id].name}
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="currentColor" viewBox="0 0 256 256" style={{ display: 'inline-block', marginLeft: '4px', opacity: 0.7 }}>
                          <path d="M221.66,133.66l-72,72a8,8,0,0,1-11.32-11.32L196.69,136H40a8,8,0,0,1,0-16H196.69L138.34,61.66a8,8,0,0,1,11.32-11.32l72,72A8,8,0,0,1,221.66,133.66Z"></path>
                        </svg>
                      </div>
                    )}
                    {recording.hasTranscription && (
                      <div className={styles.transcriptionBadge} onClick={() => onRecordingSelect(recording)}><span role="img" aria-label="document">📄</span> Transcripción disponible</div>
                    )}
                  </div>
                  <div className={styles.actions}>
                    {!recording.hasTranscription && (
                      <button
                        className={styles.transcribe}
                        onClick={(e) => handleTranscribe(e, recording)}
                        disabled={!!transcribingId}
                        title={transcribingId ? 'Ya hay una transcripción en curso' : 'Transcribir grabación'}
                      >
                        {transcribingId === recording.id ? (
                          <span role="img" aria-label="transcribing">⏳</span>
                        ) : (
                          <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <circle cx="14" cy="14" r="14" fill="#f7b731"/>
                            <path d="M14 8a3 3 0 0 1 3 3v4a3 3 0 0 1-6 0v-4a3 3 0 0 1 3-3zm5 7a5 5 0 0 1-10 0" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            <path d="M14 19v2m-3 0h6" stroke="#fff" strokeWidth="2" strokeLinecap="round"/>
                          </svg>
                        )}
                      </button>
                    )}
                    <button
                      className={styles.play}
                      onClick={() => onRecordingSelect(recording)}
                      title="Reproducir o ver detalles"
                    >
                      <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <circle cx="14" cy="14" r="14" fill="#2563eb"/>
                        <polygon points="11,8 21,14 11,20" fill="#fff"/>
                      </svg>
                    </button>
                    <button
                      className={styles.delete}
                      onClick={(e) => handleDeleteClick(e, recording)}
                      title="Eliminar grabación"
                    >
                      <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <circle cx="14" cy="14" r="14" fill="#e92932"/>
                        <path d="M10 18L18 10M10 10l8 8" stroke="#fff" strokeWidth="2" strokeLinecap="round"/>
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