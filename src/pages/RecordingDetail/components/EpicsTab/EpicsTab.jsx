import React, { useState, useEffect } from 'react';
import styles from './EpicsTab.module.css';
import {
  MdAdd,
  MdAutoAwesome,
  MdChevronRight,
  MdExpandMore,
  MdDelete,
  MdSave,
  MdClose,
  MdSmartToy,
  MdCheckBox,
  MdCheckBoxOutlineBlank,
  MdIndeterminateCheckBox
} from 'react-icons/md';

export default function EpicsTab({
  tasks,
  isGenerating,
  hasTranscription,
  onGenerateMore,
  onCreateTask,
  onUpdateTask,
  onImproveTask,
  onDeleteTask,
  onBulkDeleteTasks,
  improvingTaskId,
  newTaskIds   // Set<id> de tareas añadidas en esta sesión
}) {
  const [expandedTaskId, setExpandedTaskId] = useState(null);
  const [editingData, setEditingData] = useState({ title: '', content: '', layer: 'general' });
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTask, setNewTask] = useState({ title: '', content: '', layer: 'general' });
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [showImprovePanel, setShowImprovePanel] = useState(null);
  const [improveInstructions, setImproveInstructions] = useState('');

  // Multiselección
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);

  // Tareas "vistas" — dejan de mostrar badge Nuevo al expandirlas
  const [seenIds, setSeenIds] = useState(new Set());

  const isNew = (id) => newTaskIds?.has(id) && !seenIds.has(id);

  // Sincronizar editingData si la tarea expandida cambia externamente (ej: mejora con IA)
  useEffect(() => {
    if (!expandedTaskId) return;
    const task = tasks.find(t => t.id === expandedTaskId);
    if (task) {
      setEditingData({ title: task.title, content: task.content || '', layer: task.layer || 'general' });
    }
  }, [tasks]);

  const handleToggleExpand = (taskId) => {
    if (expandedTaskId === taskId) {
      setExpandedTaskId(null);
      setEditingData({ title: '', content: '', layer: 'general' });
      setShowImprovePanel(null);
    } else {
      const task = tasks.find(t => t.id === taskId);
      if (task) {
        setExpandedTaskId(taskId);
        setEditingData({ title: task.title, content: task.content || '', layer: task.layer || 'general' });
      }
      setShowImprovePanel(null);
      setDeleteConfirmId(null);
      // Marcar como vista
      if (isNew(taskId)) {
        setSeenIds(prev => new Set([...prev, taskId]));
      }
    }
  };

  const handleSaveEdit = () => {
    if (!editingData.title.trim()) return;
    onUpdateTask({ id: expandedTaskId, title: editingData.title.trim(), content: editingData.content.trim(), layer: editingData.layer });
  };

  const handleCreateSubmit = () => {
    if (!newTask.title.trim()) return;
    onCreateTask({ title: newTask.title.trim(), content: newTask.content.trim(), layer: newTask.layer });
    setNewTask({ title: '', content: '', layer: 'general' });
    setShowCreateForm(false);
  };

  const handleCancelCreate = () => {
    setNewTask({ title: '', content: '', layer: 'general' });
    setShowCreateForm(false);
  };

  const handleApplyImprove = () => {
    if (!improveInstructions.trim()) return;
    onImproveTask(expandedTaskId, improveInstructions.trim());
    setShowImprovePanel(null);
    setImproveInstructions('');
  };

  const handleDelete = (taskId) => {
    onDeleteTask(taskId);
    setDeleteConfirmId(null);
    setSelectedIds(prev => { const n = new Set(prev); n.delete(taskId); return n; });
    if (expandedTaskId === taskId) {
      setExpandedTaskId(null);
      setEditingData({ title: '', content: '', layer: 'general' });
    }
  };

  // Multiselección
  const toggleSelect = (taskId, e) => {
    e.stopPropagation();
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(taskId) ? next.delete(taskId) : next.add(taskId);
      return next;
    });
    setBulkDeleteConfirm(false);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === tasks.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(tasks.map(t => t.id)));
    }
    setBulkDeleteConfirm(false);
  };

  const handleBulkDelete = () => {
    onBulkDeleteTasks([...selectedIds]);
    setSelectedIds(new Set());
    setBulkDeleteConfirm(false);
    if (selectedIds.has(expandedTaskId)) {
      setExpandedTaskId(null);
      setEditingData({ title: '', content: '', layer: 'general' });
    }
  };

  const isEmpty = !tasks || tasks.length === 0;
  const allSelected = tasks && tasks.length > 0 && selectedIds.size === tasks.length;
  const someSelected = selectedIds.size > 0 && !allSelected;

  return (
    <div className={styles.container}>
      {isEmpty ? (
        <div className={styles.emptyState}>
          <MdAutoAwesome size={48} className={styles.emptyIcon} />
          <h3 className={styles.emptyTitle}>Sin sugerencias de tareas</h3>
          <p className={styles.emptySubtitle}>
            Genera tareas accionables a partir de la transcripción o crea una manualmente.
          </p>
          <div className={styles.emptyActions}>
            {hasTranscription && (
              <button className={styles.primaryButton} onClick={onGenerateMore} disabled={isGenerating}>
                <MdAutoAwesome size={18} />
                {isGenerating ? 'Generando...' : 'Generar tareas'}
              </button>
            )}
            <button className={styles.secondaryButton} onClick={() => setShowCreateForm(true)}>
              <MdAdd size={18} />
              Crear manualmente
            </button>
          </div>
        </div>
      ) : (
        <div className={styles.toolbar}>
          {/* Checkbox seleccionar todo */}
          <button className={styles.selectAllBtn} onClick={toggleSelectAll} title="Seleccionar todas">
            {allSelected
              ? <MdCheckBox size={18} className={styles.checkboxOn} />
              : someSelected
                ? <MdIndeterminateCheckBox size={18} className={styles.checkboxPartial} />
                : <MdCheckBoxOutlineBlank size={18} className={styles.checkboxOff} />
            }
          </button>
          <span className={styles.counter}>{tasks.length} tarea{tasks.length !== 1 ? 's' : ''}</span>
          <div className={styles.toolbarActions}>
            {hasTranscription && (
              <button className={styles.secondaryButton} onClick={onGenerateMore} disabled={isGenerating}>
                <MdAutoAwesome size={16} />
                {isGenerating ? 'Generando...' : 'Generar más'}
              </button>
            )}
            <button className={styles.secondaryButton} onClick={() => setShowCreateForm(true)}>
              <MdAdd size={16} />
              Nueva tarea
            </button>
          </div>
        </div>
      )}

      {/* Barra de acciones en bloque */}
      {!isEmpty && (
        <div className={`${styles.bulkBar} ${selectedIds.size === 0 ? styles.bulkBarHidden : ''}`}>
          <span className={styles.bulkCount}>{selectedIds.size} seleccionada{selectedIds.size !== 1 ? 's' : ''}</span>
          <div className={styles.bulkActions}>
            {bulkDeleteConfirm ? (
              <>
                <span className={styles.bulkConfirmText}>¿Eliminar {selectedIds.size}?</span>
                <button className={styles.deleteYes} onClick={handleBulkDelete}>Sí</button>
                <button className={styles.deleteNo} onClick={() => setBulkDeleteConfirm(false)}>No</button>
              </>
            ) : (
              <>
                <button className={styles.bulkDeleteBtn} onClick={() => setBulkDeleteConfirm(true)}>
                  <MdDelete size={15} /> Eliminar seleccionadas
                </button>
                <button className={styles.cancelButton} onClick={() => setSelectedIds(new Set())}>
                  <MdClose size={14} /> Cancelar
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Formulario nueva tarea inline */}
      {showCreateForm && (
        <div className={styles.createForm}>
          <h4 className={styles.formTitle}>Nueva tarea</h4>
          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel}>Título</label>
            <input
              type="text"
              className={styles.fieldInput}
              value={newTask.title}
              onChange={(e) => setNewTask(prev => ({ ...prev, title: e.target.value }))}
              placeholder="Ej: Implementar sistema de autenticación"
              autoFocus
            />
          </div>
          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel}>Descripción</label>
            <textarea
              className={styles.fieldTextarea}
              value={newTask.content}
              onChange={(e) => setNewTask(prev => ({ ...prev, content: e.target.value }))}
              placeholder="Descripción detallada de la tarea..."
              rows={3}
            />
          </div>
          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel}>Capa</label>
            <div className={styles.layerSelector}>
              {['frontend', 'backend', 'fullstack', 'general'].map(l => (
                <button key={l} type="button"
                  className={`${styles.layerOption} ${newTask.layer === l ? styles.layerOptionActive : ''} ${styles[`layerOpt_${l}`]}`}
                  onClick={() => setNewTask(prev => ({ ...prev, layer: l }))}
                >
                  {l === 'frontend' ? 'Front' : l === 'backend' ? 'Back' : l === 'fullstack' ? 'Full' : 'General'}
                </button>
              ))}
            </div>
          </div>
          <div className={styles.formActions}>
            <button className={styles.cancelButton} onClick={handleCancelCreate}>
              <MdClose size={16} /> Cancelar
            </button>
            <button className={styles.saveButton} onClick={handleCreateSubmit} disabled={!newTask.title.trim()}>
              <MdSave size={16} /> Crear tarea
            </button>
          </div>
        </div>
      )}

      {/* Lista de tareas */}
      {!isEmpty && (
        <div className={styles.taskList}>
          {tasks.map(task => {
            const isExpanded = expandedTaskId === task.id;
            const isImproving = improvingTaskId === task.id;
            const isSelected = selectedIds.has(task.id);
            const isNewTask = isNew(task.id);

            const rawPreview = (task.content || '')
              .replace(/\*\*[^*]+\*\*/g, m => m.slice(2, -2))
              .replace(/^#{1,6}\s+/gm, '')
              .replace(/^[-*]\s+/gm, '')
              .replace(/\n+/g, ' ')
              .trim();
            const previewText = rawPreview.length > 120 ? rawPreview.substring(0, 120) + '...' : rawPreview;

            return (
              <div key={task.id} className={`${styles.taskCard} ${isExpanded ? styles.expanded : ''} ${isSelected ? styles.selected : ''}`}>
                {/* Header del acordeón */}
                <div className={styles.taskHeader} onClick={() => handleToggleExpand(task.id)}>
                  {/* Checkbox */}
                  <button
                    className={styles.taskCheckbox}
                    onClick={(e) => toggleSelect(task.id, e)}
                    title={isSelected ? 'Deseleccionar' : 'Seleccionar'}
                  >
                    {isSelected
                      ? <MdCheckBox size={18} className={styles.checkboxOn} />
                      : <MdCheckBoxOutlineBlank size={18} className={styles.checkboxOff} />
                    }
                  </button>

                  <div className={styles.taskHeaderLeft}>
                    {isExpanded
                      ? <MdExpandMore size={20} className={styles.chevron} />
                      : <MdChevronRight size={20} className={styles.chevron} />
                    }
                    <div className={styles.taskHeaderText}>
                      <div className={styles.taskTitleRow}>
                        <span className={styles.taskTitle}>{task.title}</span>
                        {isNewTask && <span className={styles.newBadge}>Nuevo</span>}
                      </div>
                      {!isExpanded && previewText && (
                        <span className={styles.taskPreview}>{previewText}</span>
                      )}
                    </div>
                  </div>

                  <div className={styles.headerBadges}>
                    {task.layer && task.layer !== 'general' && (
                      <span className={`${styles.layerBadge} ${styles[`layer_${task.layer}`]}`}>
                        {task.layer === 'frontend' ? 'Front' : task.layer === 'backend' ? 'Back' : 'Full'}
                      </span>
                    )}
                    {task.created_by_ai === 1 && (
                      <span className={styles.aiBadge} title="Generado por IA">
                        <MdSmartToy size={12} />
                      </span>
                    )}
                  </div>
                </div>

                {/* Contenido expandido */}
                {isExpanded && (
                  <div className={styles.taskBody}>
                    {isImproving && (
                      <div className={styles.improvingOverlay}>
                        <MdAutoAwesome className={styles.spinningIcon} size={20} />
                        <span>Mejorando con IA...</span>
                      </div>
                    )}

                    <div className={styles.fieldGroup}>
                      <label className={styles.fieldLabel}>Título</label>
                      <input type="text" className={styles.fieldInput}
                        value={editingData.title}
                        onChange={(e) => setEditingData(prev => ({ ...prev, title: e.target.value }))}
                      />
                    </div>

                    <div className={styles.fieldGroup}>
                      <label className={styles.fieldLabel}>Descripción</label>
                      <textarea className={styles.fieldTextarea}
                        value={editingData.content}
                        onChange={(e) => setEditingData(prev => ({ ...prev, content: e.target.value }))}
                        rows={5}
                      />
                    </div>

                    <div className={styles.fieldGroup}>
                      <label className={styles.fieldLabel}>Capa</label>
                      <div className={styles.layerSelector}>
                        {['frontend', 'backend', 'fullstack', 'general'].map(l => (
                          <button key={l} type="button"
                            className={`${styles.layerOption} ${editingData.layer === l ? styles.layerOptionActive : ''} ${styles[`layerOpt_${l}`]}`}
                            onClick={() => setEditingData(prev => ({ ...prev, layer: l }))}
                          >
                            {l === 'frontend' ? 'Front' : l === 'backend' ? 'Back' : l === 'fullstack' ? 'Full' : 'General'}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Acciones */}
                    <div className={styles.taskActions}>
                      <button className={styles.saveButton} onClick={handleSaveEdit} disabled={!editingData.title.trim()}>
                        <MdSave size={16} /> Guardar cambios
                      </button>
                      <button className={styles.improveButton}
                        onClick={() => { setShowImprovePanel(showImprovePanel === task.id ? null : task.id); setImproveInstructions(''); }}
                        disabled={isImproving}
                      >
                        <MdAutoAwesome size={16} /> Mejorar con IA
                      </button>
                      {deleteConfirmId === task.id ? (
                        <div className={styles.deleteConfirm}>
                          <span>¿Eliminar?</span>
                          <button className={styles.deleteYes} onClick={() => handleDelete(task.id)}>Sí</button>
                          <button className={styles.deleteNo} onClick={() => setDeleteConfirmId(null)}>No</button>
                        </div>
                      ) : (
                        <button className={styles.deleteButton} onClick={() => setDeleteConfirmId(task.id)}>
                          <MdDelete size={16} /> Eliminar
                        </button>
                      )}
                    </div>

                    {/* Panel de mejora con IA */}
                    {showImprovePanel === task.id && (
                      <div className={styles.improvePanel}>
                        <label className={styles.fieldLabel}>Instrucciones para mejorar</label>
                        <textarea className={styles.fieldTextarea}
                          value={improveInstructions}
                          onChange={(e) => setImproveInstructions(e.target.value)}
                          placeholder="Ej: Añade más detalles técnicos sobre la implementación con PostgreSQL..."
                          rows={3}
                          autoFocus
                        />
                        <div className={styles.improvePanelActions}>
                          <button className={styles.cancelButton}
                            onClick={() => { setShowImprovePanel(null); setImproveInstructions(''); }}
                          >
                            Cancelar
                          </button>
                          <button className={styles.saveButton} onClick={handleApplyImprove} disabled={!improveInstructions.trim()}>
                            <MdAutoAwesome size={16} /> Aplicar
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
