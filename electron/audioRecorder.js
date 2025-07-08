/* global require, process, module */
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const ffmpeg = require('ffmpeg-static');
const os = require('os');
const AudioRecorder = require('node-audiorecorder');

class AudioManager {
  constructor() {
    this.isRecording = false;
    this.recorder = null;
    this.outputDir = this.getOutputDirectory();
    this.deviceMap = new Map(); // Mapa para relacionar IDs con nombres de dispositivos
  }

  getOutputDirectory() {
    // Obtener la ruta del escritorio
    const desktopPath = path.join(os.homedir(), 'Desktop');
    const recorderPath = path.join(desktopPath, 'recorder');

    // Crear el directorio si no existe
    if (!fs.existsSync(recorderPath)) {
      fs.mkdirSync(recorderPath, { recursive: true });
    }

    return recorderPath;
  }

  // Generar un ID seguro para el dispositivo
  generateDeviceId(name) {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '_') // Reemplazar caracteres no alfanuméricos con _
      .replace(/_+/g, '_') // Reemplazar múltiples _ consecutivos con uno solo
      .replace(/^_|_$/g, ''); // Eliminar _ al inicio y final
  }

  async getAudioDevices() {
    return new Promise((resolve) => {
      if (process.platform === 'darwin') {
        // En macOS, usar system_profiler para obtener los dispositivos de audio
        exec('system_profiler SPAudioDataType', (error, stdout) => {
          if (error) {
            console.error('Error getting audio devices:', error);
            resolve([{ id: 'default', name: 'Default Microphone', type: 'input' }]);
            return;
          }

          const devices = [];
          const lines = stdout.split('\n');
          const seenDevices = new Set();

          lines.forEach(line => {
            const trimmedLine = line.trim();
            
            // Detectar nuevo dispositivo
            if (trimmedLine.includes(':') && !trimmedLine.includes('Audio:')) {
              const name = trimmedLine.replace(':', '').trim();
              // Solo añadir dispositivos que parezcan micrófonos y no estén duplicados
              if (!seenDevices.has(name) && (
                  name.toLowerCase().includes('mic') || 
                  name.toLowerCase().includes('input') || 
                  name.toLowerCase().includes('audio') ||
                  name.toLowerCase().includes('built-in'))) {
                const deviceId = this.generateDeviceId(name);
                this.deviceMap.set(deviceId, name); // Guardar la relación ID-nombre
                const device = {
                  id: deviceId,
                  name: name,
                  type: 'input'
                };
                devices.push(device);
                seenDevices.add(name);
              }
            }
          });

          // Si no se encontraron dispositivos, añadir el por defecto
          if (devices.length === 0) {
            const defaultDevice = { id: 'default', name: 'Default Microphone', type: 'input' };
            this.deviceMap.set('default', 'default');
            devices.push(defaultDevice);
          }

          resolve(devices);
        });
      } else {
        // Para Linux, mantener la implementación existente
        exec('pactl list short sources', (error, stdout) => {
          if (error) {
            console.error('Error getting audio devices:', error);
            resolve([{ id: 'default', name: 'Default Microphone', type: 'input' }]);
            return;
          }

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

          if (devices.length === 0) {
            devices.push({ id: 'default', name: 'Default Microphone', type: 'input' });
          }

          resolve(devices);
        });
      }
    });
  }

  async startTestRecording(microphoneId = 'default', duration = 4) {
    if (this.isRecording) {
      throw new Error('Ya hay una grabación en progreso');
    }

    this.isRecording = true;
    
    // Asegurarse de que el directorio existe
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }

    const timestamp = new Date().getTime();
    const micOutput = path.join(this.outputDir, `grabacion-${timestamp}.wav`);

    return new Promise((resolve, reject) => {
      try {
        if (process.platform === 'darwin') {
          // Obtener el nombre real del dispositivo desde el mapa
          const deviceName = this.deviceMap.get(microphoneId);
          if (!deviceName) {
            this.isRecording = false;
            reject(new Error('Dispositivo no encontrado'));
            return;
          }

          // Configuración para macOS usando node-audiorecorder
          const options = {
            program: 'rec',     // Usar SoX
            device: null,       // Usar dispositivo por defecto
            bits: 16,           // Profundidad de bits
            channels: 1,        // Mono
            encoding: 'signed-integer',
            rate: 44100,        // Reducir la frecuencia de muestreo
            type: 'wav',        // Formato de salida
            silence: 0,         // No eliminar silencio
            debug: true,        // Activar debug
            verbose: true,      // Mostrar más información
            audioType: 'coreaudio', // Especificar el driver de audio
            options: [
              '-b', '32',      // Aumentar el tamaño del buffer
              '--buffer', '256000', // Tamaño del buffer en bytes
              '-q',            // Modo silencioso
              micOutput        // Archivo de salida como último argumento
            ]
          };

          console.log('Iniciando grabación con opciones:', options);

          // Crear el grabador
          this.recorder = new AudioRecorder(options, console);

          // Manejar errores
          this.recorder.on('error', error => {
            console.error('Error en la grabación:', error);
            this.isRecording = false;
            this.recorder = null;
            reject(new Error('Error al grabar el micrófono'));
          });

          // Manejar el fin de la grabación
          this.recorder.on('complete', () => {
            console.log('Grabación completada');
            this.isRecording = false;
            this.recorder = null;
            
            // Esperar un momento para asegurarnos de que el archivo se ha escrito
            setTimeout(() => {
              if (!fs.existsSync(micOutput)) {
                console.error('El archivo de salida no existe:', micOutput);
                reject(new Error('No se pudo crear el archivo de audio'));
                return;
              }

              const stats = fs.statSync(micOutput);
              if (stats.size === 0) {
                console.error('El archivo de salida está vacío:', micOutput);
                reject(new Error('El archivo de audio está vacío'));
                return;
              }

              console.log('Archivo de audio creado correctamente:', micOutput, 'tamaño:', stats.size);
              resolve({
                microphoneFile: micOutput,
                duration: duration
              });
            }, 500); // Esperar 500ms para asegurarnos de que el archivo se ha escrito
          });

          // Manejar el cierre del proceso
          this.recorder.on('close', code => {
            console.log('Proceso de grabación cerrado con código:', code);
            if (code !== 0 && this.isRecording) {
              this.isRecording = false;
              this.recorder = null;
              reject(new Error(`Error en el proceso de grabación (código ${code})`));
              return;
            }
          });

          // Manejar la salida del proceso una vez iniciado
          this.recorder.on('start', () => {
            console.log('Grabador iniciado correctamente');
            if (this.recorder.process) {
              this.recorder.process.stdout.on('data', data => {
                console.log('Salida del grabador:', data.toString());
              });

              this.recorder.process.stderr.on('data', data => {
                console.error('Error del grabador:', data.toString());
              });
            }
          });

          // Iniciar grabación
          console.log('Iniciando grabador...');
          try {
            this.recorder.start();
          } catch (error) {
            console.error('Error al iniciar el grabador:', error);
            this.isRecording = false;
            this.recorder = null;
            reject(error);
          }

          // Detener después de la duración especificada
          setTimeout(() => {
            if (this.recorder && this.isRecording) {
              console.log('Deteniendo grabación por timeout...');
              this.stopRecording();
            }
          }, duration * 1000);

        } else {
          // En Linux, mantener la implementación existente con FFmpeg
          let micCommand = `${ffmpeg} `
            + `-f pulse `
            + `-thread_queue_size 8192 `
            + `-i ${microphoneId} `
            + `-t ${duration} `
            + `-acodec pcm_s16le `
            + `-ar 48000 `
            + `-ac 1 `
            + `-y `
            + `"${micOutput}"`;

          exec(micCommand, (error, stdout, stderr) => {
            this.isRecording = false;

            if (error) {
              console.error('Error recording microphone:', error);
              console.error('Command:', micCommand);
              console.error('Error details:', stderr);
              reject(new Error('Error al grabar el micrófono'));
              return;
            }

            if (!fs.existsSync(micOutput) || fs.statSync(micOutput).size === 0) {
              reject(new Error('No se pudo crear el archivo de audio correctamente'));
              return;
            }

            resolve({
              microphoneFile: micOutput,
              duration: duration
            });
          });
        }

        // Timeout de seguridad
        setTimeout(() => {
          if (this.isRecording) {
            console.log('Timeout de seguridad activado');
            this.stopRecording();
            reject(new Error('Timeout en la grabación'));
          }
        }, (duration + 2) * 1000);

      } catch (error) {
        console.error('Error inesperado:', error);
        this.stopRecording();
        reject(error);
      }
    });
  }

  stopRecording() {
    console.log('Deteniendo grabación...');
    if (this.recorder) {
      try {
        // Intentar detener la grabación
        this.recorder.stop();
        
        // Esperar un momento y verificar si el proceso sigue activo
        setTimeout(() => {
          if (this.recorder && this.recorder.process) {
            console.log('Forzando cierre del proceso de grabación...');
            this.recorder.process.kill();
          }
        }, 1000);
      } catch (error) {
        console.error('Error al detener la grabación:', error);
        // Intentar forzar el cierre del proceso si existe
        if (this.recorder && this.recorder.process) {
          this.recorder.process.kill();
        }
      }
      this.recorder = null;
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

module.exports = AudioManager;