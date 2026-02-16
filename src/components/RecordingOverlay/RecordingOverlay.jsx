import { useState, useEffect, useRef } from 'react';
import { useDispatch } from 'react-redux';
import { saveAndExit } from '../../store/recordingSlice';
import styles from './RecordingOverlay.module.css';
import ProjectSelector from '../ProjectSelector/ProjectSelector';
import projectsService from '../../services/projectsService';
import recordingsService from '../../services/recordingsService';
import { MdStop, MdExpandMore, MdDeleteOutline } from 'react-icons/md';

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
  const [dbId, setDbId] = useState(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [newName, setNewName] = useState('');
  
  // Expanded State
  const [isExpanded, setIsExpanded] = useState(false);
  const interactionTimerRef = useRef(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setTime(prev => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Auto-collapse logic
  useEffect(() => {
    const resetTimer = () => {
      if (interactionTimerRef.current) clearTimeout(interactionTimerRef.current);
      if (isExpanded) {
        interactionTimerRef.current = setTimeout(() => {
          setIsExpanded(false);
        }, 20000); // 20s inactivity
      }
    };

    if (isExpanded) {
      window.addEventListener('mousemove', resetTimer);
      window.addEventListener('click', resetTimer);
      window.addEventListener('keydown', resetTimer);
      resetTimer(); // Start timer
    }

    return () => {
      window.removeEventListener('mousemove', resetTimer);
      window.removeEventListener('click', resetTimer);
      window.removeEventListener('keydown', resetTimer);
      if (interactionTimerRef.current) clearTimeout(interactionTimerRef.current);
    };
  }, [isExpanded]);

  const formatTime = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hrs > 0) {
      return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleFinish = (e) => {
    if(e) e.stopPropagation();
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
      const data = await recorder.stopAndSave(nameToSave);

      setProcessingComplete(true);
      setRecordingId(nameToSave);
      setDbId(data.dbId);

      setTimeout(() => {
        setShowProcessing(false);
        setProcessingComplete(false);
        setShowDetailsDialog(true);
      }, 1500);
    } catch (error) {
      console.error('Error al guardar:', error);
      setShowProcessing(false);
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

    if (newName && newName.trim() !== fileName) {
      try {
        const result = await recordingsService.renameRecording(fileName, newName.trim());
        if (result) {
          finalName = newName.trim();
        }
      } catch (error) {
        console.error('Error al renombrar:', error);
      }
    }

    if (selectedProject && dbId) {
      try {
        await projectsService.addRecordingToProject(selectedProject.id, dbId);
      } catch (error) {
        console.error('Error al agregar grabación al proyecto:', error);
      }
    }

    dispatch(saveAndExit(finalName));
    onFinish();
  };

  const handleDiscard = (e) => {
    if(e) e.stopPropagation();
    setShowDiscardDialog(true);
  };

  const confirmDiscard = () => {
    setShowDiscardDialog(false);
    setIsDiscarding(true);
    setShowProcessing(true);

    if (recorder && recorder.stopAndDiscard) {
      recorder.stopAndDiscard();
    } else if (recorder && recorder.stopMixedRecording) {
      recorder.stopMixedRecording();
    }

    setTimeout(() => {
      setShowProcessing(false);
      setIsDiscarding(false);
      dispatch(saveAndExit(''));
      onFinish();
    }, 1000);
  };

  const generateBars = (count) => {
    return Array.from({ length: count }, (_, i) => (
      <div
        key={i}
        className={styles.bar}
        style={{
          animationDelay: `${i * 0.1}s`,
          animationDuration: `${0.8 + Math.random() * 0.5}s` // Randomize slightly
        }}
      />
    ));
  };

  return (
    <>
      <div 
        className={`${styles.overlay} ${isExpanded ? styles.overlayExpanded : styles.overlayMinimized}`}
        onClick={() => !isExpanded && setIsExpanded(true)}
      >
        <div className={styles.container}>
          {isExpanded ? (
            // --- EXPANDED CARD ---
            <div className={styles.expandedContent}>
              <div className={styles.cardHeader}>
                <div className={styles.headerInfo}>
                  <div className={styles.dot}></div>
                  <span className={styles.recordingTitle}>New Recording</span>
                </div>
                <div className={styles.headerRight}>
                  <span className={styles.timerBadge}>{formatTime(time)}</span>
                  <button 
                    className={styles.collapseBtn}
                    onClick={(e) => { e.stopPropagation(); setIsExpanded(false); }}
                  >
                    <MdExpandMore size={20} />
                  </button>
                </div>
              </div>
              
              <div className={styles.statusLabel}>RECORDING</div>
              
              <div className={styles.visualizerLarge}>
                {generateBars(30)}
              </div>

              <div className={styles.cardActions}>
                <button className={styles.btnCancel} onClick={handleDiscard}>
                  <MdDeleteOutline size={18} /> Cancel
                </button>
                <button className={styles.btnStopSave} onClick={handleFinish}>
                  <MdStop size={20} /> Stop & Save
                </button>
              </div>
            </div>
          ) : (
            // --- MINIMIZED CAPSULE ---
            <div className={styles.minimizedContent}>
              <div className={styles.dot}></div>
              <div className={styles.capsuleInfo}>
                <span className={styles.capsuleLabel}>RECORDING</span>
                <span className={styles.capsuleTime}>{formatTime(time)}</span>
              </div>
              <div className={styles.visualizerSmall}>
                {generateBars(8)}
              </div>
              <button 
                className={styles.btnStopRound} 
                onClick={handleFinish}
              >
                <MdStop size={24} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* --- MODALS --- */}
      {showDetailsDialog && (
        <div className={styles.modalOverlay}>
            <div className={styles.modal}>
            
            {!showProjectSelector ? (
              // VISTA A: Formulario normal
              <>
                <h3>Detalles de la Grabación</h3>

                <div className={styles.inputContainer}>
                  <label className={styles.inputLabel}>Nombre</label>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Nombre de la grabación"
                    className={styles.input}
                  />
                </div>

                <div className={styles.projectContainer}>
                  <label className={styles.inputLabel}>Proyecto</label>
                  <div className={styles.projectSelector}>
                    <div className={styles.projectNameDisplay}>
                      {selectedProject ? selectedProject.name : 'Sin proyecto asignado'}
                    </div>
                    <button
                      onClick={() => setShowProjectSelector(true)}
                      className={styles.projectChangeButton}
                    >
                      {selectedProject ? 'Cambiar' : 'Seleccionar'}
                    </button>
                  </div>
                </div>

                <div className={styles.modalButtons}>
                  <button onClick={handleSaveDetails} className={styles.saveButton}>
                    Guardar y Salir
                  </button>
                </div>
              </>
            ) : (
              // VISTA B: Selector de Proyectos Embedido
              <ProjectSelector
                embedded={true}
                selectedProjectId={selectedProject?.id}
                onSelect={handleProjectSelected}
                onCancel={() => setShowProjectSelector(false)}
              />
            )}
            
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
              <button onClick={() => setShowDiscardDialog(false)} className={styles.cancelButton}>
                Cancelar
              </button>
              <button onClick={confirmDiscard} className={styles.discardModalButton}>
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
                <p>{isDiscarding ? 'Deteniendo grabación...' : 'Guardando archivos...'}</p>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default RecordingOverlay;
