/* global require, process, module */
const { exec } = require('child_process');
const util = require('util');
const fs = require('fs');
const path = require('path');
const ffmpeg = require('ffmpeg-static');
const os = require('os');
const AudioRecorder = require('node-audiorecorder');

const execPromise = util.promisify(exec);

// --- Funciones Puras y Utilidades ---

const ensureDirectoryExists = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
  return dirPath;
};

const generateDeviceId = (name) => {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
};

const parseMacOSDevices = (stdout) => {
  const devices = [];
  const lines = stdout.split('\n');
  const seenDevices = new Set();
  const deviceMap = new Map();

  lines.forEach(line => {
    const trimmedLine = line.trim();
    if (trimmedLine.includes(':') && !trimmedLine.includes('Audio:')) {
      const name = trimmedLine.replace(':', '').trim();
      const lowerName = name.toLowerCase();
      // Filtrar solo dispositivos de entrada relevantes
      if (!seenDevices.has(name) && (
          lowerName.includes('mic') || 
          lowerName.includes('input') || 
          lowerName.includes('audio') ||
          lowerName.includes('built-in'))) {
        
        const deviceId = generateDeviceId(name);
        deviceMap.set(deviceId, name);
        
        devices.push({
          id: deviceId,
          name: name,
          type: 'input'
        });
        seenDevices.add(name);
      }
    }
  });
  
  return { devices, deviceMap };
};

const parseLinuxDevices = (stdout) => {
  const devices = [];
  const lines = stdout.split('\n').filter(line => line.trim());
  
  lines.forEach(line => {
    const parts = line.split('\t');
    if (parts.length >= 2) {
      const id = parts[1];
      const name = parts[1];
      if (id.includes('input') || id.includes('source')) {
        devices.push({ id, name: `Microphone - ${name}`, type: 'input' });
      }
    }
  });
  return devices;
};

// --- Clase Principal ---

class AudioManager {
  constructor() {
    this.isRecording = false;
    this.recorder = null; // Instancia de node-audiorecorder o ChildProcess
    this.outputDir = this._initOutputDirectory();
    this.deviceMap = new Map();
  }

  _initOutputDirectory() {
    const desktopPath = path.join(os.homedir(), 'Desktop');
    return ensureDirectoryExists(path.join(desktopPath, 'recorder'));
  }

  async getAudioDevices() {
    try {
      if (process.platform === 'darwin') {
        const { stdout } = await execPromise('system_profiler SPAudioDataType');
        const { devices, deviceMap } = parseMacOSDevices(stdout);
        
        // Actualizar el mapa de la instancia
        deviceMap.forEach((val, key) => this.deviceMap.set(key, val));
        
        return this._ensureDefaultDevice(devices);
      } else {
        const { stdout } = await execPromise('pactl list short sources');
        const devices = parseLinuxDevices(stdout);
        return this._ensureDefaultDevice(devices);
      }
    } catch (error) {
      console.error('Error getting audio devices:', error);
      return this._ensureDefaultDevice([]);
    }
  }

  _ensureDefaultDevice(devices) {
    if (devices.length === 0) {
      this.deviceMap.set('default', 'default');
      return [{ id: 'default', name: 'Default Microphone', type: 'input' }];
    }
    return devices;
  }

  async startTestRecording(microphoneId = 'default', duration = 4) {
    if (this.isRecording) {
      throw new Error('Ya hay una grabación en progreso');
    }

    this.isRecording = true;
    ensureDirectoryExists(this.outputDir);

    const timestamp = new Date().getTime();
    const micOutput = path.join(this.outputDir, `grabacion-${timestamp}.wav`);

    try {
      if (process.platform === 'darwin') {
        return await this._recordMacOS(microphoneId, duration, micOutput);
      } else {
        return await this._recordLinux(microphoneId, duration, micOutput);
      }
    } catch (error) {
      this._cleanupRecording();
      throw error;
    }
  }

  _recordMacOS(microphoneId, duration, outputPath) {
    return new Promise((resolve, reject) => {
      const deviceName = this.deviceMap.get(microphoneId);
      if (!deviceName) {
        return reject(new Error('Dispositivo no encontrado'));
      }

      const options = {
        program: 'rec',
        device: null,
        bits: 16,
        channels: 1,
        encoding: 'signed-integer',
        rate: 44100,
        type: 'wav',
        silence: 0,
        debug: true,
        verbose: true,
        audioType: 'coreaudio',
        options: ['-b', '32', '--buffer', '256000', '-q', outputPath]
      };

      console.log('Iniciando grabación macOS:', options);
      this.recorder = new AudioRecorder(options, console);

      this.recorder.on('error', (err) => {
         console.error('Error grabación:', err);
         reject(new Error('Error al grabar el micrófono'));
      });

      this.recorder.on('complete', () => {
         this._verifyAndResolveRecording(outputPath, duration, resolve, reject);
      });
      
      // Manejo de timeout manual para detener la grabación
      setTimeout(() => {
        if (this.isRecording) {
            console.log('Timeout alcanzado, deteniendo...');
            this.stopRecording();
        }
      }, duration * 1000);

      try {
        this.recorder.start();
      } catch (err) {
        reject(err);
      }
    });
  }

  _recordLinux(microphoneId, duration, outputPath) {
      return new Promise((resolve, reject) => {
        const micCommand = `${ffmpeg} -f pulse -thread_queue_size 8192 -i ${microphoneId} -t ${duration} -acodec pcm_s16le -ar 48000 -ac 1 -y "${outputPath}"`;
        
        // Guardamos el proceso en this.recorder para poder matarlo si hace falta
        this.recorder = exec(micCommand, (error, stdout, stderr) => {
            if (error) {
                console.error('Error recording microphone:', error, stderr);
                return reject(new Error('Error al grabar el micrófono'));
            }
            this._verifyAndResolveRecording(outputPath, duration, resolve, reject);
        });
      });
  }

  _verifyAndResolveRecording(filePath, duration, resolve, reject) {
      this.isRecording = false;
      this.recorder = null;

      // Pequeño delay para asegurar flush a disco
      setTimeout(() => {
          if (!fs.existsSync(filePath)) {
              return reject(new Error('No se pudo crear el archivo de audio'));
          }
          const stats = fs.statSync(filePath);
          if (stats.size === 0) {
              return reject(new Error('El archivo de audio está vacío'));
          }
          
          console.log('Grabación exitosa:', filePath);
          resolve({
              microphoneFile: filePath,
              duration: duration
          });
      }, 500);
  }

  _cleanupRecording() {
      this.stopRecording();
  }

  stopRecording() {
    console.log('Deteniendo grabación...');
    if (this.recorder) {
      try {
        if (this.recorder.stop) {
            // node-audiorecorder
            this.recorder.stop();
            // Asegurar cierre de proceso
            if (this.recorder.process) {
                setTimeout(() => {
                    if (this.recorder && this.recorder.process) {
                        this.recorder.process.kill();
                    }
                }, 1000);
            }
        } else if (this.recorder.kill) {
            // ChildProcess (Linux)
            this.recorder.kill('SIGTERM');
        }
      } catch (error) {
        console.error('Error al detener:', error);
      }
      this.recorder = null;
    }
    this.isRecording = false;
  }

  async getRecordingFiles() {
    if (!this.outputDir || !fs.existsSync(this.outputDir)) return [];
    
    const files = fs.readdirSync(this.outputDir);
    return files
      .filter(file => file.endsWith('.wav'))
      .map(file => ({
        name: file,
        path: path.join(this.outputDir, file),
        size: fs.statSync(path.join(this.outputDir, file)).size
      }));
  }
}

module.exports = AudioManager;
