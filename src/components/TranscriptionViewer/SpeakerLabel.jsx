/**
 * SpeakerLabel.jsx
 *
 * Componente para mostrar y editar el alias de un hablante inline.
 *
 * Comportamiento:
 *   - Modo visualización: muestra el alias (o el ephemeralId como fallback).
 *   - Modo edición: al hacer clic, transforma a un <input> con autocompletado
 *     basado en la lista de hablantes conocidos (Redux `allSpeakers`).
 *   - Al guardar (blur o Enter): despacha `updateAlias` en Redux y llama
 *     IPC `assign-alias` para persistir en BD.
 *   - ESC cancela la edición sin guardar.
 *
 * IMPORTANTE — Separación ID / Alias:
 *   - `ephemeralId` es inmutable (viene del JSON de transcripción).
 *   - `displayName` es editable y vive solo en Redux + BD.
 *   - El JSON de transcripción NUNCA se modifica.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  selectDisplayName,
  selectSpeakerId,
  selectAllSpeakers,
  updateAlias,
} from '../../store/slices/speakersSlice';
import styles from './SpeakerLabel.module.css';
import { hasEditableSpeakerResolution } from './speakerCompatibility.mjs';

/**
 * @param {Object}   props
 * @param {string}   props.ephemeralId  - ID efímero del segmento ("SPEAKER_00").
 * @param {number[]} [props.embedding]  - Embedding del hablante (para persistir).
 * @param {number}   [props.recordingId] - ID de la grabación de origen.
 * @param {Object}   [props.speakerResolution] - Mapa de resolución de hablantes de la grabación.
 * @param {boolean}  [props.readOnly]   - Si true, no permite edición.
 */
export default function SpeakerLabel({
  ephemeralId,
  embedding,
  recordingId,
  speakerResolution,
  readOnly = false,
}) {
  const dispatch = useDispatch();
  const displayName = useSelector(selectDisplayName(ephemeralId));
  const speakerId = useSelector(selectSpeakerId(ephemeralId));
  const allSpeakers = useSelector(selectAllSpeakers);
  const hasSpeakerResolution = hasEditableSpeakerResolution(speakerResolution);
  const canEdit = hasSpeakerResolution && !readOnly;

  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const [isSaving, setIsSaving] = useState(false);

  const inputRef = useRef(null);
  const containerRef = useRef(null);
  const suggestionListRef = useRef(null);

  // ── Autocompletado ────────────────────────────────────────────────────────────

  const filterSuggestions = useCallback((value) => {
    if (!value.trim()) {
      setSuggestions(allSpeakers.slice(0, 6));
      return;
    }
    const lower = value.toLowerCase();
    const filtered = allSpeakers
      .filter((s) => s.display_name.toLowerCase().includes(lower))
      .slice(0, 6);
    setSuggestions(filtered);
  }, [allSpeakers]);

  // ── Handlers de edición ───────────────────────────────────────────────────────

  const startEditing = () => {
    if (!canEdit) return;
    setInputValue(displayName === ephemeralId ? '' : displayName);
    setIsEditing(true);
    setActiveSuggestionIndex(-1);
    setSuggestions(allSpeakers.slice(0, 6));
  };

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleInputChange = (e) => {
    const value = e.target.value;
    setInputValue(value);
    setActiveSuggestionIndex(-1);
    filterSuggestions(value);
  };

  /**
   * Persiste el nuevo alias: despacha Redux + llama IPC.
   */
  const saveAlias = useCallback(async (newName) => {
    const trimmed = (newName || '').trim();
    if (!trimmed) {
      setIsEditing(false);
      return;
    }

    setIsSaving(true);

      try {
        if (!window.electronAPI?.assignSpeakerAlias) {
          return;
        }

        const result = await window.electronAPI.assignSpeakerAlias({
          speakerId: speakerId || null,
          alias: trimmed,
          embedding: embedding || null,
          recordingId: recordingId || null,
          ephemeralId,
        });

        if (!result?.success || !result?.speakerId || !result?.displayName) {
          console.error('[SpeakerLabel] Error al guardar alias en BD:', result?.error);
          return;
        }

        // La BD es la fuente de verdad: la UI solo refleja lo que el backend confirmó.
        dispatch(updateAlias({
          ephemeralId,
          speakerId: result.speakerId,
          displayName: result.displayName,
        }));
      } catch (err) {
        console.error('[SpeakerLabel] Error al guardar alias:', err);
      } finally {
      setIsSaving(false);
      setIsEditing(false);
    }
  }, [dispatch, ephemeralId, speakerId, embedding, recordingId, allSpeakers]);

  const handleBlur = (e) => {
    // No cerrar si el foco se mueve a la lista de sugerencias
    if (containerRef.current?.contains(e.relatedTarget)) return;
    saveAlias(inputValue);
    setSuggestions([]);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (activeSuggestionIndex >= 0 && suggestions[activeSuggestionIndex]) {
        const chosen = suggestions[activeSuggestionIndex].display_name;
        setInputValue(chosen);
        saveAlias(chosen);
      } else {
        saveAlias(inputValue);
      }
      setSuggestions([]);
    } else if (e.key === 'Escape') {
      setIsEditing(false);
      setSuggestions([]);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveSuggestionIndex((prev) =>
        prev < suggestions.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveSuggestionIndex((prev) => (prev > 0 ? prev - 1 : 0));
    }
  };

  const handleSuggestionClick = (suggestion) => {
    setInputValue(suggestion.display_name);
    saveAlias(suggestion.display_name);
    setSuggestions([]);
  };

  // ── Render ────────────────────────────────────────────────────────────────────

  if (!canEdit) {
    return (
      <span
        className={styles.label}
        title={displayName}
        aria-label={`Hablante: ${displayName}`}
      >
        {displayName}
      </span>
    );
  }

  if (!isEditing) {
    return (
      <span
        className={`${styles.label} ${canEdit ? styles.editable : ''}`}
        onClick={startEditing}
        title={displayName}
        aria-label={`Hablante: ${displayName}. Clic para editar`}
      >
        {displayName}
        <span className={styles.editIcon} aria-hidden="true">✎</span>
      </span>
    );
  }

  return (
    <span ref={containerRef} className={styles.editingContainer}>
      <input
        ref={inputRef}
        type="text"
        value={inputValue}
        className={`${styles.input} ${isSaving ? styles.saving : ''}`}
        onChange={handleInputChange}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder={ephemeralId}
        aria-label="Editar nombre del hablante"
        aria-autocomplete="list"
        aria-expanded={suggestions.length > 0}
        disabled={isSaving}
      />
      {suggestions.length > 0 && (
        <ul
          ref={suggestionListRef}
          className={styles.suggestionList}
          role="listbox"
          aria-label="Sugerencias de hablantes"
        >
          {suggestions.map((s, idx) => (
            <li
              key={s.id}
              role="option"
              aria-selected={idx === activeSuggestionIndex}
              className={`${styles.suggestionItem} ${idx === activeSuggestionIndex ? styles.suggestionActive : ''}`}
              onMouseDown={(e) => {
                e.preventDefault(); // Evita que blur se dispare antes de click
                handleSuggestionClick(s);
              }}
            >
              {s.display_name}
            </li>
          ))}
        </ul>
      )}
    </span>
  );
}
