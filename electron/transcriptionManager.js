const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const dbService = require('./database/dbService');

class TranscriptionManager {
  constructor() {
    this.activeTask = null;
    this.process = null;
    this.onUpdateCallback = null;
    this.basePath = null;
    // Don't check queue here, DB isn't ready. Explicitly call checkQueue() from main.js
  }

  setBasePath(path) {
    this.basePath = path;
  }

  setUpdateCallback(callback) {
    this.onUpdateCallback = callback;
  }

  notifyUpdate() {
    if (this.onUpdateCallback) {
      this.onUpdateCallback(this.getState());
    }
  }

  getState() {
    // Return active + queue combined for the frontend format
    // Fetch from DB
    const activeQueue = dbService.getActiveQueue();
    const history = dbService.getQueueHistory();
    
    return {
      active: activeQueue,
      history: history
    };
  }

  getQueueCount() {
    const queue = dbService.getActiveQueue();
    return queue.length;
  }

  addTask(recordingId, options = {}) {
    // Resolve numeric ID if string provided (relative_path)
    let numericId = recordingId;
    let folderName = recordingId;

    if (typeof recordingId === 'string' && isNaN(Number(recordingId))) {
        const rec = dbService.getRecording(recordingId);
        if (rec) {
            numericId = rec.id;
        } else {
            // Try to see if it's already a number in string form
            if (!isNaN(parseInt(recordingId))) {
                numericId = parseInt(recordingId);
            } else {
                console.error(`[Manager] Recording not found in DB for path: ${recordingId}`);
                return { success: false, error: 'Recording not found in DB' };
            }
        }
    } else {
        // It's a number, find the folder name for logging/UI
        const rec = dbService.getRecordingById(recordingId);
        if (rec) folderName = rec.relative_path;
    }

    // Check if already in queue or active
    const status = dbService.getRecordingTaskStatus(numericId);
    if (status && (status.status === 'pending' || status.status === 'processing')) {
        return { success: false, error: 'Already queued' };
    }

    const taskId = dbService.enqueueTask(numericId, options.model);
    this.notifyUpdate();
    this.processQueue();
    return { success: true, taskId };
  }

  checkQueue() {
      // Check periodically or on init if there are pending tasks
      // (in case app restarted while processing)
      // For now, we rely on processQueue calls, but dbService.init resets stuck tasks to pending
      this.processQueue();
  }

  async processQueue() {
    if (this.activeTask) return; // Busy

    const nextTask = dbService.getNextTask();
    if (!nextTask) return; // Empty

    this.activeTask = nextTask;
    
    // Update status to processing in DB
    dbService.updateTask(nextTask.id, 'processing', 'transcribing', 0);
    this.notifyUpdate();

    try {
        await this.runTranscription(this.activeTask);
        
        dbService.updateTask(nextTask.id, 'completed', 'completed', 100);
        this.activeTask = null;
    } catch (error) {
        console.error(`Transcription failed for ${nextTask.id}:`, error);
        // Only mark failed if user didn't cancel it mid-process (which sets activeTask to null)
        // If activeTask is null here, it means it was cancelled
        if (this.activeTask) {
            dbService.updateTask(nextTask.id, 'failed', 'failed', 0, error.message);
            this.activeTask = null;
        }
    }

    this.notifyUpdate();
    this.processQueue(); // Next
  }

