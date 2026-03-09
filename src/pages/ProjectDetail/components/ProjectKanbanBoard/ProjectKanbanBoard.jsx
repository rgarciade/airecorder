import React, { useState } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  useDroppable,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import styles from './ProjectKanbanBoard.module.css';
import TaskDetailModal from '../../../RecordingDetail/components/EpicsTab/TaskDetailModal';
import ProjectTasksEmptyState from '../../../../components/ProjectTasksEmptyState/ProjectTasksEmptyState';
import { MdFolderOpen, MdOpenInFull, MdSmartToy, MdAdd, MdClose, MdAutoAwesome, MdSave } from 'react-icons/md';

const COLUMNS = [
  { value: 'backlog',     label: 'Backlog',     cls: 'colBacklog'    },
  { value: 'in_progress', label: 'En progreso', cls: 'colInProgress' },
  { value: 'blocked',     label: 'Bloqueado',   cls: 'colBlocked'    },
  { value: 'done',        label: 'Hecho',       cls: 'colDone'       },
];

const STATUS_OPTIONS = [
  { value: 'backlog',     label: 'Backlog'     },
  { value: 'in_progress', label: 'En progreso' },
  { value: 'blocked',     label: 'Bloqueado'   },
  { value: 'done',        label: 'Hecho'       },
];

const LAYER_OPTIONS = [
  { value: 'frontend',  label: 'Front',   cls: 'layerFront' },
  { value: 'backend',   label: 'Back',    cls: 'layerBack'  },
  { value: 'fullstack', label: 'Full',    cls: 'layerFull'  },
  { value: 'general',   label: 'General', cls: 'layerGen'   },
];

const LAYER_LABELS = { frontend: 'Front', backend: 'Back', fullstack: 'Full', general: 'General' };

// ── Modal de creación ────────────────────────────────────────────────────────
function TaskCreateModal({ initialStatus = 'backlog', onSubmit, onClose }) {
  const [form, setForm] = useState({
    title: '',
    content: '',
    layer: 'general',
    status: initialStatus,
  });

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  const handleSubmit = () => {
    if (!form.title.trim()) return;
    onSubmit({ title: form.title.trim(), content: form.content.trim(), layer: form.layer, status: form.status });
  };

  return (
    <div className={styles.createOverlay} onClick={handleOverlayClick}>
      <div className={styles.createModal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.createHeader}>
          <div className={styles.createHeaderLeft}>
            <span className={styles.createTitle}>Nueva tarea</span>
            <div className={styles.createStatusRow}>
              <span className={styles.createLabel}>Estado:</span>
              {STATUS_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  className={`${styles.createStatusPill} ${form.status === opt.value ? styles[`activePill_${opt.value}`] : ''}`}
                  onClick={() => setForm(p => ({ ...p, status: opt.value }))}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <button className={styles.createCloseBtn} onClick={onClose} title="Cerrar">
            <MdClose size={18} />
          </button>
        </div>

        {/* Body */}
        <div className={styles.createBody}>
          <div className={styles.createFieldGroup}>
            <label className={styles.createFieldLabel}>Título</label>
            <input
              type="text"
              className={styles.createInput}
              value={form.title}
              onChange={(e) => setForm(p => ({ ...p, title: e.target.value }))}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); if (e.key === 'Escape') onClose(); }}
              placeholder="Ej: Implementar sistema de autenticación"
              autoFocus
            />
          </div>
          <div className={styles.createFieldGroup}>
            <label className={styles.createFieldLabel}>Descripción</label>
            <textarea
              className={styles.createTextarea}
              value={form.content}
              onChange={(e) => setForm(p => ({ ...p, content: e.target.value }))}
              placeholder="Descripción detallada de la tarea... (opcional)"
              rows={6}
            />
          </div>
          <div className={styles.createFieldGroup}>
            <label className={styles.createFieldLabel}>Capa</label>
            <div className={styles.createLayerRow}>
              {LAYER_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  className={`${styles.createLayerBtn} ${styles[opt.cls]} ${form.layer === opt.value ? styles.createLayerActive : ''}`}
                  onClick={() => setForm(p => ({ ...p, layer: opt.value }))}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className={styles.createFooter}>
          <button className={styles.createCancelBtn} onClick={onClose}>Cancelar</button>
          <button className={styles.createSubmitBtn} onClick={handleSubmit} disabled={!form.title.trim()}>
            <MdSave size={15} /> Crear tarea
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Card sortable (dentro de SortableContext) ────────────────────────────────
function SortableCard({ task, recordingMap, onNavigateToRecording, onExpand }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const recInfo = recordingMap && task.recording_db_id ? recordingMap[task.recording_db_id] : null;

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`${styles.card} ${isDragging ? styles.cardGhost : ''}`}
    >
      {/* Zona de arrastre */}
      <div
        className={styles.cardTop}
        {...listeners}
        {...attributes}
        style={{ cursor: 'grab' }}
      >
        <p className={styles.cardTitle}>{task.title}</p>
        <button
          className={styles.cardExpandBtn}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); onExpand(task); }}
          title="Ampliar"
        >
          <MdOpenInFull size={12} />
        </button>
      </div>

      {/* Badges */}
      <div className={styles.cardBadges}>
        {recInfo && (
          <button
            className={styles.recBadge}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); onNavigateToRecording?.(recInfo.id); }}
            title={`Ir a: ${recInfo.title}`}
          >
            <MdFolderOpen size={9} />
            {recInfo.title}
          </button>
        )}
        {task.layer && task.layer !== 'general' && (
          <span className={`${styles.layerBadge} ${styles[`layer_${task.layer}`]}`}>
            {LAYER_LABELS[task.layer] || task.layer}
          </span>
        )}
        {task.created_by_ai === 1 && (
          <span className={styles.aiBadge} title="Generado por IA">
            <MdSmartToy size={10} />
          </span>
        )}
      </div>
    </div>
  );
}

