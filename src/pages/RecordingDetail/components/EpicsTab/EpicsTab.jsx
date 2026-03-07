import React, { useState, useEffect, useRef } from 'react';
import styles from './EpicsTab.module.css';
import TaskDetailModal from './TaskDetailModal';
import ProjectTasksEmptyState from '../../../../components/ProjectTasksEmptyState/ProjectTasksEmptyState';
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
  MdIndeterminateCheckBox,
  MdOpenInFull,
  MdFolderOpen,
  MdAddCircleOutline,
} from 'react-icons/md';

const STATUS_OPTIONS = [
  { value: 'backlog',     label: 'Backlog',     cls: 'status_backlog'     },
  { value: 'in_progress', label: 'En progreso', cls: 'status_in_progress' },
  { value: 'blocked',     label: 'Bloqueado',   cls: 'status_blocked'     },
  { value: 'done',        label: 'Hecho',       cls: 'status_done'        },
];

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
  newTaskIds,             // Set<id> de tareas añadidas en esta sesión
  // Props opcionales para vista de proyecto
  recordingMap,           // { [recording_db_id]: { id, title } }
  onNavigateToRecording,  // (recordingId) => void
  getTaskComments,        // (taskId) => Promise<Comment[]>
  onAddComment,           // (taskId, content) => Promise<Comment>
  onDeleteComment,        // (commentId) => Promise<void>
  // Props para vincular/desvincular tareas de proyecto (desde vista de transcripción)
  onAddToProject,         // (taskId) => Promise<void> — si se pasa, muestra botón en tareas sin project_id
  activeProjectId,        // number | undefined — proyecto activo (reservado para uso futuro)
  projectEmptyHint,       // string | undefined — mensaje extra en empty state (solo en vista proyecto)
}) {
  const [expandedTaskId, setExpandedTaskId] = useState(null);
  const [editingData, setEditingData] = useState({ title: '', content: '', layer: 'general', status: 'backlog' });
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

  // Modal ampliado
  const [detailTask, setDetailTask] = useState(null);

  // Mini-menu de estado
  const [statusMenuOpenId, setStatusMenuOpenId] = useState(null);
  const statusMenuRef = useRef(null);

  const isNew = (id) => newTaskIds?.has(id) && !seenIds.has(id);

  // Cerrar el mini-menu de estado al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (statusMenuRef.current && !statusMenuRef.current.contains(e.target)) {
        setStatusMenuOpenId(null);
      }
    };
    if (statusMenuOpenId !== null) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [statusMenuOpenId]);

  // Sincronizar editingData si la tarea expandida cambia externamente (ej: mejora con IA)
  useEffect(() => {
    if (!expandedTaskId) return;
    const task = tasks.find(t => t.id === expandedTaskId);
    if (task) {
      setEditingData({
        title: task.title,
        content: task.content || '',
        layer: task.layer || 'general',
        status: task.status || 'backlog',
      });
    }
  }, [tasks]);

  // Si la tarea del detailTask cambia externamente, sincronizar
  useEffect(() => {
    if (!detailTask) return;
    const updated = tasks.find(t => t.id === detailTask.id);
    if (updated) setDetailTask(updated);
  }, [tasks]);

  const handleToggleExpand = (taskId) => {
    if (expandedTaskId === taskId) {
      setExpandedTaskId(null);
      setEditingData({ title: '', content: '', layer: 'general', status: 'backlog' });
      setShowImprovePanel(null);
    } else {
      const task = tasks.find(t => t.id === taskId);
      if (task) {
        setExpandedTaskId(taskId);
        setEditingData({
          title: task.title,
          content: task.content || '',
          layer: task.layer || 'general',
          status: task.status || 'backlog',
        });
      }
      setShowImprovePanel(null);
      setDeleteConfirmId(null);
      if (isNew(taskId)) {
        setSeenIds(prev => new Set([...prev, taskId]));
      }
    }
  };

  const handleSaveEdit = () => {
    if (!editingData.title.trim()) return;
    onUpdateTask({
      id: expandedTaskId,
      title: editingData.title.trim(),
      content: editingData.content.trim(),
      layer: editingData.layer,
      status: editingData.status,
    });
  };

  // Cambio rápido de estado desde el mini-menu del header
  const handleQuickStatusChange = (task, newStatus) => {
    setStatusMenuOpenId(null);
    onUpdateTask({ id: task.id, title: task.title, content: task.content || '', layer: task.layer || 'general', status: newStatus });
    // Si esta tarea está expandida, sincronizar editingData
    if (expandedTaskId === task.id) {
      setEditingData(prev => ({ ...prev, status: newStatus }));
    }
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
      setEditingData({ title: '', content: '', layer: 'general', status: 'backlog' });
    }
    if (detailTask?.id === taskId) setDetailTask(null);
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
      setEditingData({ title: '', content: '', layer: 'general', status: 'backlog' });
    }
  };

  const handleBulkAddToProject = async () => {
    if (!onAddToProject) return;
    const toAdd = [...selectedIds].filter(id => {
      const task = tasks.find(t => t.id === id);
      return task && !task.project_id;
    });
    if (!toAdd.length) return;
    await Promise.all(toAdd.map(id => onAddToProject(id)));
    setSelectedIds(new Set());
  };

  const isEmpty = !tasks || tasks.length === 0;
  const allSelected = tasks && tasks.length > 0 && selectedIds.size === tasks.length;
  const someSelected = selectedIds.size > 0 && !allSelected;

  const getStatusOption = (value) => STATUS_OPTIONS.find(o => o.value === value) || STATUS_OPTIONS[0];

  return (
    <div className={styles.container}>
      {isEmpty ? (
        projectEmptyHint ? (
          <ProjectTasksEmptyState
            hint={projectEmptyHint}
            onCreateTask={onCreateTask ? () => setShowCreateForm(true) : undefined}
          />
        ) : (
          <div className={styles.emptyState}>
            <MdAutoAwesome size={48} className={styles.emptyIcon} />
            <h3 className={styles.emptyTitle}>Sin tareas</h3>
            <p className={styles.emptySubtitle}>
              Genera tareas accionables a partir de la transcripción o crea una manualmente.
            </p>
            <div className={styles.emptyActions}>
              {hasTranscription && onGenerateMore && (
                <button className={styles.primaryButton} onClick={onGenerateMore} disabled={isGenerating}>
                  <MdAutoAwesome size={18} />
                  {isGenerating ? 'Generando...' : 'Generar tareas'}
                </button>
              )}
              {onCreateTask && (
                <button className={styles.secondaryButton} onClick={() => setShowCreateForm(true)}>
                  <MdAdd size={18} />
                  Crear manualmente
                </button>
              )}
            </div>
          </div>
        )
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
            {hasTranscription && onGenerateMore && (
              <button className={styles.secondaryButton} onClick={onGenerateMore} disabled={isGenerating}>
                <MdAutoAwesome size={16} />
                {isGenerating ? 'Generando...' : 'Generar más'}
              </button>
            )}
            {onCreateTask && (
              <button className={styles.secondaryButton} onClick={() => setShowCreateForm(true)}>
                <MdAdd size={16} />
                Nueva tarea
              </button>
            )}
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
                {onAddToProject && [...selectedIds].some(id => !tasks.find(t => t.id === id)?.project_id) && (
                  <button className={styles.bulkAddProjectBtn} onClick={handleBulkAddToProject}>
                    <MdAddCircleOutline size={14} /> Agregar al proyecto
                  </button>
                )}
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
      {showCreateForm && onCreateTask && (
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
            const statusOpt = getStatusOption(task.status || 'backlog');
            const recInfo = recordingMap && task.recording_db_id ? recordingMap[task.recording_db_id] : null;

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
                    {/* Badge grabación origen */}
                    {recInfo && (
                      <button
                        className={styles.recordingOriginBadge}
                        onClick={(e) => { e.stopPropagation(); onNavigateToRecording?.(recInfo.id); }}
                        title={`Ir a: ${recInfo.title}`}
                      >
                        <MdFolderOpen size={10} />
                        {recInfo.title}
                      </button>
                    )}

                    {/* Badge de capa */}
                    {task.layer && task.layer !== 'general' && (
                      <span className={`${styles.layerBadge} ${styles[`layer_${task.layer}`]}`}>
                        {task.layer === 'frontend' ? 'Front' : task.layer === 'backend' ? 'Back' : 'Full'}
                      </span>
                    )}

                    {/* Badge de IA */}
                    {task.created_by_ai === 1 && (
                      <span className={styles.aiBadge} title="Generado por IA">
                        <MdSmartToy size={12} />
                      </span>
                    )}

                    {/* Badge de estado con mini-menu */}
                    <div
                      className={styles.statusBadgeWrapper}
                      ref={statusMenuOpenId === task.id ? statusMenuRef : null}
                    >
                      <button
                        className={`${styles.statusBadge} ${styles[statusOpt.cls]}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setStatusMenuOpenId(prev => prev === task.id ? null : task.id);
                        }}
                        title="Cambiar estado"
                      >
                        {statusOpt.label}
                      </button>
                      {statusMenuOpenId === task.id && (
                        <div className={styles.statusMenu}>
                          {STATUS_OPTIONS.map(opt => (
                            <button
                              key={opt.value}
                              className={`${styles.statusMenuItem} ${task.status === opt.value ? styles.menuItemActive : ''}`}
                              onClick={(e) => { e.stopPropagation(); handleQuickStatusChange(task, opt.value); }}
                            >
                              <span className={`${styles.statusBadge} ${styles[opt.cls]}`}>{opt.label}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Botón agregar al proyecto — solo si aún no está añadida */}
                    {onAddToProject && !task.project_id && (
                      <button
                        className={styles.addToProjectBtn}
                        onClick={(e) => { e.stopPropagation(); onAddToProject(task.id); }}
                        title="Agregar al proyecto"
                      >
                        <MdAddCircleOutline size={12} />
                        Agregar
                      </button>
                    )}

                    {/* Botón ampliar */}
                    <button
                      className={styles.expandButton}
                      onClick={(e) => { e.stopPropagation(); setDetailTask(task); }}
                      title="Ampliar tarea"
                    >
                      <MdOpenInFull size={13} />
                    </button>
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

                    {/* Selector de estado en el panel expandido */}
                    <div className={styles.fieldGroup}>
                      <label className={styles.fieldLabel}>Estado</label>
                      <div className={styles.layerSelector}>
                        {STATUS_OPTIONS.map(opt => (
                          <button key={opt.value} type="button"
                            className={`${styles.statusBadge} ${styles[opt.cls]} ${editingData.status === opt.value ? '' : ''}`}
                            style={{ opacity: editingData.status === opt.value ? 1 : 0.45, fontSize: '11px', padding: '4px 10px' }}
                            onClick={() => setEditingData(prev => ({ ...prev, status: opt.value }))}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Acciones */}
                    <div className={styles.taskActions}>
                      <button className={styles.saveButton} onClick={handleSaveEdit} disabled={!editingData.title.trim()}>
                        <MdSave size={16} /> Guardar cambios
                      </button>
                      {onImproveTask && (
                        <button className={styles.improveButton}
                          onClick={() => { setShowImprovePanel(showImprovePanel === task.id ? null : task.id); setImproveInstructions(''); }}
                          disabled={isImproving}
                        >
                          <MdAutoAwesome size={16} /> Mejorar con IA
                        </button>
                      )}
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
                    {onImproveTask && showImprovePanel === task.id && (
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

      {/* Modal de detalle ampliado */}
      {detailTask && (
        <TaskDetailModal
          task={detailTask}
          recordingInfo={recordingMap && detailTask.recording_db_id ? recordingMap[detailTask.recording_db_id] : null}
          onClose={() => setDetailTask(null)}
          onUpdate={(updated) => {
            onUpdateTask(updated);
            setDetailTask(prev => ({ ...prev, ...updated }));
          }}
          onDelete={onDeleteTask ? (taskId) => { onDeleteTask(taskId); setDetailTask(null); } : undefined}
          onNavigateToRecording={onNavigateToRecording}
          getComments={getTaskComments}
          onAddComment={onAddComment}
          onDeleteComment={onDeleteComment}
        />
      )}
    </div>
  );
}
