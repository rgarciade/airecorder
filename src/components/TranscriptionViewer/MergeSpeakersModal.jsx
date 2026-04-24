/**
 * MergeSpeakersModal.jsx
 *
 * Modal para fusionar dos o más hablantes en un único perfil.
 *
 * Flujo:
 *   1. El usuario selecciona los hablantes efímeros a fusionar.
 *   2. Escribe (o elige) el nombre unificado.
 *   3. Al confirmar:
 *      - Despacha `mergeSpeakers` en Redux (actualiza todos los segmentos en UI).
 *      - Llama IPC `assign-alias` para cada ephemeralId implicado.
 *
 * IMPORTANTE:
 *   - El JSON de transcripción NO se modifica. Solo se actualiza el mapa de Redux.
 *   - Los ephemeralId son inmutables; solo cambia su alias de presentación.
 */

import React, { useState, useEffect, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  selectSpeakersMap,
  selectAllSpeakers,
  mergeSpeakers,
} from '../../store/slices/speakersSlice';
import styles from './MergeSpeakersModal.module.css';

/**
 * @param {Object}    props
 * @param {boolean}   props.isOpen        - Controla visibilidad del modal.
 * @param {Function}  props.onClose       - Callback para cerrar el modal.
 * @param {string[]}  props.ephemeralIds  - Lista de ephemeralIds disponibles en la sesión.
 * @param {number}    [props.recordingId] - ID de la grabación activa.
 */
export default function MergeSpeakersModal({ isOpen, onClose, ephemeralIds = [], recordingId }) {
  const dispatch = useDispatch();
  const speakersMap = useSelector(selectSpeakersMap);
  const allSpeakers = useSelector(selectAllSpeakers);

  const [selectedIds, setSelectedIds] = useState([]);
  const [mergedName, setMergedName] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const inputRef = useRef(null);

  // Reset al abrir
  useEffect(() => {
    if (isOpen) {
      setSelectedIds([]);
      setMergedName('');
      setError('');
      setSuggestions([]);
    }
  }, [isOpen]);

  // Focus en input al abrir
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // ── Autocompletado del nombre ──────────────────────────────────────────────

  const handleNameChange = (e) => {
    const value = e.target.value;
    setMergedName(value);
    if (!value.trim()) {
      setSuggestions(allSpeakers.slice(0, 5));
      return;
    }
    const lower = value.toLowerCase();
    setSuggestions(
      allSpeakers.filter((s) => s.display_name.toLowerCase().includes(lower)).slice(0, 5)
    );
  };

  // ── Selección de hablantes ────────────────────────────────────────────────

  const toggleSpeaker = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
    setError('');
  };

  // ── Guardar merge ─────────────────────────────────────────────────────────

  const handleConfirm = async () => {
    const trimmedName = mergedName.trim();
    if (selectedIds.length < 2) {
      setError('Selecciona al menos 2 hablantes para fusionar.');
      return;
    }
    if (!trimmedName) {
      setError('Introduce un nombre para el hablante unificado.');
      return;
    }

    setIsSaving(true);
    setError('');

    try {
      let targetSpeakerId = null;

      if (window.electronAPI?.mergeSpeakers) {
        // Pasar el mapa de Redux para que el backend resuelva los speakerIds
        const result = await window.electronAPI.mergeSpeakers({
          sourceEphemeralIds: selectedIds,
          speakersMap,
          targetAlias: trimmedName,
        });

        if (!result?.success) {
          setError(result?.error || 'Error al fusionar hablantes.');
          return;
        }
        targetSpeakerId = result.targetSpeakerId;
      }

      // Actualizar Redux: todos los ephemeralIds seleccionados apuntan al mismo perfil
      dispatch(mergeSpeakers({
        sourceEphemeralIds: selectedIds,
        targetSpeakerId: targetSpeakerId || trimmedName,
        displayName: trimmedName,
      }));

      onClose();
    } catch (err) {
      console.error('[MergeSpeakersModal] Error al fusionar:', err);
      setError('Ocurrió un error al guardar. Inténtalo de nuevo.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') onClose();
    if (e.key === 'Enter' && !isSaving) handleConfirm();
  };

  // ── Render ────────────────────────────────────────────────────────────────

  if (!isOpen) return null;

  const getDisplayName = (id) => speakersMap[id]?.displayName || id;

  return (
    <div
      className={styles.overlay}
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="merge-modal-title"
    >
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2 id="merge-modal-title" className={styles.title}>
            Fusionar hablantes
          </h2>
          <button
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="Cerrar modal"
          >
            ✕
          </button>
        </div>

        <div className={styles.body}>
          <p className={styles.description}>
            Selecciona los hablantes que son la misma persona y asígnales un nombre unificado.
            Los cambios se reflejarán en todos los segmentos de la transcripción.
          </p>

          {/* Lista de hablantes para seleccionar */}
          <div className={styles.section}>
            <label className={styles.sectionLabel}>Hablantes a fusionar</label>
            <ul className={styles.speakerList} role="list">
              {ephemeralIds.map((id) => (
                <li key={id} className={styles.speakerItem}>
                  <label className={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      className={styles.checkbox}
                      checked={selectedIds.includes(id)}
                      onChange={() => toggleSpeaker(id)}
                      aria-label={`Seleccionar ${getDisplayName(id)}`}
                    />
                    <span className={styles.speakerName}>{getDisplayName(id)}</span>
                    <span className={styles.speakerEphemeral}>{id}</span>
                  </label>
                </li>
              ))}
            </ul>
          </div>

          {/* Input nombre unificado */}
          <div className={styles.section} style={{ position: 'relative' }}>
            <label htmlFor="merge-name-input" className={styles.sectionLabel}>
              Nombre unificado
            </label>
            <input
              id="merge-name-input"
              ref={inputRef}
              type="text"
              value={mergedName}
              onChange={handleNameChange}
              onKeyDown={handleKeyDown}
              className={styles.nameInput}
              placeholder="Ej: Juan García"
              disabled={isSaving}
              aria-autocomplete="list"
            />
            {suggestions.length > 0 && mergedName && (
              <ul className={styles.suggestions} role="listbox">
                {suggestions.map((s) => (
                  <li
                    key={s.id}
                    role="option"
                    className={styles.suggestionItem}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setMergedName(s.display_name);
                      setSuggestions([]);
                    }}
                  >
                    {s.display_name}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {error && (
            <p className={styles.errorMsg} role="alert">{error}</p>
          )}
        </div>

        <div className={styles.footer}>
          <button
            className={styles.cancelBtn}
            onClick={onClose}
            disabled={isSaving}
          >
            Cancelar
          </button>
          <button
            className={styles.confirmBtn}
            onClick={handleConfirm}
            disabled={isSaving || selectedIds.length < 2 || !mergedName.trim()}
          >
            {isSaving ? 'Guardando…' : 'Fusionar'}
          </button>
        </div>
      </div>
    </div>
  );
}
