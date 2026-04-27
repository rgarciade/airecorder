/**
 * SpeakerSuggestions.jsx
 *
 * Banner que aparece encima de la transcripción cuando el sistema ha detectado
 * hablantes cuya similitud de voz está cerca del umbral de confirmación automática
 * (entre 0.70 y 0.85).
 *
 * Para cada sugerencia muestra:
 *   - El nombre del hablante actual asignado (temporal).
 *   - El nombre del candidato que el sistema cree que podría ser.
 *   - La puntuación de similitud (%).
 *   - Un mini-reproductor de audio que reproduce 5 segundos desde el primer
 *     segmento del hablante para que el usuario pueda escuchar y decidir.
 *   - Botones "Sí, es él" y "No es él".
 */

import React, { useRef, useState, useCallback } from 'react';
import styles from './SpeakerSuggestions.module.css';

/**
 * Formatea segundos como mm:ss
 * @param {number} secs
 * @returns {string}
 */
function formatTime(secs) {
  if (secs == null || isNaN(secs)) return '--:--';
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * @typedef {Object} Suggestion
 * @property {string}      ephemeralId            - "SPEAKER_00"
 * @property {string}      candidateSpeakerId     - UUID del candidato
 * @property {string}      candidateDisplayName   - Nombre del candidato
 * @property {number}      similarity             - 0.70 – 0.85
 * @property {number|null} firstSegmentStart      - Segundos desde el inicio del audio
 * @property {string}      currentDisplayName     - Nombre temporal asignado ahora
 * @property {string}      currentSpeakerId       - UUID del perfil temporal
 */

/**
 * @param {Object} props
 * @param {Suggestion[]} props.suggestions
 * @param {number}       props.recordingId
 * @param {string|null}  props.audioSrc          - URL media:// del archivo de audio
 * @param {Function}     props.onConfirmed       - cb({ ephemeralId, confirmedSpeakerId, displayName })
 * @param {Function}     props.onDismissed       - cb(ephemeralId)
 */
export default function SpeakerSuggestions({
  suggestions = [],
  recordingId,
  audioSrc = null,
  onConfirmed,
  onDismissed,
}) {
  const audioRef = useRef(null);
  const [playingId, setPlayingId] = useState(null);
  const [loadingId, setLoadingId] = useState(null);
  const [dismissed, setDismissed] = useState(new Set());
  const [confirming, setConfirming] = useState(new Set());

  const visible = suggestions.filter((s) => !dismissed.has(s.ephemeralId));

  const handlePlay = useCallback(
    (suggestion) => {
      if (!audioSrc || suggestion.firstSegmentStart == null) return;

      const audio = audioRef.current;
      if (!audio) return;

      if (playingId === suggestion.ephemeralId) {
        // Toggle: pausar si ya está reproduciendo
        audio.pause();
        setPlayingId(null);
        return;
      }

      setLoadingId(suggestion.ephemeralId);
      audio.src = audioSrc;
      audio.currentTime = suggestion.firstSegmentStart;

      const stopAt = suggestion.firstSegmentStart + 5;

      const onTimeUpdate = () => {
        if (audio.currentTime >= stopAt) {
          audio.pause();
          audio.removeEventListener('timeupdate', onTimeUpdate);
          setPlayingId(null);
        }
      };

      audio.addEventListener('timeupdate', onTimeUpdate);

      audio
        .play()
        .then(() => {
          setLoadingId(null);
          setPlayingId(suggestion.ephemeralId);
        })
        .catch((err) => {
          console.error('[SpeakerSuggestions] Error reproduciendo audio:', err);
          setLoadingId(null);
          setPlayingId(null);
          audio.removeEventListener('timeupdate', onTimeUpdate);
        });
    },
    [audioSrc, playingId]
  );

  const handleConfirm = useCallback(
    async (suggestion) => {
      if (!window.electronAPI?.confirmSpeakerSuggestion) return;
      setConfirming((prev) => new Set(prev).add(suggestion.ephemeralId));

      try {
        const result = await window.electronAPI.confirmSpeakerSuggestion({
          recordingId,
          ephemeralId: suggestion.ephemeralId,
          confirmedSpeakerId: suggestion.candidateSpeakerId,
          currentSpeakerId: suggestion.currentSpeakerId,
        });

        if (result?.success) {
          setDismissed((prev) => new Set(prev).add(suggestion.ephemeralId));
          onConfirmed?.({
            ephemeralId: suggestion.ephemeralId,
            confirmedSpeakerId: suggestion.candidateSpeakerId,
            displayName: result.displayName || suggestion.candidateDisplayName,
          });
        } else {
          console.error('[SpeakerSuggestions] Error confirmando:', result?.error);
        }
      } finally {
        setConfirming((prev) => {
          const next = new Set(prev);
          next.delete(suggestion.ephemeralId);
          return next;
        });
      }
    },
    [recordingId, onConfirmed]
  );

  const handleDismiss = useCallback(
    (suggestion) => {
      setDismissed((prev) => new Set(prev).add(suggestion.ephemeralId));
      // Detener audio si este hablante estaba reproduciendo
      if (playingId === suggestion.ephemeralId && audioRef.current) {
        audioRef.current.pause();
        setPlayingId(null);
      }
      onDismissed?.(suggestion.ephemeralId);
    },
    [playingId, onDismissed]
  );

  if (visible.length === 0) return null;

  return (
    <div className={styles.container}>
      {/* Audio oculto compartido para todos los fragmentos */}
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio ref={audioRef} preload="none" />

      <div className={styles.header}>
        <span className={styles.headerIcon}>🔍</span>
        <span className={styles.headerText}>
          Posibles coincidencias detectadas — revisa y confirma
        </span>
      </div>

      <div className={styles.list}>
        {visible.map((suggestion) => {
          const isPlaying = playingId === suggestion.ephemeralId;
          const isLoading = loadingId === suggestion.ephemeralId;
          const isConfirming = confirming.has(suggestion.ephemeralId);
          const similarityPct = Math.round(suggestion.similarity * 100);
          const canPlay = !!audioSrc && suggestion.firstSegmentStart != null;

          return (
            <div key={suggestion.ephemeralId} className={styles.card}>
              <div className={styles.cardMain}>
                <div className={styles.speakerInfo}>
                  <span className={styles.currentName}>{suggestion.currentDisplayName}</span>
                  <span className={styles.arrow}>→</span>
                  <span className={styles.candidateName}>{suggestion.candidateDisplayName}</span>
                  <span className={styles.similarity}>{similarityPct}% similitud</span>
                </div>

                {canPlay && (
                  <div className={styles.audioSection}>
                    <span className={styles.audioLabel}>
                      {formatTime(suggestion.firstSegmentStart)} · fragmento 5s
                    </span>
                    <button
                      className={`${styles.playBtn} ${isPlaying ? styles.playing : ''}`}
                      onClick={() => handlePlay(suggestion)}
                      disabled={isLoading}
                      title={isPlaying ? 'Pausar' : 'Reproducir fragmento de 5 segundos'}
                    >
                      {isLoading ? '⏳' : isPlaying ? '⏸' : '▶'}
                    </button>
                  </div>
                )}

                {!canPlay && (
                  <span className={styles.noAudio}>Sin audio disponible</span>
                )}
              </div>

              <div className={styles.actions}>
                <button
                  className={styles.confirmBtn}
                  onClick={() => handleConfirm(suggestion)}
                  disabled={isConfirming}
                  title={`Confirmar que ${suggestion.currentDisplayName} es ${suggestion.candidateDisplayName}`}
                >
                  {isConfirming ? 'Guardando…' : 'Sí, es él/ella'}
                </button>
                <button
                  className={styles.dismissBtn}
                  onClick={() => handleDismiss(suggestion)}
                  disabled={isConfirming}
                  title="No es el mismo hablante"
                >
                  No es él/ella
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
