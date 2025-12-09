import { useState, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { saveAndExit } from '../../store/recordingSlice';
import styles from './RecordingOverlay.module.css';
import ProjectSelector from '../ProjectSelector/ProjectSelector';
import projectsService from '../../services/projectsService';
import recordingsService from '../../services/recordingsService';

const RecordingOverlay = ({ recorder, onFinish }) => {
  const dispatch = useDispatch();
  const [time, setTime] = useState(0);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [fileName, setFileName] = useState('');
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);
  const [showProcessing, setShowProcessing] = useState(false);
  const [processingComplete, setProcessingComplete] = useState(false);
  const [isDiscarding, setIsDiscarding] = useState(false);
  const [showProjectSelector, setShowProjectSelector] = useState(false);
  const [selectedProject, setSelectedProject] = useState(null);
  const [recordingId, setRecordingId] = useState(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [newName, setNewName] = useState('');

  useEffect(() => {
    const interval = setInterval(() => {
      setTime(prev => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const formatTime = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hrs > 0) {
      return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleFinish = () => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const defaultName = `grabacion_${timestamp}`;
    setFileName(defaultName);
    setNewName(defaultName);
    handleSave(defaultName);
  };

  const handleSave = async (nameToSave) => {
    setShowSaveDialog(false);
    setShowProcessing(true);

    try {
      // Usar el nuevo método stopAndSave con nombre personalizado
      await recorder.stopAndSave(nameToSave);

      setProcessingComplete(true);
      setRecordingId(nameToSave);

      setTimeout(() => {
        setShowProcessing(false);
        setProcessingComplete(false);
        // Mostrar diálogo de detalles
        setShowDetailsDialog(true);
      }, 1500);
    } catch (error) {
      console.error('Error al guardar:', error);
      setShowProcessing(false);
      // Aunque haya error, cerrar el overlay
      dispatch(saveAndExit(''));
      onFinish();
    }
  };

  const handleProjectSelected = (project) => {
    if (project) {
      setSelectedProject(project);
    }
    setShowProjectSelector(false);
  };

  const handleSaveDetails = async () => {
    let finalName = fileName;

    // 1. Renombrar si es necesario
    if (newName && newName.trim() !== fileName) {
      try {
        const result = await recordingsService.renameRecording(fileName, newName.trim());
        if (result) {
          finalName = newName.trim();
        }
      } catch (error) {
        console.error('Error al renombrar:', error);
        alert('Error al renombrar la grabación. Se mantendrá el nombre original.');
      }
    }

    // 2. Asignar proyecto si se seleccionó
    if (selectedProject && finalName) {
      try {
        await projectsService.addRecordingToProject(selectedProject.id, finalName);
        console.log(`Grabación ${finalName} agregada al proyecto ${selectedProject.name}`);
      } catch (error) {
        console.error('Error al agregar grabación al proyecto:', error);
      }
    }

    // Actualizar Redux para cerrar el overlay
    dispatch(saveAndExit(finalName));
    onFinish();
  };

  const handleDiscard = () => {
    setShowDiscardDialog(true);
  };

  const confirmDiscard = () => {
    setShowDiscardDialog(false);
    setIsDiscarding(true);
    setShowProcessing(true);

    // Descartar la grabación sin guardar
    if (recorder && recorder.stopAndDiscard) {
      recorder.stopAndDiscard();
    } else if (recorder && recorder.stopMixedRecording) {
      // Fallback para compatibilidad
      recorder.stopMixedRecording();
    }

    setTimeout(() => {
      setShowProcessing(false);
      setIsDiscarding(false);
      // Actualizar Redux para cerrar el overlay
      dispatch(saveAndExit(''));
      onFinish();
    }, 1000);
  };

  const generateBars = () => {
    return Array.from({ length: 20 }, (_, i) => (
      <div
        key={i}
        className={styles.bar}
        style={{
          animationDelay: `${i * 0.15}s`,
          animationDuration: `${1.5 + (i % 3) * 0.3}s`
        }}
      />
    ));
  };

  return (
    <>
      <div className={styles.overlay}>
        <div className={styles.container}>
          <div className={styles.content}>
            <div className={styles.indicator}></div>

            <div className={styles.visualizer}>
              {generateBars()}
            </div>

            <div className={styles.time}>
              {formatTime(time)}
            </div>

            <div className={styles.controls}>
              <button
                className={`${styles.button} ${styles.finishButton}`}
                onClick={handleFinish}
                title="Finalizar y guardar"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="4" width="4" height="16" />
                  <rect x="14" y="4" width="4" height="16" />
                </svg>
              </button>

              <button
                className={`${styles.button} ${styles.discardButton}`}
                onClick={handleDiscard}
                title="Descartar grabación"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.3 5.71a.996.996 0 0 0-1.41 0L12 10.59 7.11 5.7A.996.996 0 1 0 5.7 7.11L10.59 12 5.7 16.89a.996.996 0 1 0 1.41 1.41L12 13.41l4.89 4.89a.996.996 0 1 0 1.41-1.41L13.41 12l4.89-4.89c.38-.38.38-1.02 0-1.4z" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de Detalles (Nombre y Proyecto) */}
      {showDetailsDialog && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <h3>Detalles de la Grabación</h3>

            <div className="mb-4 w-full">
              <label className="block text-left text-sm text-gray-400 mb-1">Nombre</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Nombre de la grabación"
                className={styles.input}
              />
            </div>

            <div className="mb-6 w-full">
              <label className="block text-left text-sm text-gray-400 mb-1">Proyecto</label>
              <div className="flex gap-2">
                <div className="flex-1 bg-[#331a1b] border border-[#472426] rounded px-3 py-2 text-white truncate">
                  {selectedProject ? selectedProject.name : 'Sin proyecto asignado'}
                </div>
                <button
                  onClick={() => setShowProjectSelector(true)}
                  className="px-3 py-2 bg-[#472426] text-white rounded hover:bg-[#663336] transition-colors text-sm"
                >
                  {selectedProject ? 'Cambiar' : 'Seleccionar'}
                </button>
              </div>
            </div>

            <div className={styles.modalButtons}>
              <button
                onClick={handleSaveDetails}
                className={styles.saveButton}
              >
                Guardar y Salir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de confirmación de descarte */}
      {showDiscardDialog && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <h3>¿Detener sin guardar?</h3>
            <p>Se perderá la grabación actual.</p>
            <div className={styles.modalButtons}>
              <button
                onClick={() => setShowDiscardDialog(false)}
                className={styles.cancelButton}
              >
                Cancelar
              </button>
              <button
                onClick={confirmDiscard}
                className={styles.discardModalButton}
              >
                Sí, detener
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de procesamiento */}
      {showProcessing && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            {processingComplete ? (
              <>
                <div className={styles.checkIcon}>✓</div>
                <p>Archivos guardados correctamente</p>
              </>
            ) : (
              <>
                <div className={styles.spinner}></div>
                <p>{isDiscarding ? 'Deteniendo grabación...' : 'Guardando archivos separados...'}</p>
                <p className={styles.subtitle}>Por favor, no cierres la aplicación</p>
              </>
            )}
          </div>
        </div>
      )}

      {/* Selector de proyecto */}
      {showProjectSelector && (
        <ProjectSelector
          onSelect={handleProjectSelected}
          onCancel={() => handleProjectSelected(null)}
        />
      )}
    </>
  );
};

export default RecordingOverlay; 