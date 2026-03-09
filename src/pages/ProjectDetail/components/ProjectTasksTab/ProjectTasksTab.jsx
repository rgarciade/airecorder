import React, { useState, useMemo } from 'react';
import styles from './ProjectTasksTab.module.css';
import {
  MdChevronRight,
  MdExpandMore,
  MdSave,
  MdDelete,
  MdAutoAwesome,
  MdSmartToy,
  MdFolderOpen,
} from 'react-icons/md';

const LAYER_LABELS = {
  frontend: 'Front',
  backend: 'Back',
  fullstack: 'Full',
  general: 'General',
};

const FILTER_OPTIONS = [
  { value: 'all', label: 'Todas' },
  { value: 'frontend', label: 'Frontend' },
  { value: 'backend', label: 'Backend' },
  { value: 'fullstack', label: 'Fullstack' },
  { value: 'general', label: 'General' },
];

/**
 * Muestra todas las tareas generadas en las grabaciones del proyecto.
 * Permite editar, eliminar y filtrar por capa, con indicación de la grabación origen.
 */
export default function ProjectTasksTab({
  tasks,
  recordingSummaries,
  onUpdateTask,
  onDeleteTask,
  onNavigateToRecording,
}) {
  const [activeFilter, setActiveFilter] = useState('all');
  const [expandedTaskId, setExpandedTaskId] = useState(null);
  const [editingData, setEditingData] = useState({ title: '', content: '', layer: 'general' });
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  // Mapa rápido recording_db_id → título de grabación
  const recordingTitleMap = useMemo(() => {
    const map = {};
    (recordingSummaries || []).forEach(r => {
      map[r.id] = r.title || r.name || `Grabación ${r.id}`;
    });
    return map;
  }, [recordingSummaries]);

  // Tareas filtradas por capa
  const filteredTasks = useMemo(() => {
    if (!tasks) return [];
    if (activeFilter === 'all') return tasks;
    return tasks.filter(t => (t.layer || 'general') === activeFilter);
  }, [tasks, activeFilter]);

  const handleToggleExpand = (taskId) => {
    if (expandedTaskId === taskId) {
      setExpandedTaskId(null);
      setEditingData({ title: '', content: '', layer: 'general' });
      setDeleteConfirmId(null);
    } else {
      const task = tasks.find(t => t.id === taskId);
      if (task) {
        setEditingData({ title: task.title, content: task.content || '', layer: task.layer || 'general' });
      }
      setExpandedTaskId(taskId);
      setDeleteConfirmId(null);
    }
  };

  const handleSave = () => {
    if (!editingData.title.trim()) return;
    onUpdateTask({ id: expandedTaskId, ...editingData, title: editingData.title.trim(), content: editingData.content.trim() });
  };

  const handleDelete = (taskId) => {
    onDeleteTask(taskId);
    setDeleteConfirmId(null);
    if (expandedTaskId === taskId) {
      setExpandedTaskId(null);
      setEditingData({ title: '', content: '', layer: 'general' });
    }
  };

  const handleRecordingClick = (e, task) => {
    e.stopPropagation();
    if (onNavigateToRecording && task.recording_db_id) {
      onNavigateToRecording(task.recording_db_id);
    }
  };

  if (!tasks || tasks.length === 0) {
    return (
      <div className={styles.emptyState}>
        <MdAutoAwesome size={48} className={styles.emptyIcon} />
        <h3 className={styles.emptyTitle}>Sin tareas en el proyecto</h3>
        <p className={styles.emptySubtitle}>
          Las tareas se generan en la vista de detalle de cada grabación. Abre una grabación transcrita y usa la pestaña "Tareas" para generarlas.
        </p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Toolbar con contador y filtros */}
      <div className={styles.toolbar}>
        <span className={styles.counter}>
          {filteredTasks.length} tarea{filteredTasks.length !== 1 ? 's' : ''}
          {activeFilter !== 'all' && ` · ${LAYER_LABELS[activeFilter]}`}
        </span>
        <div className={styles.layerFilters}>
          {FILTER_OPTIONS.map(opt => (
            <button
              key={opt.value}
              className={`${styles.filterPill} ${styles[`filterPill_${opt.value}`]} ${activeFilter === opt.value ? styles.filterPillActive : ''}`}
              onClick={() => setActiveFilter(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Lista de tareas */}
      <div className={styles.taskList}>
        {filteredTasks.map(task => {
          const isExpanded = expandedTaskId === task.id;
          const recordingTitle = recordingTitleMap[task.recording_db_id] || `Grabación ${task.recording_db_id}`;

          const rawPreview = (task.content || '')
            .replace(/\*\*[^*]+\*\*/g, m => m.slice(2, -2))
            .replace(/^#{1,6}\s+/gm, '')
            .replace(/^[-*]\s+/gm, '')
            .replace(/\n+/g, ' ')
            .trim();
          const previewText = rawPreview.length > 110 ? rawPreview.substring(0, 110) + '...' : rawPreview;

          return (
            <div
              key={task.id}
              className={`${styles.taskCard} ${isExpanded ? styles.expanded : ''}`}
            >
              {/* Header */}
              <div className={styles.taskHeader} onClick={() => handleToggleExpand(task.id)}>
                {isExpanded
                  ? <MdExpandMore size={20} className={styles.chevron} />
                  : <MdChevronRight size={20} className={styles.chevron} />
                }
                <div className={styles.taskHeaderText}>
                  <div className={styles.taskTitleRow}>
                    <span className={styles.taskTitle}>{task.title}</span>
                  </div>
                  {/* Grabación origen + preview */}
                  <div className={styles.taskMeta}>
                    <button
                      className={styles.recordingBadge}
                      onClick={(e) => handleRecordingClick(e, task)}
                      title={`Ir a: ${recordingTitle}`}
                    >
                      <MdFolderOpen size={11} />
                      {recordingTitle}
                    </button>
                  </div>
                  {!isExpanded && previewText && (
                    <span className={styles.taskPreview}>{previewText}</span>
                  )}
                </div>

                <div className={styles.headerBadges}>
                  {task.layer && task.layer !== 'general' && (
                    <span className={`${styles.layerBadge} ${styles[`layer_${task.layer}`]}`}>
                      {LAYER_LABELS[task.layer]}
                    </span>
                  )}
                  {task.created_by_ai === 1 && (
                    <span className={styles.aiBadge} title="Generado por IA">
                      <MdSmartToy size={12} />
                    </span>
                  )}
                </div>
              </div>

              {/* Cuerpo expandido */}
              {isExpanded && (
                <div className={styles.taskBody}>
                  <div className={styles.fieldGroup}>
                    <label className={styles.fieldLabel}>Título</label>
                    <input
                      type="text"
                      className={styles.fieldInput}
                      value={editingData.title}
                      onChange={(e) => setEditingData(prev => ({ ...prev, title: e.target.value }))}
                    />
                  </div>

                  <div className={styles.fieldGroup}>
                    <label className={styles.fieldLabel}>Descripción</label>
                    <textarea
                      className={styles.fieldTextarea}
                      value={editingData.content}
                      onChange={(e) => setEditingData(prev => ({ ...prev, content: e.target.value }))}
                      rows={4}
                    />
                  </div>

                  <div className={styles.fieldGroup}>
                    <label className={styles.fieldLabel}>Capa</label>
                    <div className={styles.layerSelector}>
                      {['frontend', 'backend', 'fullstack', 'general'].map(l => (
                        <button
                          key={l}
                          type="button"
                          className={`${styles.layerOption} ${editingData.layer === l ? styles.layerOptionActive : ''} ${styles[`layerOpt_${l}`]}`}
                          onClick={() => setEditingData(prev => ({ ...prev, layer: l }))}
                        >
                          {LAYER_LABELS[l]}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className={styles.taskActions}>
                    <button
                      className={styles.saveButton}
                      onClick={handleSave}
                      disabled={!editingData.title.trim()}
                    >
                      <MdSave size={16} /> Guardar cambios
                    </button>

                    {deleteConfirmId === task.id ? (
                      <div className={styles.deleteConfirm}>
                        <span>¿Eliminar?</span>
                        <button className={styles.deleteYes} onClick={() => handleDelete(task.id)}>Sí</button>
                        <button className={styles.deleteNo} onClick={() => setDeleteConfirmId(null)}>No</button>
                      </div>
                    ) : (
                      <button
                        className={styles.deleteButton}
                        onClick={() => setDeleteConfirmId(task.id)}
                      >
                        <MdDelete size={16} /> Eliminar
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
