const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const ffmpeg = require('ffmpeg-static');

class AudioRecorder {
  constructor() {
    this.isRecording = false;
    this.recordingProcess = null;
    this.outputDir = null;
  }

  async getAudioDevices() {
    return new Promise((resolve, reject) => {
      // Para Linux, usar pactl para listar dispositivos
      exec('pactl list short sources', (error, stdout, stderr) => {
        if (error) {
          console.error('Error getting audio devices:', error);
          // Fallback para sistemas sin pulseaudio
          resolve([
            { id: 'default', name: 'Default Microphone', type: 'input' },
            { id: 'monitor', name: 'System Audio (Monitor)', type: 'monitor' }
          ]);
          return;
        }

        const devices = [];
        const lines = stdout.split('\n').filter(line => line.trim());
        
        lines.forEach(line => {
          const parts = line.split('\t');
          if (parts.length >= 2) {
            const id = parts[1];
            const name = parts[1];
            
            if (id.includes('monitor')) {
              devices.push({ id, name: `System Audio - ${name}`, type: 'monitor' });
            } else if (id.includes('input') || id.includes('source')) {
              devices.push({ id, name: `Microphone - ${name}`, type: 'input' });
            }
          }
        });

        if (devices.length === 0) {
          devices.push(
            { id: 'default', name: 'Default Microphone', type: 'input' },
            { id: 'monitor', name: 'System Audio (Monitor)', type: 'monitor' }
          );
        }

        resolve(devices);
      });
    });
  }

  async startTestRecording(microphoneId = 'default', duration = 4) {
    if (this.isRecording) {
      throw new Error('Ya hay una grabación en progreso');
    }

    this.isRecording = true;
    this.outputDir = path.join(require('os').tmpdir(), 'voicenote-test-recordings');
    
    // Crear directorio si no existe
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const micOutput = path.join(this.outputDir, `test-mic-${timestamp}.wav`);
    const systemOutput = path.join(this.outputDir, `test-system-${timestamp}.wav`);
    const mixedOutput = path.join(this.outputDir, `test-mixed-${timestamp}.wav`);

    return new Promise((resolve, reject) => {
      try {
        // Grabar micrófono
        const micCommand = `${ffmpeg} -f pulse -i ${microphoneId} -t ${duration} -acodec pcm_s16le -ar 44100 -ac 1 "${micOutput}"`;
        
        // Grabar audio del sistema (monitor)
        const systemCommand = `${ffmpeg} -f pulse -i ${microphoneId}.monitor -t ${duration} -acodec pcm_s16le -ar 44100 -ac 1 "${systemOutput}"`;
        
        let recordingsCompleted = 0;
        const recordings = [];

        const checkCompletion = () => {
          recordingsCompleted++;
          if (recordingsCompleted >= 2) {
            // Mezclar los dos audios
            const mixCommand = `${ffmpeg} -i "${micOutput}" -i "${systemOutput}" -filter_complex "[0:a][1:a]amix=inputs=2:duration=shortest" -acodec pcm_s16le -ar 44100 "${mixedOutput}"`;
            
            exec(mixCommand, (error, stdout, stderr) => {
              this.isRecording = false;
              
              if (error) {
                console.error('Error mixing audio:', error);
                reject(error);
                return;
              }

              resolve({
                microphoneFile: micOutput,
                systemFile: systemOutput,
                mixedFile: mixedOutput,
                duration: duration
              });
            });
          }
        };

        // Ejecutar grabación de micrófono
        exec(micCommand, (error, stdout, stderr) => {
          if (error) {
            console.error('Error recording microphone:', error);
            // Crear archivo vacío si falla
            fs.writeFileSync(micOutput, '');
          }
          recordings.push('mic');
          checkCompletion();
        });

        // Ejecutar grabación de sistema
        exec(systemCommand, (error, stdout, stderr) => {
          if (error) {
            console.error('Error recording system audio:', error);
            // Crear archivo vacío si falla
            fs.writeFileSync(systemOutput, '');
          }
          recordings.push('system');
          checkCompletion();
        });

        // Timeout de seguridad
        setTimeout(() => {
          if (this.isRecording) {
            this.isRecording = false;
            reject(new Error('Timeout en la grabación'));
          }
        }, (duration + 2) * 1000);

      } catch (error) {
        this.isRecording = false;
        reject(error);
      }
    });
  }

  stopRecording() {
    if (this.recordingProcess) {
      this.recordingProcess.kill();
      this.recordingProcess = null;
    }
    this.isRecording = false;
  }

  async getRecordingFiles() {
    if (!this.outputDir || !fs.existsSync(this.outputDir)) {
      return [];
    }

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

module.exports = AudioRecorder;