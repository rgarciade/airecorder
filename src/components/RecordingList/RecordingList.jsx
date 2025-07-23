import React, { useState } from 'react';
import styles from './RecordingList.module.css';
import { Clapperboard, Download, Trash2 } from 'lucide-react';

// Modal de confirmación para borrar grabación
function DeleteConfirmationModal({ recording, isOpen, onClose, onConfirm }) {
  const [inputName, setInputName] = useState('');
  
  const handleConfirm = () => {
    if (inputName.trim() === recording.name) {
      onConfirm(recording);
      setInputName('');
      onClose();
    }
  };

  const isNameMatch = inputName.trim() === recording.name;

  if (!isOpen) return null;

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

export default function RecordingList({ recordings = [], onDownload, onSelect, onDelete }) {
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, recording: null });

  const handleDeleteClick = (e, recording) => {
    e.stopPropagation();
    setDeleteModal({ isOpen: true, recording });
  };

  const handleDeleteConfirm = (recording) => {
    if (onDelete) {
      onDelete(recording);
    }
    // Aquí se implementará la lógica real de eliminación
    console.log('Eliminando grabación:', recording.name);
  };

  return (
    <div className={styles.list}>
      <h2 className={styles.title}>Past Recordings</h2>
      <ul>
        {recordings.map((rec) => (
          <li key={rec.id} className={styles.item}>
            <div className={styles.icon}><Clapperboard size={24} /></div>
            <div className={styles.info} onClick={() => onSelect(rec)}>
              <div className={styles.name}>{rec.name}</div>
              <div className={styles.date}>{rec.date}</div>
            </div>
            <div className={styles.actions}>
              <button className={styles.download} onClick={(e) => {
                e.stopPropagation();
                onDownload(rec);
              }}>
                <Download size={20} />
              </button>
              <button 
                className={styles.delete} 
                onClick={(e) => handleDeleteClick(e, rec)}
                title="Eliminar grabación"
              >
                <Trash2 size={20} />
              </button>
            </div>
          </li>
        ))}
      </ul>
      
      <DeleteConfirmationModal
        recording={deleteModal.recording}
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, recording: null })}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
} 