// ── Card overlay (para DragOverlay — sin hooks de DnD) ──────────────────────
function OverlayCard({ task, recordingMap }) {
  const recInfo = recordingMap && task.recording_db_id ? recordingMap[task.recording_db_id] : null;
  return (
    <div className={`${styles.card} ${styles.cardOverlay}`} style={{ cursor: 'grabbing' }}>
      <div className={styles.cardTop} style={{ cursor: 'grabbing' }}>
        <p className={styles.cardTitle}>{task.title}</p>
      </div>
      <div className={styles.cardBadges}>
        {recInfo && (
          <span className={styles.recBadge}>
            <MdFolderOpen size={9} />
            {recInfo.title}
          </span>
        )}
        {task.layer && task.layer !== 'general' && (
          <span className={`${styles.layerBadge} ${styles[`layer_${task.layer}`]}`}>
            {LAYER_LABELS[task.layer] || task.layer}
          </span>
        )}
        {task.created_by_ai === 1 && (
          <span className={styles.aiBadge}>
            <MdSmartToy size={10} />
          </span>
        )}
      </div>
    </div>
  );
}

// ── Columna droppable ───────────────────────────────────────────────────────
function KanbanColumn({ col, tasks, recordingMap, onNavigateToRecording, onExpand, onCreateTask, onOpenCreate }) {
  const { setNodeRef, isOver } = useDroppable({ id: col.value });
  const taskIds = tasks.map(t => t.id);

  return (
    <div className={`${styles.column} ${styles[col.cls]} ${isOver ? styles.colOver : ''}`}>
      <div className={styles.colHeader}>
        <span className={styles.colLabel}>{col.label}</span>
        <span className={styles.colCount}>{tasks.length}</span>
      </div>

      <div ref={setNodeRef} className={`${styles.cardList} ${isOver ? styles.cardListOver : ''}`}>
        <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
          {tasks.length === 0 && !isOver ? (
            <p className={styles.emptyCol}>Sin tareas</p>
          ) : (
            tasks.map(task => (
              <SortableCard
                key={task.id}
                task={task}
                recordingMap={recordingMap}
                onNavigateToRecording={onNavigateToRecording}
                onExpand={onExpand}
              />
            ))
          )}
        </SortableContext>
        {isOver && tasks.length === 0 && <div className={styles.dropZone} />}
      </div>

      {onCreateTask && (
        <button className={styles.addCardBtn} onClick={() => onOpenCreate(col.value)}>
          <MdAdd size={13} /> Añadir tarea
        </button>
      )}
    </div>
  );
}

