import { useState, useEffect, useRef } from 'react';
import { useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { saveAndExit } from '../../store/recordingSlice';
import styles from './RecordingOverlay.module.css';
import ProjectSelector from '../ProjectSelector/ProjectSelector';
import projectsService from '../../services/projectsService';
import recordingsService from '../../services/recordingsService';
import { getSettings } from '../../services/settingsService';
import { MdStop, MdExpandMore, MdDeleteOutline, MdMic, MdMicOff, MdPictureInPicture } from 'react-icons/md';

const RecordingOverlay = ({ recorder, onFinish }) => {
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const [time, setTime] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
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
  const [extraInstructions, setExtraInstructions] = useState('');
  const [diarizationEnabled, setDiarizationEnabled] = useState(false);
  const [discardDiarization, setDiscardDiarization] = useState(false);
  const [showDiscardSavedDialog, setShowDiscardSavedDialog] = useState(false);

  // Expanded State
  const [isExpanded, setIsExpanded] = useState(false);
  const interactionTimerRef = useRef(null);

  // Floating widget state — true until user collapses it
  const [isFloatingVisible, setIsFloatingVisible] = useState(true);

  // Ref always pointing to latest handleFinish — fixes stale closure in relay listener
  const handleFinishRef = useRef(null);

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

  // Cargar si la diarización global está habilitada, para decidir si mostrar el checkbox de descarte
  useEffect(() => {
    getSettings().then((settings) => {
      setDiarizationEnabled(settings.enableDiarization === true);
    }).catch(console.error);
  }, []);

  // Show floating window on mount, hide on unmount
  useEffect(() => {
    window.electronAPI?.showFloatingWindow?.({ elapsed: 0, muted: false });
    return () => {
      window.electronAPI?.hideFloatingWindow?.();
    };
  }, []);

  // Listen for floating window collapsed by user
  useEffect(() => {
    if (!window.electronAPI?.onFloatingWindowHidden) return;
    return window.electronAPI.onFloatingWindowHidden(() => setIsFloatingVisible(false));
  }, []);

  // Listen for mute relay from floating widget
  useEffect(() => {
    if (!window.electronAPI?.onRelayToggleMute) return;
    return window.electronAPI.onRelayToggleMute(() => {
      if (recorder && recorder.toggleMute) {
        const muted = recorder.toggleMute();
        setIsMuted(muted);
        window.electronAPI?.notifyMuteState?.(muted);
      }
    });
  }, [recorder]);

  // Listen for stop relay from floating widget
  useEffect(() => {
    if (!window.electronAPI?.onRelayStopRecording) return;
    return window.electronAPI.onRelayStopRecording(() => {
      handleFinishRef.current?.();
    });
  }, []);

  // Listen for discard relay from floating widget — shows confirm dialog in main window
  useEffect(() => {
    if (!window.electronAPI?.onRelayDiscardRecording) return;
    return window.electronAPI.onRelayDiscardRecording(() => handleDiscard(null));
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

  const handleToggleMute = (e) => {
    if (e) e.stopPropagation();
    if (recorder && recorder.toggleMute) {
      const muted = recorder.toggleMute();
      setIsMuted(muted);
      window.electronAPI?.notifyMuteState?.(muted);
    }
  };

  const handleFinish = (e) => {
    if(e) e.stopPropagation();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const defaultName = `grabacion_${timestamp}`;
    setFileName(defaultName);
    setNewName(defaultName);
    handleSave(defaultName);
  };

  // Keep ref current on every render so relay listener always calls latest handleFinish
  handleFinishRef.current = handleFinish;

  const handleSave = async (nameToSave) => {
    setShowSaveDialog(false);
    setShowProcessing(true);

    try {
      const data = await recorder.stopAndSave(nameToSave);

      setProcessingComplete(true);
      setRecordingId(nameToSave);
      setDbId(data.dbId);

      // Tracking Sentry
      if (import.meta.env.VITE_SENTRY_DSN) {
        if (window.electronAPI && window.electronAPI.sentryLogInfo) {
          window.electronAPI.sentryLogInfo('Nueva grabación guardada con éxito');
        }
      }

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

    if (extraInstructions.trim() && dbId) {
      try {
        await recordingsService.saveExtraInstructions(dbId, extraInstructions.trim());
      } catch (error) {
        console.error('Error al guardar instrucciones extra:', error);
      }
    }

    try {
      const settings = await getSettings();
      if (settings.autoTranscribe !== false && dbId) {
        recordingsService.transcribeRecording(dbId, settings.whisperModel || null, { skipDiarization: discardDiarization }).catch(console.error);
      }
    } catch (error) {
      console.error('Error al verificar autoTranscribe:', error);
    }

    dispatch(saveAndExit(finalName));
    onFinish();
  };

  const handleDiscard = (e) => {
    if(e) e.stopPropagation();
    setShowDiscardDialog(true);
  };

  const handleDiscardSaved = (e) => {
    if(e) e.stopPropagation();
    setShowDiscardSavedDialog(true);
  };

  const confirmDiscardSaved = async () => {
    setShowDiscardSavedDialog(false);
    setShowDetailsDialog(false);
    setIsDiscarding(true);
    setShowProcessing(true);

    try {
      await recordingsService.deleteRecording(dbId);
    } catch (error) {
      console.error('Error al descartar la grabación guardada:', error);
    }

    setShowProcessing(false);
    setIsDiscarding(false);
    dispatch(saveAndExit(''));
    onFinish();
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
                  <span className={styles.recordingTitle}>{t('recordingOverlay.recording')}</span>
                </div>
                <div className={styles.headerRight}>
                  <span className={styles.timerBadge}>{formatTime(time)}</span>
                  {!isFloatingVisible && (
                    <button
                      className={styles.collapseBtn}
                      onClick={(e) => {
                        e.stopPropagation();
                        window.electronAPI?.showFloatingWindow({ elapsed: time, muted: isMuted });
                        setIsFloatingVisible(true);
                      }}
                      title="Mostrar widget flotante"
                    >
                      <MdPictureInPicture size={17} />
                    </button>
                  )}
                  <button
                    className={styles.collapseBtn}
                    onClick={(e) => { e.stopPropagation(); setIsExpanded(false); }}
                  >
                    <MdExpandMore size={20} />
                  </button>
                </div>
              </div>

              <div className={styles.statusLabel}>{t('recordingOverlay.recording').toUpperCase()}</div>

              <div className={styles.visualizerLarge}>
                {generateBars(30)}
              </div>

              <div className={styles.cardActions}>
                <button 
                  className={`${styles.btnMute} ${isMuted ? styles.btnMuted : ''}`} 
                  onClick={handleToggleMute}
                  title={isMuted ? t('recordingOverlay.unmute') : t('recordingOverlay.mute')}
                >
                  {isMuted ? <MdMicOff size={20} /> : <MdMic size={20} />}
                </button>
                <button className={styles.btnCancel} onClick={handleDiscard}>
                  <MdDeleteOutline size={18} /> {t('common.cancel')}
                </button>
                <button className={styles.btnStopSave} onClick={handleFinish}>
                  <MdStop size={20} /> {t('recordingOverlay.stopAndSave')}
                </button>
              </div>
            </div>
          ) : (
            // --- MINIMIZED CAPSULE ---
            <div className={styles.minimizedContent}>
              <div className={styles.dot}></div>
              <div className={styles.capsuleInfo}>
                <span className={styles.capsuleLabel}>{t('recordingOverlay.recording').toUpperCase()}</span>
                <span className={styles.capsuleTime}>{formatTime(time)}</span>
              </div>
              <button
                className={`${styles.btnMuteRound} ${isMuted ? styles.btnMuted : ''}`}
                onClick={handleToggleMute}
                title={isMuted ? t('recordingOverlay.unmute') : t('recordingOverlay.mute')}
              >
                {isMuted ? <MdMicOff size={16} /> : <MdMic size={16} />}
              </button>
              <button
                className={styles.btnDiscardRound}
                onClick={handleDiscard}
                title={t('recordingOverlay.confirmDiscardYes')}
              >
                <MdDeleteOutline size={16} />
              </button>
              <button
                className={styles.btnStopRound}
                onClick={handleFinish}
              >
                <MdStop size={24} />
              </button>
              {!isFloatingVisible && (
                <button
                  className={styles.btnFloatRound}
                  onClick={(e) => {
                    e.stopPropagation();
                    window.electronAPI?.showFloatingWindow({ elapsed: time, muted: isMuted });
                    setIsFloatingVisible(true);
                  }}
                  title="Mostrar widget flotante"
                >
                  <MdPictureInPicture size={15} />
                </button>
              )}
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
                <h3>{t('recordingOverlay.recordingDetails')}</h3>

                <div className={styles.inputContainer}>
                  <label className={styles.inputLabel}>{t('recordingOverlay.savingName')}</label>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder={t('recordingOverlay.savingName')}
                    className={styles.input}
                  />
                </div>

                <div className={styles.projectContainer}>
                  <label className={styles.inputLabel}>{t('recordingOverlay.project')}</label>
                  <div className={styles.projectSelector}>
                    <div className={styles.projectNameDisplay}>
                      {selectedProject ? selectedProject.name : t('recordingOverlay.noProject')}
                    </div>
                    <button
                      onClick={() => setShowProjectSelector(true)}
                      className={styles.projectChangeButton}
                    >
                      {selectedProject ? t('recordingOverlay.change') : t('recordingOverlay.selectProject')}
                    </button>
                  </div>
                </div>

                <div className={styles.inputContainer}>
                  <label className={styles.inputLabel}>{t('recordingOverlay.extraInstructions')}</label>
                  <textarea
                    value={extraInstructions}
                    onChange={(e) => setExtraInstructions(e.target.value)}
                    placeholder={t('recordingOverlay.extraInstructionsPlaceholder')}
                    className={styles.input}
                    rows={3}
                    style={{ resize: 'vertical', minHeight: '72px' }}
                  />
                </div>

                {diarizationEnabled && (
                  <div className={styles.inputContainer}>
                    <label className={styles.checkboxLabel}>
                      <input
                        type="checkbox"
                        checked={discardDiarization}
                        onChange={(e) => setDiscardDiarization(e.target.checked)}
                      />
                      {t('recordingOverlay.discardDiarization')}
                    </label>
                  </div>
                )}

                <div className={styles.modalButtons}>
                  <button onClick={handleDiscardSaved} className={styles.discardModalButton}>
                    {t('recordingOverlay.discardButton')}
                  </button>
                  <button onClick={handleSaveDetails} className={styles.saveButton}>
                    {t('recordingOverlay.saveAndExit')}
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
            <h3>{t('recordingOverlay.confirmDiscard')}</h3>
            <p>{t('recordingOverlay.confirmDiscardMessage')}</p>
            <div className={styles.modalButtons}>
              <button onClick={() => setShowDiscardDialog(false)} className={styles.cancelButton}>
                {t('common.cancel')}
              </button>
              <button onClick={confirmDiscard} className={styles.discardModalButton}>
                {t('recordingOverlay.confirmDiscardYes')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de confirmación de descarte de grabación ya guardada */}
      {showDiscardSavedDialog && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <h3>{t('recordingOverlay.confirmDiscard')}</h3>
            <p>{t('recordingOverlay.confirmDiscardMessage')}</p>
            <div className={styles.modalButtons}>
              <button onClick={() => setShowDiscardSavedDialog(false)} className={styles.cancelButton}>
                {t('common.cancel')}
              </button>
              <button onClick={confirmDiscardSaved} className={styles.discardModalButton}>
                {t('recordingOverlay.confirmDiscardYes')}
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
                <p>{t('recordingOverlay.processingComplete')}</p>
              </>
            ) : (
              <>
                <div className={styles.spinner}></div>
                <p>{isDiscarding ? t('recordingOverlay.stopping') : t('recordingOverlay.saving')}</p>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default RecordingOverlay;
