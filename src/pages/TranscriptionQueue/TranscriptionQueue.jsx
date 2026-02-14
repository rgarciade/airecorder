import React, { useState, useEffect } from 'react';
import styles from './TranscriptionQueue.module.css';
import { 
  MdGraphicEq, MdAdd, MdSchedule, MdClose, 
  MdMic, MdVideoCameraFront, MdAudiotrack, MdCheck, MdUpload 
} from 'react-icons/md';

export default function TranscriptionQueue({ onBack, onNewRecording, queueState }) {
  const [activeTask, setActiveTask] = useState(null);
  const [queue, setQueue] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  // Sync with prop updates from App.jsx
  useEffect(() => {
    if (queueState) {
      processQueueData(queueState);
      setLoading(false);
    }
  }, [queueState]);

  // Initial load fallback (if prop is empty initially)
  useEffect(() => {
    if (!queueState || (!queueState.active && !queueState.history)) {
        loadQueueData();
    }
  }, []);

  const processQueueData = (data) => {
      if (data && data.active) {
        const active = data.active.find(t => t.status === 'processing');
        const pending = data.active.filter(t => t.status === 'pending');
        
        setActiveTask(active || null);
        setQueue(pending);
        setHistory(data.history || []);
      }
  };

  const loadQueueData = async () => {
    try {
      const result = await window.electronAPI.getTranscriptionQueue();
      if (result.success) {
        processQueueData(result);
      }
    } catch (error) {
      console.error('Error loading queue data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStepNumber = (step) => {
    switch (step) {
      case 'queued': return '1/3';
      case 'transcribing': return '2/3';
      case 'analyzing': return '3/3';
      default: return '1/3';
    }
  };

  const getElapsedTime = (startedAt) => {
    if (!startedAt) return '0s';
    // Ensure UTC interpretation by appending Z if missing (SQLite standard format)
    const timeStr = startedAt.endsWith('Z') ? startedAt : startedAt + 'Z';
    const start = new Date(timeStr).getTime();
    const now = new Date().getTime();
    const diff = Math.floor((now - start) / 1000);
    
    if (diff < 0) return '0s'; // Clock skew protection
    if (diff < 60) return `${diff}s`;
    const mins = Math.floor(diff / 60);
    const secs = diff % 60;
    return `${mins}m ${secs}s`;
  };

  const [elapsed, setElapsed] = useState('0s');

  useEffect(() => {
    if (activeTask?.started_at) {
      const timer = setInterval(() => {
        setElapsed(getElapsedTime(activeTask.started_at));
      }, 1000);
      return () => clearInterval(timer);
    } else {
      setElapsed('0s');
    }
  }, [activeTask?.started_at]);

  const handleCancelTask = async (id) => {
    if (!window.confirm("Are you sure you want to cancel this task?")) return;
    try {
      await window.electronAPI.cancelTranscriptionTask(id);
      loadQueueData();
    } catch (error) {
      console.error("Error cancelling task:", error);
    }
  };

  return (
    <div className={styles.container}>
      {/* Navbar */}
      <nav className={styles.navbar}>
        <div className={styles.navLeft}>
          <div className={styles.navIcon}>
            <MdGraphicEq size={24} />
          </div>
          <h1 className={styles.navTitle}>AIRecorder</h1>
        </div>
        <div className={styles.navRight}>
          <div className={styles.systemStatus}>
            <span className={styles.statusDot}></span>
            System Online
          </div>
          <button className={styles.newRecordingBtn} onClick={onNewRecording}>
            <MdAdd size={18} />
            New Recording
          </button>
        </div>
      </nav>

      {/* Main Content Grid */}
      <main className={styles.main}>
        {/* Left Column: Tasks & Queue */}
        <div className={styles.queueColumn}>
          <div className={styles.maxContainer}>
            <div className={styles.sectionHeader}>
              <div>
                <h2 className={styles.sectionTitle}>Live Processing Queue</h2>
                <p className={styles.sectionSubtitle}>
                  Managing {activeTask ? 1 + queue.length : queue.length} active tasks
                </p>
              </div>
              <button className={styles.historyBtn}>View History</button>
            </div>

            {/* Active Task Card */}
            {activeTask ? (
              <div className={styles.activeCard}>
                <div className={styles.activeCardContent}>
                  {/* Progress Circle */}
                  <div className={styles.progressContainer}>
                    <svg className={styles.progressSvg} viewBox="0 0 100 100">
                      <circle className={styles.progressBg} cx="50" cy="50" r="42" fill="transparent" strokeWidth="8"></circle>
                      <circle 
                        className={styles.progressFill} 
                        cx="50" cy="50" r="42" 
                        fill="transparent" 
                        strokeWidth="8"
                        strokeDasharray="264"
                        strokeDashoffset={264 - (264 * activeTask.progress) / 100}
                      ></circle>
                    </svg>
                    <div className={styles.progressText}>
                      <span className={styles.percent}>{activeTask.progress}%</span>
                      <span className={styles.statusLabel}>Processing</span>
                    </div>
                  </div>

                  {/* Task Details */}
                  <div className={styles.taskDetails}>
                    <div className={styles.taskMeta}>
                      <span className={styles.stepBadge}>Step {getStepNumber(activeTask.step)}</span>
                      <span className={styles.modelBadge}>
                        <MdGraphicEq size={12} /> {activeTask.model || 'default'}
                      </span>
                      <span className={styles.timeElapsed}>
                        <MdSchedule size={14} /> {elapsed} elapsed
                      </span>
                    </div>
                    <h3 className={styles.taskName}>{activeTask.recording_name}</h3>
                    <p className={styles.taskStatus}>
                      {activeTask.step === 'transcribing' ? 'Transcribing audio with Whisper...' : 'Finalizing analysis...'}
                    </p>
                    
                    {/* Visual Waveform */}
                    <div className={styles.waveform}>
                      {[...Array(15)].map((_, i) => (
                        <div 
                          key={i} 
                          className={styles.waveBar}
                          style={{ animationDelay: `${i * 0.1}s` }}
                        ></div>
                      ))}
                    </div>
                  </div>

                  {/* Quick Actions */}
                  <div className={styles.activeActions}>
                    <button 
                      className={styles.actionIconBtnDestructive} 
                      title="Cancel Task"
                      onClick={() => handleCancelTask(activeTask.id)}
                    >
                      <MdClose size={20} />
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className={styles.emptyQueue}>
                <p>No active processing tasks.</p>
              </div>
            )}

            {/* Queue List Section */}
            <div className={styles.queueListSection}>
              <h3 className={styles.listTitle}>
                In Queue
                <span className={styles.countBadge}>{queue.length}</span>
              </h3>
              <div className={styles.queueList}>
                {queue.map((item) => (
                  <div key={item.id} className={styles.queueItem}>
                    <div className={styles.itemIcon}>
                      <MdMic size={24} />
                    </div>
                    <div className={styles.itemMain}>
                      <h4 className={styles.itemName}>{item.recording_name}</h4>
                      <div className={styles.itemMeta}>
                        <span className={styles.metaLabel}><MdSchedule size={12} /> Pending</span>
                        <span className={styles.metaLabel}>
                          Added {new Date(item.created_at.endsWith('Z') ? item.created_at : item.created_at + 'Z').toLocaleTimeString()}
                        </span>
                      </div>
                    </div>
                    <div className={styles.itemStatus}>
                      <span className={styles.waitingBadge}>Waiting</span>
                      <button 
                        className={styles.miniCancelBtn}
                        onClick={(e) => { e.stopPropagation(); handleCancelTask(item.id); }}
                        title="Remove from queue"
                      >
                        <MdClose size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Activity Log Sidebar */}
        <div className={styles.logColumn}>
          <div className={styles.logHeader}>
            <h3 className={styles.logTitle}>Activity Log</h3>
            <button className={styles.clearBtn}>Clear All</button>
          </div>
          <div className={styles.logContent}>
            <div className={styles.timeline}>
              {history.map((item) => (
                <div key={item.id} className={styles.logItem}>
                  <div className={`${styles.logDot} ${item.status === 'completed' ? styles.dotSuccess : styles.dotFailed}`}>
                    {item.status === 'completed' ? <MdCheck size={10} /> : <MdClose size={10} />}
                  </div>
                  <div className={styles.logDetails}>
                    <span className={styles.logTime}>
                      {new Date(item.updated_at.endsWith('Z') ? item.updated_at : item.updated_at + 'Z').toLocaleTimeString()}
                    </span>
                    <p className={styles.logText}>
                      Transcription {item.status} for <span className={styles.highlightText}>{item.recording_name}</span>
                    </p>
                    <div className={styles.logBadgeRow}>
                      <span className={item.status === 'completed' ? styles.successBadge : styles.failedBadge}>
                        {item.status === 'completed' ? 'Success' : 'Failed'}
                      </span>
                      <span className={styles.historyModelBadge}>
                        {item.model || 'default'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
              
              {/* Sample log items if history is empty */}
              {history.length === 0 && (
                <div className={styles.emptyLog}>
                  <p>No recent activity.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