// ── Board principal ─────────────────────────────────────────────────────────
export default function ProjectKanbanBoard({
  tasks,
  recordingMap,
  onUpdateTask,
  onDeleteTask,
  onNavigateToRecording,
  getTaskComments,
  onAddComment,
  onDeleteComment,
  onCreateTask,
  onUpdateTasksOrder,
  projectEmptyHint,
}) {
  const [activeId, setActiveId] = useState(null);
  const [detailTask, setDetailTask] = useState(null);
  const [creatingInColumn, setCreatingInColumn] = useState(null);

  const taskList = tasks || [];
  const activeTask = activeId ? taskList.find(t => t.id === activeId) : null;
  const tasksByStatus = (status) => taskList.filter(t => (t.status || 'backlog') === status);
  const isEmpty = taskList.length === 0;

  const handleDragStart = ({ active }) => setActiveId(active.id);

  const handleDragEnd = ({ active, over }) => {
    setActiveId(null);
    if (!over || active.id === over.id) return;

    const draggedTask = taskList.find(t => t.id === active.id);
    if (!draggedTask) return;
    const activeStatus = draggedTask.status || 'backlog';

    // Caso 1: soltado sobre una columna vacía (over.id es un col.value)
    const targetColumn = COLUMNS.find(c => c.value === over.id);
    if (targetColumn) {
      if (targetColumn.value !== activeStatus) {
        onUpdateTask({
          id: draggedTask.id, title: draggedTask.title,
          content: draggedTask.content || '', layer: draggedTask.layer || 'general',
          status: targetColumn.value,
        });
      }
      return;
    }

    // Caso 2/3: soltado sobre otra tarjeta
    const overTask = taskList.find(t => t.id === over.id);
    if (!overTask) return;
    const overStatus = overTask.status || 'backlog';

    if (activeStatus === overStatus) {
      // Misma columna → reordenar
      const colTasks = tasksByStatus(activeStatus);
      const oldIndex = colTasks.findIndex(t => t.id === active.id);
      const newIndex = colTasks.findIndex(t => t.id === over.id);
      if (oldIndex !== newIndex) {
        const newOrder = arrayMove(colTasks, oldIndex, newIndex);
        const updates = newOrder.map((t, idx) => ({ id: t.id, sort_order: idx * 10 }));
        onUpdateTasksOrder?.(updates);
      }
    } else {
      // Distinta columna → cambio de estado
      onUpdateTask({
        id: draggedTask.id, title: draggedTask.title,
        content: draggedTask.content || '', layer: draggedTask.layer || 'general',
        status: overStatus,
      });
    }
  };

  const handleModalUpdate = (updated) => {
    onUpdateTask(updated);
    setDetailTask(prev => ({ ...prev, ...updated }));
  };

  const handleModalDelete = (taskId) => {
    onDeleteTask?.(taskId);
    setDetailTask(null);
  };

  const handleCreateSubmit = (data) => {
    onCreateTask?.(data);
    setCreatingInColumn(null);
  };

  return (
    <>
      {isEmpty ? (
        <ProjectTasksEmptyState
          hint={projectEmptyHint}
          onCreateTask={onCreateTask ? () => setCreatingInColumn('backlog') : undefined}
        />
      ) : (
        <DndContext
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className={styles.board}>
            {COLUMNS.map(col => (
              <KanbanColumn
                key={col.value}
                col={col}
                tasks={tasksByStatus(col.value)}
                recordingMap={recordingMap}
                onNavigateToRecording={onNavigateToRecording}
                onExpand={setDetailTask}
                onCreateTask={onCreateTask}
                onOpenCreate={setCreatingInColumn}
              />
            ))}
          </div>

          <DragOverlay dropAnimation={{ duration: 180, easing: 'ease' }}>
            {activeTask && (
              <OverlayCard
                task={activeTask}
                recordingMap={recordingMap}
              />
            )}
          </DragOverlay>
        </DndContext>
      )}

      {/* Modal de creación */}
      {creatingInColumn && onCreateTask && (
        <TaskCreateModal
          initialStatus={creatingInColumn}
          onSubmit={handleCreateSubmit}
          onClose={() => setCreatingInColumn(null)}
        />
      )}

      {/* Modal de detalle */}
      {detailTask && (
        <TaskDetailModal
          task={detailTask}
          recordingInfo={recordingMap && detailTask.recording_db_id ? recordingMap[detailTask.recording_db_id] : null}
          onClose={() => setDetailTask(null)}
          onUpdate={handleModalUpdate}
          onDelete={handleModalDelete}
          onNavigateToRecording={onNavigateToRecording}
          getComments={getTaskComments}
          onAddComment={onAddComment}
          onDeleteComment={onDeleteComment}
        />
      )}
    </>
  );
}
