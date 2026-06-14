import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import speakersService from '../../services/speakersService';
import recordingsService from '../../services/recordingsService';
import ConfirmModal from '../../components/ConfirmModal/ConfirmModal';
import MergeSpeakerDialog from '../../components/Speakers/MergeSpeakerDialog';
import styles from './SpeakerDetail.module.css';

/**
 * Vista de detalle de un hablante.
 * Muestra info básica del speaker, lista de grabaciones donde aparece,
 * y hablantes similares con opción de merge.
 */
const SpeakerDetail = ({ speakerId, onBack, onNavigateToRecording, onNavigateToSpeaker }) => {
  const { t } = useTranslation();
  const [speaker, setSpeaker] = useState(null);
  const [recordings, setRecordings] = useState([]);
  const [similarSpeakers, setSimilarSpeakers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [playingAudio, setPlayingAudio] = useState(null); // { key, audio }
  const [mergeStatus, setMergeStatus] = useState(null); // { success, message }
  const [mergeModal, setMergeModal] = useState(null); // { similar } — null = cerrado
  const [deleteModal, setDeleteModal] = useState(null); // { recording } — null = cerrado
  const [deleteStatus, setDeleteStatus] = useState(null); // { success, message }
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [allSpeakers, setAllSpeakers] = useState([]);
  const [allSpeakersLoading, setAllSpeakersLoading] = useState(false);
  const audioRef = useRef(null);

  const loadData = useCallback(async () => {
    if (!speakerId) return;
    setLoading(true);
    setNotFound(false);
    setMergeStatus(null);
    try {
      const result = await speakersService.getSpeakerRecordings(speakerId);
      if (!result) {
        setNotFound(true);
        return;
      }
      const allRecordings = await recordingsService.getRecordings();
      const resolveAudioForRecording = (recordingRef, fallbackDbId = null) => {
        if (!recordingRef) return { audioUrl: null, dbRecordingId: fallbackDbId };

        const recording = allRecordings.find((r) =>
          r.id === recordingRef
          || r.name === recordingRef
          || r.dbId === fallbackDbId
          || r.id === fallbackDbId
        );

        if (!recording || !recording.path || !recording.files || recording.files.length === 0) {
          return { audioUrl: null, dbRecordingId: fallbackDbId || recording?.dbId || null };
        }

        // Priorizar audio del sistema (los timestamps de diarización corresponden a esta pista)
        const audioExtensions = /\.(wav|mp3|webm|m4a|ogg|aac|flac)$/i;
        const systemFile = recording.files.find((f) => /-system\.\w+$/i.test(f) && audioExtensions.test(f));
        const micFile = recording.files.find((f) => /-microphone\.\w+$/i.test(f) && audioExtensions.test(f));
        const anyAudioFile = recording.files.find((f) => audioExtensions.test(f));
        const audioFile = systemFile || micFile || anyAudioFile;

        if (!audioFile) {
          return { audioUrl: null, dbRecordingId: fallbackDbId || recording.dbId || null };
        }

        const safePath = [recording.path, audioFile].join('/');
        return {
          audioUrl: `media://${safePath}`,
          dbRecordingId: fallbackDbId || recording.dbId || null
        };
      };

      const recordingsWithAudio = (result.recordings || []).map((rec) => {
        const resolved = resolveAudioForRecording(rec.relative_path, rec.id);
        return {
          ...rec,
          audioUrl: resolved.audioUrl,
          dbRecordingId: resolved.dbRecordingId || rec.id
        };
      });

      setSpeaker(result.speaker);
      setRecordings(recordingsWithAudio);

      // Cargar speakers similares
      const similar = await speakersService.getSimilarSpeakers(speakerId, 5);
      const similarWithAudio = similar.map((sim) => {
        if (!sim.recordingPath) {
          return { ...sim, audioUrl: null, dbRecordingId: sim.recordingId };
        }

        const resolved = resolveAudioForRecording(sim.recordingPath, sim.recordingId);
        return {
          ...sim,
          audioUrl: resolved.audioUrl,
          dbRecordingId: resolved.dbRecordingId
        };
      });

      setSimilarSpeakers(similarWithAudio);
    } catch (error) {
      console.error('[SpeakerDetail] Error cargando datos:', error);
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [speakerId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleOpenLinkDialog = () => {
    if (!speaker?.id) return;
    setLinkDialogOpen(true);
  };

  // Cargar todos los speakers disponibles para el diálogo de vinculación
  useEffect(() => {
    const loadAllSpeakers = async () => {
      setAllSpeakersLoading(true);
      try {
        const speakers = await speakersService.getSpeakersWithRecordings();
        setAllSpeakers(speakers);
      } catch (err) {
        console.warn('[SpeakerDetail] No se pudieron cargar los speakers:', err);
      } finally {
        setAllSpeakersLoading(false);
      }
    };
    loadAllSpeakers();
  }, []);

  const availableLinkTargets = allSpeakers.filter((item) => item.id !== speakerId);
  const linkDisabled = allSpeakersLoading || availableLinkTargets.length === 0;

  // Limpiar audio al cambiar de speaker o desmontar
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      setPlayingAudio(null);
    };
  }, [speakerId]);

  // Auto-ocultar mensaje de merge tras 4 segundos
  useEffect(() => {
    if (mergeStatus) {
      const timer = setTimeout(() => setMergeStatus(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [mergeStatus]);

  // Auto-ocultar mensaje de eliminación tras 4 segundos
  useEffect(() => {
    if (deleteStatus) {
      const timer = setTimeout(() => setDeleteStatus(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [deleteStatus]);

  const handleBack = () => onBack();

  const handleRecordingClick = (recording) => {
    if (onNavigateToRecording) {
      onNavigateToRecording(recording.id);
    }
  };

  const handlePlayVoice = async ({ playKey, speakerId: voiceSpeakerId, dbRecordingId, audioUrl }) => {
    // Si ya está reproduciendo este item, parar
    if (playingAudio?.key === playKey) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      setPlayingAudio(null);
      return;
    }

    // Parar audio anterior si existe
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }

    if (!audioUrl) return;

    const audio = new Audio(audioUrl);
    audioRef.current = audio;

    // Obtener el timestamp del primer segmento de este hablante en esta grabación
    // para hacer seek al punto donde empieza a hablar
    let startTime = 0;
    if (dbRecordingId && voiceSpeakerId) {
      try {
        const segmentInfo = await speakersService.getSpeakerFirstSegmentTime(voiceSpeakerId, dbRecordingId);
        if (segmentInfo?.startTime) {
          startTime = segmentInfo.startTime;
        }
      } catch (err) {
        console.warn('[SpeakerDetail] No se pudo obtener timestamp del segmento:', err);
      }
    }

    // Marcar como reproduciendo inmediatamente para feedback visual
    setPlayingAudio({ key: playKey, audio });

    // Esperar a que el audio cargue los metadatos antes de hacer seek
    const seekAndPlay = () => {
      if (startTime > 0) {
        audio.currentTime = startTime;
      }
      audio.play().catch(() => {});
    };

    // Si el audio ya está cargado suficientemente, hacer seek directo
    if (audio.readyState >= 1) {
      seekAndPlay();
    } else {
      // Esperar a que cargue los metadatos antes de hacer seek
      audio.addEventListener('loadedmetadata', seekAndPlay, { once: true });
    }

    // Parar después de 5 segundos desde que empezó la reproducción
    audio.ontimeupdate = () => {
      if (startTime > 0 && audio.currentTime >= startTime + 5) {
        audio.pause();
        audio.currentTime = 0;
        setPlayingAudio(null);
      } else if (startTime === 0 && audio.currentTime >= 5) {
        audio.pause();
        audio.currentTime = 0;
        setPlayingAudio(null);
      }
    };

    audio.onended = () => {
      setPlayingAudio(null);
    };
  };

  const handleNavigateToSimilarSpeaker = (similarSpeakerId) => {
    if (onNavigateToSpeaker) {
      onNavigateToSpeaker(similarSpeakerId);
    }
  };

  const handleMergeSimilarSpeaker = (similarSpeaker) => {
    if (!speakerId || !similarSpeaker.id) return;
    setMergeModal(similarSpeaker);
  };

  const handleConfirmMerge = async () => {
    const similar = mergeModal;
    if (!similar) return;

    const result = await speakersService.mergeSimilarSpeaker(speakerId, similar.id);
    setMergeModal(null);

    if (result.success) {
      setMergeStatus({
        success: true,
        message: t('speakerDetail.mergeSuccess', {
          source: similar.displayName,
          target: result.mergedName
        })
      });
      await loadData();
    } else {
      setMergeStatus({
        success: false,
        message: t('speakerDetail.mergeError', { error: result.error })
      });
    }
  };

  const handleDeleteEmbedding = (recording) => {
    if (!speakerId || !recording?.id) return;
    setDeleteModal(recording);
  };

  const handleConfirmDelete = async () => {
    const recording = deleteModal;
    if (!recording) return;

    const result = await speakersService.deleteSpeakerRecordingResolution(speakerId, recording.id);
    setDeleteModal(null);

    if (result.success) {
      setDeleteStatus({
        success: true,
        message: t('speakerDetail.recordingRemoved', {
          recording: recording.recordingName || recording.relative_path?.split('/').pop() || 'Grabación'
        })
      });
      await loadData();
    } else {
      setDeleteStatus({
        success: false,
        message: t('speakerDetail.recordingRemoveError', { error: result.error })
      });
    }
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>{t('common.loading', 'Cargando...')}</div>
      </div>
    );
  }

  if (notFound || !speaker) {
    return (
      <div className={styles.container}>
        <button className={styles.backButton} onClick={handleBack}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
          {t('speakerDetail.back')}
        </button>
        <div className={styles.notFound}>
          <p>{t('speakerDetail.notFound')}</p>
        </div>
      </div>
    );
  }

  // Formatear fecha
  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    try {
      return new Date(dateStr).toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  // Formatear duración
  const formatDuration = (seconds) => {
    if (!seconds) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <>
    <div className={styles.container}>
      <button className={styles.backButton} onClick={handleBack}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="15 18 9 12 15 6"></polyline>
        </svg>
        {t('speakerDetail.back')}
      </button>

      <div className={styles.header}>
        <div className={styles.avatar}>
          {(speaker.displayName || '?').charAt(0).toUpperCase()}
        </div>
        <div className={styles.info}>
          <h1 className={styles.name}>
            {speaker.displayName || t('speakers.unknown', 'Desconocido')}
          </h1>
          <div className={styles.stats}>
            <span className={styles.stat}>
              <strong>{recordings.length}</strong> {t('speakerDetail.totalRecordings')}
            </span>
            <span className={styles.stat}>
              {speaker.createdAt && (
                <>{t('speakerDetail.createdAt')}: {formatDate(speaker.createdAt)}</>
              )}
            </span>
          </div>
        </div>
        <div className={styles.headerActions}>
          <button
            className={styles.linkBtn}
            onClick={handleOpenLinkDialog}
            disabled={linkDisabled || loading}
            title={linkDisabled || loading
              ? t('speakerDetail.linkDisabled', 'Cargando hablantes disponibles o no hay candidatos para vincular')
              : t('speakerDetail.linkBtn', 'Vincular')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
            </svg>
            {loading ? t('common.loading', 'Cargando...') : t('speakerDetail.linkBtn', 'Vincular')}
          </button>
        </div>
      </div>

      {linkDisabled && (
        <div className={styles.linkHint}>
          {allSpeakersLoading
            ? t('speakerDetail.linkLoading', 'Cargando hablantes disponibles...')
            : t('speakerDetail.linkNoCandidates', 'No hay otros hablantes disponibles para vincular.')}
        </div>
      )}

      <div className={styles.recordingsSection}>
        <h2 className={styles.sectionTitle}>{t('speakerDetail.recordingsList')}</h2>
        {recordings.length === 0 ? (
          <p className={styles.emptyText}>{t('speakerDetail.noRecordings')}</p>
        ) : (
          <div className={styles.recordingsList}>
            {recordings.map((rec) => {
              const playKey = `recording:${rec.id}`;
              return (
              <div
                key={rec.id}
                className={styles.recordingRow}
                onClick={() => handleRecordingClick(rec)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleRecordingClick(rec);
                  }
                }}
              >
                {rec.audioUrl && (
                    <button
                      className={`${styles.playVoiceBtn} ${playingAudio?.key === playKey ? styles.playing : ''}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePlayVoice({
                          playKey,
                          speakerId,
                          dbRecordingId: rec.dbRecordingId || rec.id,
                          audioUrl: rec.audioUrl
                        });
                      }}
                      title={playingAudio?.key === playKey ? 'Detener' : 'Escuchar voz'}
                    >
                      {playingAudio?.key === playKey ? (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                          <rect x="6" y="4" width="4" height="16"></rect>
                          <rect x="14" y="4" width="4" height="16"></rect>
                        </svg>
                      ) : (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                          <polygon points="5 3 19 12 5 21 5 3"></polygon>
                        </svg>
                      )}
                    </button>
                  )}
                  <button
                    className={styles.deleteEmbeddingBtn}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteEmbedding(rec);
                    }}
                    title={t('speakerDetail.deleteEmbedding', 'Eliminar embedding')}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M3 6h18"></path>
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"></path>
                      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                  </button>
                  <div className={styles.recordingInfo}>
                  <span className={styles.recordingName}>
                    {rec.recordingName || rec.relative_path?.split('/').pop() || 'Sin nombre'}
                  </span>
                  <span className={styles.recordingMeta}>
                    {formatDate(rec.confirmed_at || rec.created_at)} · {formatDuration(rec.duration)}
                  </span>
                </div>
                <div className={styles.recordingArrow}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="9 18 15 12 9 6"></polyline>
                  </svg>
                </div>
               </div>
              );
            })}
          </div>
        )}
      </div>

      {mergeStatus && (
        <div className={`${styles.mergeMessage} ${mergeStatus.success ? styles.mergeSuccess : styles.mergeError}`}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {mergeStatus.success ? (
              <polyline points="20 6 9 17 4 12"></polyline>
            ) : (
              <line x1="18" y1="6" x2="6" y2="18"></line>
            )}
          </svg>
          <span>{mergeStatus.message}</span>
        </div>
      )}

      {deleteStatus && (
        <div className={`${styles.mergeMessage} ${deleteStatus.success ? styles.mergeSuccess : styles.mergeError}`}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {deleteStatus.success ? (
              <polyline points="20 6 9 17 4 12"></polyline>
            ) : (
              <line x1="18" y1="6" x2="6" y2="18"></line>
            )}
          </svg>
          <span>{deleteStatus.message}</span>
        </div>
      )}

      {similarSpeakers.length > 0 && (
        <div className={styles.similarSection}>
          <h2 className={styles.sectionTitle}>{t('speakerDetail.similarSpeakers')}</h2>
          <div className={styles.similarList}>
            {similarSpeakers.map((sim) => (
              <div
                key={sim.id}
                className={styles.similarRow}
                onClick={() => handleNavigateToSimilarSpeaker(sim.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleNavigateToSimilarSpeaker(sim.id);
                  }
                }}
              >
                <div className={styles.similarAvatar}>
                  {(sim.displayName || '?').charAt(0).toUpperCase()}
                </div>
                <div className={styles.similarInfo}>
                  <span className={styles.similarName}>{sim.displayName || t('speakers.unknown', 'Desconocido')}</span>
                  <span className={styles.similarity}>
                    {Math.round(sim.similarity * 100)}% {t('speakerDetail.similarity')}
                  </span>
                </div>
                {sim.audioUrl && (
                  <button
                    className={`${styles.playVoiceBtn} ${playingAudio?.key === `similar:${sim.id}` ? styles.playing : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePlayVoice({
                        playKey: `similar:${sim.id}`,
                        speakerId: sim.id,
                        dbRecordingId: sim.dbRecordingId,
                        audioUrl: sim.audioUrl
                      });
                    }}
                    title={playingAudio?.key === `similar:${sim.id}` ? 'Detener' : 'Escuchar voz'}
                  >
                    {playingAudio?.key === `similar:${sim.id}` ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <rect x="6" y="4" width="4" height="16"></rect>
                        <rect x="14" y="4" width="4" height="16"></rect>
                      </svg>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <polygon points="5 3 19 12 5 21 5 3"></polygon>
                      </svg>
                    )}
                  </button>
                )}
                <button
                  className={styles.mergeBtn}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleMergeSimilarSpeaker(sim);
                  }}
                  title={t('speakerDetail.mergeTooltip', 'Fusionar en este hablante')}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M8 6l4 4 4-4"></path>
                    <path d="M12 2v8"></path>
                    <path d="M16 14v4a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-4"></path>
                  </svg>
                </button>
                <div className={styles.similarArrow}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="9 18 15 12 9 6"></polyline>
                  </svg>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>

    {mergeModal && (
      <ConfirmModal
        isOpen={true}
        title={t('speakerDetail.mergeModalTitle', 'Fusionar hablante')}
        message={(
          <Trans
            i18nKey="speakerDetail.mergeConfirmRich"
            values={{
              source: mergeModal.displayName,
              target: speaker.displayName
            }}
            components={{
              strong: <strong />,
              br: <br />
            }}
          />
        )}
        confirmText={t('speakerDetail.mergeBtn', 'Fusionar')}
        cancelText={t('common.cancel', 'Cancelar')}
        onConfirm={handleConfirmMerge}
        onCancel={() => setMergeModal(null)}
      />
    )}

    {deleteModal && (
      <ConfirmModal
        isOpen={true}
        title={t('speakerDetail.deleteEmbeddingTitle', 'Eliminar embedding')}
        message={t('speakerDetail.deleteEmbeddingConfirm', {
          recording: deleteModal.recordingName || deleteModal.relative_path?.split('/').pop() || 'esta grabación'
        })}
        confirmText={t('speakerDetail.deleteEmbeddingBtn', 'Eliminar')}
        cancelText={t('common.cancel', 'Cancelar')}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteModal(null)}
        isDanger={true}
      />
    )}

    {linkDialogOpen && (
      <MergeSpeakerDialog
        isOpen={true}
        sourceSpeaker={speaker}
        availableSpeakers={availableLinkTargets}
        onConfirm={(result) => {
          setLinkDialogOpen(false);
          setMergeStatus({
            success: true,
            message: t('speakerDetail.linkSuccess', {
              target: result.mergedName
            })
          });
          // Navegar al listado de hablantes después del merge
          if (onBack) {
            onBack();
          }
        }}
        onCancel={() => setLinkDialogOpen(false)}
      />
    )}
    </>
  );
};

export default SpeakerDetail;