  runTranscription(task) {
    return new Promise((resolve, reject) => {
        const scriptPath = path.join(__dirname, '../audio_sync_analyzer.py');
        const pythonPath = '/Users/raul.garciad/Proyectos/personal/airecorder/venv/bin/python'; 

      // Fetch recording details to get relative_path
      let folderName = task.recording_id;
      if (task.recording_id) {
            const recording = dbService.getRecordingById(task.recording_id);
            if (recording && recording.relative_path) {
                folderName = recording.relative_path;
            } else {
                console.warn(`[Manager] No se encontró recording para ID ${task.recording_id}, usando ID como folderName: ${folderName}`);
            }
      }

        console.log(`[Manager] Starting transcription for task ${task.id} (recording: ${folderName})`);
        
        const args = [scriptPath, '--basename', folderName];
        if (this.basePath) {
            args.push('--base_dir', this.basePath);
        }
        if (task.model) {
            args.push('--model', task.model);
        }

        this.process = spawn(pythonPath, args);

        this.process.stdout.on('data', (data) => {
            const message = data.toString().trim();
            console.log(`[Transcription ${task.id}]: ${message}`);
            
            // Simple progress heuristics based on log messages
            if (message.includes('Cargando')) this.updateProgress(10, 'loading');
            if (message.includes('Transcribiendo')) this.updateProgress(30, 'transcribing');
            if (message.includes('Guardando')) this.updateProgress(90, 'saving');
        });

        this.process.stderr.on('data', (data) => {
            console.error(`[Transcription ${task.id} ERR]: ${data}`);
        });

        this.process.on('close', (code) => {
            this.process = null;
            if (code === 0) {
                dbService.updateStatus(folderName, 'transcribed');
                if (task.model) {
                    dbService.updateTranscriptionModel(folderName, task.model);
                }
                
                // Intentar actualizar duración si es 0
                this.updateDurationIfNeeded(folderName);

                resolve();
            } else {
                reject(new Error(`Process exited with code ${code}`));
            }
        });
        
        this.process.on('error', (err) => {
            this.process = null;
            reject(err);
        });
    });
  }

  updateDurationIfNeeded(folderName) {
    if (!this.basePath) return;

    try {
      const recording = dbService.getRecording(folderName);

      // Si la duración es 0, null o no existe, intentamos obtenerla del JSON
      const currentDuration = Number(recording?.duration);
      if (recording && (isNaN(currentDuration) || currentDuration <= 0.1)) {
        const jsonPath = path.join(this.basePath, folderName, 'analysis', 'transcripcion_combinada.json');
        
        if (fs.existsSync(jsonPath)) {
          try {
            const content = fs.readFileSync(jsonPath, 'utf8');
            const data = JSON.parse(content);
            
            if (data.metadata && data.metadata.total_duration !== undefined) {
                const duration = parseFloat(data.metadata.total_duration);
                dbService.updateDuration(folderName, duration);
            }
          } catch (e) {
              console.error(`[Manager] Error reading/parsing JSON: ${e.message}`);
          }
        }
      }
    } catch (error) {
      console.error(`[Manager] Error updating duration: ${error.message}`);
    }
  }

  updateProgress(percent, step) {
      if (this.activeTask) {
          dbService.updateTask(this.activeTask.id, 'processing', step, percent);
          this.notifyUpdate();
      }
  }

  cancelTask(taskIdOrRecordingId) {
      console.log(`[Manager] Request to cancel ID: ${taskIdOrRecordingId}`);
      
      let task = null;

      // 1. Try to find by Task ID directly (most likely case from UI)
      if (!isNaN(Number(taskIdOrRecordingId))) {
          task = dbService.getTaskById(Number(taskIdOrRecordingId));
      }

      // 2. If not found, maybe it was a recording ID (backward compat or diff source)
      if (!task) {
          // If string path, resolve to recording ID first
          let recordingId = taskIdOrRecordingId;
          if (typeof taskIdOrRecordingId === 'string' && isNaN(Number(taskIdOrRecordingId))) {
              const rec = dbService.getRecording(taskIdOrRecordingId);
              if (rec) recordingId = rec.id;
          }
          
          if (!isNaN(Number(recordingId))) {
             const status = dbService.getRecordingTaskStatus(Number(recordingId));
             if (status) {
                 task = dbService.getTaskById(status.id);
             }
          }
      }

      if (!task) {
          console.log(`[Manager] Task not found for ID: ${taskIdOrRecordingId}`);
          return { success: false, error: 'Task not found' };
      }

      const taskId = task.id;
      console.log(`[Manager] Cancelling task ${taskId} (status: ${task.status})`);

      // If active
      if (this.activeTask && this.activeTask.id === taskId) {
          if (this.process) {
              console.log('[Manager] Killing active process');
              this.process.kill(); // SIGTERM
              this.process = null;
          }
          
          dbService.updateTask(taskId, 'failed', 'cancelled', 0, 'Cancelled by user');
          
          this.activeTask = null;
          this.notifyUpdate();
          
          setTimeout(() => this.processQueue(), 1000);
          return { success: true };
      }

      // If pending
      dbService.updateTask(taskId, 'failed', 'cancelled', 0, 'Cancelled by user');
      this.notifyUpdate();
      return { success: true };
  }
}

module.exports = new TranscriptionManager();
