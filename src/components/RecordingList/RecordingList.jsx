import React, { useState, useEffect } from 'react';
import styles from './RecordingList.module.css';
import recordingsService from '../../services/recordingsService';
import TranscriptionViewer from '../TranscriptionViewer/TranscriptionViewer';

// Modal de confirmación para borrar grabación
function DeleteConfirmationModal({ recording, isOpen, onClose, onConfirm }) {
  const [inputName, setInputName] = useState('');
  
  const handleConfirm = () => {
    if (recording && inputName.trim() === recording.name) {
      onConfirm(recording);
      setInputName('');
      onClose();
    }
  };

  const isNameMatch = recording && inputName.trim() === recording.name;

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
            Escribe el nombre de la grabación para confirmar:
          </label>
          <input
            type="text"
            value={inputName}
            onChange={(e) => setInputName(e.target.value)}
            placeholder={recording.name}
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
            disabled={!isNameMatch}
            className={`${styles.deleteButton} ${!isNameMatch ? styles.disabled : ''}`}
          >
            Eliminar
          </button>
        </div>
      </div>
    </div>
  );
}

export default function RecordingList({ onRecordingSelect }) {
  const [recordings, setRecordings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, recording: null });
  const [transcribingId, setTranscribingId] = useState(null);
  const [transcribeError, setTranscribeError] = useState(null);

  useEffect(() => {
    loadRecordings();
  }, []);

  const loadRecordings = async () => {
    try {
      setLoading(true);
      setError(null);
      const recordingsList = await recordingsService.getRecordings();
      setRecordings(recordingsList);
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
            🔄 Actualizar
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
            {recordings.map((recording) => (
              <li key={recording.id} className={styles.item}>
                <div className={styles.icon}>
                  <span role="img" aria-label="recording">🎬</span>
                </div>
                <div className={styles.info} onClick={() => onRecordingSelect(recording)}>
                  <div className={styles.name}>{recording.name}</div>
                  <div className={styles.date}>{recording.date}</div>
                  {recording.hasTranscription && (
                    <div className={styles.transcriptionBadge}>📝 Transcripción disponible</div>
                  )}
                </div>
                <div className={styles.actions}>
                  {!recording.hasTranscription && (
                    <button
                      className={styles.download}
                      onClick={(e) => handleTranscribe(e, recording)}
                      disabled={!!transcribingId}
                      title={transcribingId ? 'Ya hay una transcripción en curso' : 'Transcribir grabación'}
                    >
                      {transcribingId === recording.id ? (
                        <span role="img" aria-label="transcribing">⏳ Transcribiendo...</span>
                      ) : (
                        <span role="img" aria-label="transcribe">📝 Transcribir</span>
                      )}
                    </button>
                  )}
                  <button 
                    className={styles.download} 
                    onClick={(e) => handleDownload(e, recording)}
                    title="Descargar grabación"
                  >
                    <span role="img" aria-label="download">⬇️</span>
                  </button>
                  <button 
                    className={styles.delete} 
                    onClick={(e) => handleDeleteClick(e, recording)}
                    title="Eliminar grabación"
                  >
                    <span role="img" aria-label="delete">🗑️</span>
                  </button>
                </div>
              </li>
            ))}
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