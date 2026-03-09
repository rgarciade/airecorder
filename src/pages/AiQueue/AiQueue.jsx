import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import {
  MdClose, MdCheck, MdSchedule, MdMoreVert,
  MdMic, MdAutoAwesome, MdChecklist, MdInbox,
  MdOpenInNew, MdContentCopy, MdKeyboardArrowDown, MdKeyboardArrowRight
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

const formatMs = (ms) => {
  if (!ms || ms <= 0) return null;
  const totalSeconds = Math.round(ms / 1000);
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
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

const formatRelativeTime = (date, t) => {
  if (!date) return '-';
  const diff = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diff < 60) return t('aiQueue.relativeTime.justNow');
  if (diff < 3600) return t('aiQueue.relativeTime.minutesAgo', { count: Math.floor(diff / 60) });
  if (diff < 86400) return t('aiQueue.relativeTime.hoursAgo', { count: Math.floor(diff / 3600) });
  return t('aiQueue.relativeTime.yesterday');
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
  const { t } = useTranslation();
  const [queueState, setQueueState] = useState({ current: null, queue: [], history: [] });
  const [elapsed, setElapsed] = useState('0s');
  const [detailTask, setDetailTask] = useState(null); // tarea abierta en el modal
  const [copiedField, setCopiedField] = useState(null); // 'prompt' | 'response'
  const [expandedGroups, setExpandedGroups] = useState({});

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

  const handleCopy = useCallback((text, field) => {
    navigator.clipboard.writeText(text || '').then(() => {
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 1500);
    });
  }, []);

  const handleToggleGroup = useCallback((groupId) => {
    setExpandedGroups(prev => ({
      ...prev,
      [groupId]: !prev[groupId]
    }));
  }, []);

  const { current, queue, history, avgDurations } = queueState;

  // Process history for display (grouping subtasks)
  const displayHistory = [];
  const groups = {};

  history.forEach(item => {
    if (item.groupId) {
      if (!groups[item.groupId]) {
        groups[item.groupId] = { parent: null, subtasks: [] };
      }
      if (!item.hidden) {
        groups[item.groupId].parent = item;
      } else {
        groups[item.groupId].subtasks.push(item);
      }
    } else {
      if (!item.hidden) {
        displayHistory.push(item);
      }
    }
  });

  // Check if current processing task belongs to a group
  if (current?.groupId) {
    if (!groups[current.groupId]) {
      groups[current.groupId] = { parent: null, subtasks: [] };
    }
    if (!current.hidden) {
      groups[current.groupId].parent = { ...current };
    } else {
      groups[current.groupId].subtasks.unshift({ ...current });
    }
  }

  // Check if queued tasks belong to a group (for full progression visibility)
  queue.forEach(item => {
     if (item.groupId) {
        if (!groups[item.groupId]) {
           groups[item.groupId] = { parent: null, subtasks: [] };
        }
        if (!item.hidden && !groups[item.groupId].parent) {
           groups[item.groupId].parent = { ...item };
        } else if (item.hidden) {
           groups[item.groupId].subtasks.unshift({ ...item });
        }
     }
  });

  Object.entries(groups).forEach(([groupId, group]) => {
    // Sort subtasks descending by their start time so the newest is at the top of the expanded list
    group.subtasks.sort((a, b) => {
       const tA = a.startedAt ? a.startedAt.getTime() : 0;
       const tB = b.startedAt ? b.startedAt.getTime() : 0;
       return tB - tA;
    });

    if (group.parent) {
      // Create a new object to avoid mutating state directly
      const parentCopy = { 
         ...group.parent, 
         subtasks: group.subtasks, 
         isGroupParent: true 
      };
      
      // If the parent or any subtask is processing, calculate elapsed total time
      if (parentCopy.status === 'processing' || parentCopy.subtasks.some(s => s.status === 'processing' || s.status === 'pending')) {
         parentCopy.status = 'processing';
         // The main entry should be the "Resumen detallado final" or whatever parent is
         parentCopy.name = parentCopy.name;
      }

      displayHistory.push(parentCopy);
    } else if (group.subtasks.length > 0) {
      const latest = group.subtasks[0]; // Assuming sorted or just getting the engine info
      // Determine overall status
      const hasProcessing = group.subtasks.some(s => s.status === 'processing' || s.status === 'pending');
      const hasFailed = group.subtasks.some(s => s.status === 'failed');
      const overallStatus = hasProcessing ? 'processing' : (hasFailed ? 'failed' : 'completed');

      displayHistory.push({
         ...latest,
         id: `temp_${groupId}`,
         name: `Resumen IA (Procesando pasos intermedios...)`,
         subtasks: group.subtasks,
         hidden: false,
         status: overallStatus,
         isGroupParent: true
      });
    }
  });

  // Sort descending by completion/start time
  displayHistory.sort((a, b) => {
     const tA = a.completedAt ? a.completedAt.getTime() : (a.startedAt ? a.startedAt.getTime() : 0);
     const tB = b.completedAt ? b.completedAt.getTime() : (b.startedAt ? b.startedAt.getTime() : 0);
     return tB - tA;
  });

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>{t('aiQueue.title')}</h1>
          <p className={styles.pageSubtitle}>{t('aiQueue.subtitle')}</p>
        </div>
      </div>

      {/* ── Tarea actual ── */}
      <section className={styles.section}>
        <h2 className={styles.sectionLabel}>{t('aiQueue.currentTask')}</h2>
        {current ? (
          <div className={styles.currentCard}>
            <div className={styles.taskIconWrap}>
              <TaskTypeIcon type={current.type} />
            </div>
            <div className={styles.taskInfo}>
              <span className={styles.taskName}>
                {current.hidden && current.groupName ? current.groupName : current.name}
              </span>
              {current.hidden && current.groupName && (
                <span className={styles.taskSubstep}>{current.name}</span>
              )}
              <span className={styles.taskEngine}>{t('aiQueue.processingVia', { engine: current.engine })}</span>
            </div>
            <div className={styles.taskRight}>
              <span className={styles.elapsedBadge}>
                <MdSchedule size={13} />
                {elapsed}
              </span>
              {(() => {
                const avgMs = avgDurations?.[current.type]
                  ? Math.round(avgDurations[current.type].totalMs / avgDurations[current.type].count)
                  : null;
                const avgFormatted = formatMs(avgMs);
                if (!avgFormatted) return null;
                return (
                  <span className={styles.avgBadge} title={t('aiQueue.avgOf', { count: avgDurations[current.type].count })}>
                    ~{avgFormatted} avg
                  </span>
                );
              })()}
              <span className={styles.processingBadge}>
                <span className={styles.processingDot} />
                {t('aiQueue.processing')}
              </span>
              <button className={styles.moreBtn} title={t('aiQueue.moreOptions')}>
                <MdMoreVert size={20} />
              </button>
            </div>
          </div>
        ) : (
          <div className={styles.emptyCurrentCard}>
            <MdInbox size={26} />
            <span>{t('aiQueue.noCurrentTask')}</span>
          </div>
        )}
      </section>

      {/* ── Cola pendiente ── */}
      <section className={styles.section}>
        <div className={styles.sectionRow}>
          <h2 className={styles.sectionLabel}>{t('aiQueue.queue')}</h2>
          {queue.length > 0 && (
            <span className={styles.queueMeta}>
              {t('aiQueue.pendingTask', { count: queue.length })}
            </span>
          )}
        </div>
        {queue.length === 0 ? (
          <p className={styles.emptyText}>{t('aiQueue.emptyQueue')}</p>
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
                <span className={styles.pendingBadge}>{t('aiQueue.pending')}</span>
                <button
                  className={styles.removeBtn}
                  title={t('aiQueue.cancelTask')}
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
          <h2 className={styles.sectionLabel}>{t('aiQueue.history')}</h2>
          {displayHistory.length > 0 && (
            <button className={styles.clearHistoryBtn} onClick={handleClearHistory}>
              {t('aiQueue.clearHistory')}
            </button>
          )}
        </div>
        {displayHistory.length === 0 ? (
          <p className={styles.emptyText}>{t('aiQueue.emptyHistory')}</p>
        ) : (
          <div className={styles.historyTableWrap}>
            <table className={styles.historyTable}>
              <thead>
                <tr>
                  <th>{t('aiQueue.columns.task')}</th>
                  <th>{t('aiQueue.columns.engine')}</th>
                  <th>{t('aiQueue.columns.duration')}</th>
                  <th>{t('aiQueue.columns.status')}</th>
                  <th>{t('aiQueue.columns.time')}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {displayHistory.map((item) => (
                  <React.Fragment key={item.id}>
                    <tr className={item.isGroupParent ? styles.historyGroupRow : ''}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {item.isGroupParent && item.subtasks?.length > 0 && (
                            <button 
                              className={styles.expandGroupBtn}
                              onClick={() => handleToggleGroup(item.groupId || item.id)}
                            >
                              {expandedGroups[item.groupId || item.id] ? <MdKeyboardArrowDown size={18} /> : <MdKeyboardArrowRight size={18} />}
                            </button>
                          )}
                          <span
                            className={
                              item.status === 'completed'
                                ? styles.historyIconSuccess
                                : item.status === 'cancelled'
                                ? styles.historyIconCancelled
                                : item.status === 'processing'
                                ? styles.historyIconProcessing
                                : styles.historyIconFailed
                            }
                          >
                            {item.status === 'completed' ? (
                              <MdCheck size={14} />
                            ) : item.status === 'cancelled' ? (
                              <MdClose size={12} />
                            ) : item.status === 'processing' ? (
                              <span className={styles.processingDot} />
                            ) : (
                              <span className={styles.failedDot} />
                            )}
                          </span>
                          <span>{item.name} {item.isGroupParent && item.subtasks?.length > 0 ? `(${item.subtasks.length + 1} pasos)` : ''}</span>
                        </div>
                      </td>
                      <td>{item.engine}</td>
                      <td>{item.status === 'processing' ? elapsed : formatDuration(item.startedAt, item.completedAt)}</td>
                      <td>
                        <span
                          className={
                            item.status === 'completed'
                              ? styles.statusCompleted
                              : item.status === 'cancelled'
                              ? styles.statusCancelled
                              : item.status === 'processing'
                              ? styles.statusProcessing
                              : styles.statusFailed
                          }
                        >
                          {item.status === 'completed'
                            ? t('aiQueue.status.completed')
                            : item.status === 'cancelled'
                            ? t('aiQueue.status.cancelled')
                            : item.status === 'processing'
                            ? t('aiQueue.processing')
                            : t('aiQueue.status.failed')}
                        </span>
                      </td>
                      <td className={styles.historyTime}>{formatRelativeTime(item.completedAt || item.startedAt, t)}</td>
                      <td>
                        {(item.prompt || item.response) && (
                          <button
                            className={styles.viewDetailBtn}
                            title={t('aiQueue.viewDetail')}
                            onClick={() => setDetailTask(item)}
                          >
                            <MdOpenInNew size={15} />
                          </button>
                        )}
                      </td>
                    </tr>
                    
                    {/* Subtasks rendering */}
                    {item.isGroupParent && expandedGroups[item.groupId || item.id] && item.subtasks?.map(subtask => (
                      <tr key={subtask.id} className={styles.historySubtaskRow}>
                        <td style={{ paddingLeft: '32px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span
                              className={
                                subtask.status === 'completed'
                                  ? styles.historyIconSuccess
                                  : subtask.status === 'cancelled'
                                  ? styles.historyIconCancelled
                                  : styles.historyIconFailed
                              }
                            >
                              {subtask.status === 'completed' ? (
                                <MdCheck size={12} />
                              ) : subtask.status === 'cancelled' ? (
                                <MdClose size={12} />
                              ) : (
                                <span className={styles.failedDot} />
                              )}
                            </span>
                            <span className={styles.subtaskName}>{subtask.name}</span>
                          </div>
                        </td>
                        <td>{subtask.engine}</td>
                        <td>{formatDuration(subtask.startedAt, subtask.completedAt)}</td>
                        <td>
                          <span
                            className={
                              subtask.status === 'completed'
                                ? styles.statusCompleted
                                : subtask.status === 'cancelled'
                                ? styles.statusCancelled
                                : styles.statusFailed
                            }
                          >
                            {subtask.status === 'completed'
                              ? t('aiQueue.status.completed')
                              : subtask.status === 'cancelled'
                              ? t('aiQueue.status.cancelled')
                              : t('aiQueue.status.failed')}
                          </span>
                        </td>
                        <td className={styles.historyTime}>{formatRelativeTime(subtask.completedAt, t)}</td>
                        <td>
                          {(subtask.prompt || subtask.response) && (
                            <button
                              className={styles.viewDetailBtn}
                              title={t('aiQueue.viewDetail')}
                              onClick={() => setDetailTask(subtask)}
                            >
                              <MdOpenInNew size={15} />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {/* ── Modal de detalle (prompt + respuesta) ── */}
      {detailTask && (
        <div className={styles.modalOverlay} onClick={() => setDetailTask(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            {/* Cabecera */}
            <div className={styles.modalHeader}>
              <div className={styles.modalTitleRow}>
                <span className={styles.modalIcon}>
                  <TaskTypeIcon type={detailTask.type} size={18} />
                </span>
                <div>
                  <h3 className={styles.modalTitle}>{detailTask.name}</h3>
                  <span className={styles.modalMeta}>
                    {detailTask.engine} &middot; {formatDuration(detailTask.startedAt, detailTask.completedAt)}
                  </span>
                </div>
              </div>
              <button className={styles.modalCloseBtn} onClick={() => setDetailTask(null)}>
                <MdClose size={20} />
              </button>
            </div>

            {/* Cuerpo */}
            <div className={styles.modalBody}>
              {/* Prompt */}
              {detailTask.prompt && (
                <div className={styles.modalSection}>
                  <div className={styles.modalSectionHeader}>
                    <span className={styles.modalSectionLabel}>{t('aiQueue.prompt')}</span>
                    <button
                      className={styles.copyBtn}
                      onClick={() => handleCopy(detailTask.prompt, 'prompt')}
                      title={t('aiQueue.copyPrompt')}
                    >
                      <MdContentCopy size={14} />
                      {copiedField === 'prompt' ? t('common.copied') : t('common.copy')}
                    </button>
                  </div>
                  <pre className={styles.promptText}>{detailTask.prompt}</pre>
                </div>
              )}

              {/* Respuesta */}
              {detailTask.response && (
                <div className={styles.modalSection}>
                  <div className={styles.modalSectionHeader}>
                    <span className={styles.modalSectionLabel}>{t('aiQueue.response')}</span>
                    <button
                      className={styles.copyBtn}
                      onClick={() => handleCopy(detailTask.response, 'response')}
                      title={t('aiQueue.copyResponse')}
                    >
                      <MdContentCopy size={14} />
                      {copiedField === 'response' ? t('common.copied') : t('common.copy')}
                    </button>
                  </div>
                  <div className={styles.responseText}>
                    <ReactMarkdown>{detailTask.response}</ReactMarkdown>
                  </div>
                </div>
              )}

              {!detailTask.prompt && !detailTask.response && (
                <p className={styles.emptyText}>{t('aiQueue.noTaskData')}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
