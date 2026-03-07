import React, { useState, useEffect, useCallback } from 'react';
import {
  MdClose, MdCheck, MdSchedule, MdMoreVert,
  MdMic, MdAutoAwesome, MdChecklist, MdInbox,
} from 'react-icons/md';
import styles from './AiQueue.module.css';
import { aiQueueService } from '../../services/ai/aiQueueService';

// ---------------------------------------------------------------------------
// Helpers de formato
// ---------------------------------------------------------------------------

const formatElapsed = (startedAt) => {
  if (!startedAt) return '0s';
  const diff = Math.floor((Date.now() - startedAt.getTime()) / 1000);
  if (diff < 0) return '0s';
  if (diff < 60) return `${diff}s`;
  const m = Math.floor(diff / 60);
  const s = diff % 60;
  return `${m}m ${s < 10 ? '0' : ''}${s}s`;
};

const formatDuration = (startedAt, completedAt) => {
  if (!startedAt || !completedAt) return '-';
  const diff = Math.floor((completedAt.getTime() - startedAt.getTime()) / 1000);
  if (diff < 0) return '-';
  if (diff < 60) return `${diff}s`;
  const m = Math.floor(diff / 60);
  const s = diff % 60;
  return `${m}m ${s < 10 ? '0' : ''}${s}s`;
};

const formatRelativeTime = (date) => {
  if (!date) return '-';
  const diff = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return 'Yesterday';
};

// ---------------------------------------------------------------------------
// Componente de icono según tipo de tarea
// ---------------------------------------------------------------------------

const TaskTypeIcon = ({ type, size = 20 }) => {
  switch (type) {
    case 'summary':
    case 'detailed-summary':
    case 'project-analysis':
    case 'general':
      return <MdAutoAwesome size={size} />;
    case 'transcription':
    case 'participants':
      return <MdMic size={size} />;
    case 'action-items':
    case 'task-suggestions':
    case 'task-improvement':
    case 'key-topics':
      return <MdChecklist size={size} />;
    case 'chat':
    default:
      return <MdAutoAwesome size={size} />;
  }
};

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------

export default function AiQueue() {
  const [queueState, setQueueState] = useState({ current: null, queue: [], history: [] });
  const [elapsed, setElapsed] = useState('0s');

  // Suscribirse al servicio de cola
  useEffect(() => {
    const unsubscribe = aiQueueService.subscribe(setQueueState);
    return unsubscribe;
  }, []);

  // Timer del tiempo transcurrido de la tarea actual
  useEffect(() => {
    const startedAt = queueState.current?.startedAt;
    if (!startedAt) {
      setElapsed('0s');
      return;
    }
    setElapsed(formatElapsed(startedAt));
    const timer = setInterval(() => setElapsed(formatElapsed(startedAt)), 1000);
    return () => clearInterval(timer);
  }, [queueState.current?.startedAt]);

  const handleCancel = useCallback((taskId) => {
    aiQueueService.cancel(taskId);
  }, []);

  const handleClearHistory = useCallback(() => {
    aiQueueService.clearHistory();
  }, []);

  const { current, queue, history } = queueState;

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Process Monitor</h1>
          <p className={styles.pageSubtitle}>Track and manage your AI tasks.</p>
        </div>
      </div>

      {/* ── Tarea actual ── */}
      <section className={styles.section}>
        <h2 className={styles.sectionLabel}>Current Task</h2>
        {current ? (
          <div className={styles.currentCard}>
            <div className={styles.taskIconWrap}>
              <TaskTypeIcon type={current.type} />
            </div>
            <div className={styles.taskInfo}>
              <span className={styles.taskName}>{current.name}</span>
              <span className={styles.taskEngine}>Processing via {current.engine}</span>
            </div>
            <div className={styles.taskRight}>
              <span className={styles.elapsedBadge}>
                <MdSchedule size={13} />
                {elapsed}
              </span>
              <span className={styles.processingBadge}>
                <span className={styles.processingDot} />
                Processing...
              </span>
              <button className={styles.moreBtn} title="More options">
                <MdMoreVert size={20} />
              </button>
            </div>
          </div>
        ) : (
          <div className={styles.emptyCurrentCard}>
            <MdInbox size={26} />
            <span>No hay ninguna tarea en proceso</span>
          </div>
        )}
      </section>

      {/* ── Cola pendiente ── */}
      <section className={styles.section}>
        <div className={styles.sectionRow}>
          <h2 className={styles.sectionLabel}>Queue</h2>
          {queue.length > 0 && (
            <span className={styles.queueMeta}>
              {queue.length} pending task{queue.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        {queue.length === 0 ? (
          <p className={styles.emptyText}>La cola está vacía.</p>
        ) : (
          <div className={styles.queueList}>
            {queue.map((item) => (
              <div key={item.id} className={styles.queueItem}>
                <div className={styles.queueIconWrap}>
                  <TaskTypeIcon type={item.type} />
                </div>
                <div className={styles.queueInfo}>
                  <span className={styles.queueName}>{item.name}</span>
                  <span className={styles.queueEngine}>{item.engine}</span>
                </div>
                <span className={styles.pendingBadge}>PENDING</span>
                <button
                  className={styles.removeBtn}
                  title="Cancelar tarea"
                  onClick={() => handleCancel(item.id)}
                >
                  <MdClose size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Historial ── */}
      <section className={styles.section}>
        <div className={styles.sectionRow}>
          <h2 className={styles.sectionLabel}>History</h2>
          {history.length > 0 && (
            <button className={styles.clearHistoryBtn} onClick={handleClearHistory}>
              Clear History
            </button>
          )}
        </div>
        {history.length === 0 ? (
          <p className={styles.emptyText}>No hay historial de tareas.</p>
        ) : (
          <div className={styles.historyTableWrap}>
            <table className={styles.historyTable}>
              <thead>
                <tr>
                  <th>TASK</th>
                  <th>ENGINE</th>
                  <th>DURATION</th>
                  <th>STATUS</th>
                  <th>TIME</th>
                </tr>
              </thead>
              <tbody>
                {history.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <span
                        className={
                          item.status === 'completed'
                            ? styles.historyIconSuccess
                            : item.status === 'cancelled'
                            ? styles.historyIconCancelled
                            : styles.historyIconFailed
                        }
                      >
                        {item.status === 'completed' ? (
                          <MdCheck size={14} />
                        ) : item.status === 'cancelled' ? (
                          <MdClose size={12} />
                        ) : (
                          <span className={styles.failedDot} />
                        )}
                      </span>
                      {item.name}
                    </td>
                    <td>{item.engine}</td>
                    <td>{formatDuration(item.startedAt, item.completedAt)}</td>
                    <td>
                      <span
                        className={
                          item.status === 'completed'
                            ? styles.statusCompleted
                            : item.status === 'cancelled'
                            ? styles.statusCancelled
                            : styles.statusFailed
                        }
                      >
                        {item.status === 'completed'
                          ? 'Completed'
                          : item.status === 'cancelled'
                          ? 'Cancelled'
                          : 'Failed'}
                      </span>
                    </td>
                    <td className={styles.historyTime}>{formatRelativeTime(item.completedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
