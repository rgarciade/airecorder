import React from 'react';
import { MdAutoAwesome, MdAdd } from 'react-icons/md';
import styles from './ProjectTasksEmptyState.module.css';

/**
 * Empty state compartido para el proyecto en vista Kanban y vista Lista.
 * Props:
 *   hint        {string}   — Texto descriptivo (projectEmptyHint)
 *   onCreateTask {() => void} — Si se pasa, muestra el botón "Nueva tarea"
 */
export default function ProjectTasksEmptyState({ hint, onCreateTask }) {
  return (
    <div className={styles.emptyBoard}>
      <MdAutoAwesome size={40} className={styles.emptyIcon} />
      <p className={styles.emptyTitle}>Sin tareas en el proyecto</p>
      <p className={styles.emptyHint}>
        {hint || 'Crea una tarea manualmente o añádela desde una transcripción.'}
      </p>
      {onCreateTask && (
        <button className={styles.emptyCreateBtn} onClick={onCreateTask}>
          <MdAdd size={16} /> Nueva tarea
        </button>
      )}
    </div>
  );
}
