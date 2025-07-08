/* global require, process */
const mic = require('node-microphone');
const fs = require('fs');
const path = require('path');
const os = require('os');

class LongRecorder {
  constructor() {
    this.isRecording = false;
    this.currentFragment = 1;
    this.microphone = null;
    this.currentStream = null;
    this.baseDir = path.join(os.homedir(), 'Desktop', 'recorder');
    this.sessionDir = null;
    this.fragmentDuration = 5 * 60 * 1000; // 5 minutos por fragmento
    this.startTime = null;
    this.totalSize = 0;
  }

  start() {
    if (this.isRecording) {
      console.log('Ya hay una grabación en curso');
      return;
    }

    // Crear directorio para la sesión
    this.sessionDir = path.join(this.baseDir, `session-${Date.now()}`);
    if (!fs.existsSync(this.sessionDir)) {
      fs.mkdirSync(this.sessionDir, { recursive: true });
    }

    this.isRecording = true;
    this.startTime = Date.now();
    this.microphone = new mic();

    // Manejar errores
    this.microphone.on('error', (error) => {
      console.error('Error en el micrófono:', error);
      this.stop();
    });

    console.log('Iniciando grabación...');
    console.log('Directorio de la sesión:', this.sessionDir);

    // Iniciar la grabación del primer fragmento
    this.startNewFragment();

    // Mostrar estadísticas cada minuto
    this.statsInterval = setInterval(() => {
      const duration = (Date.now() - this.startTime) / 1000;
      console.log(`
Estadísticas de grabación:
- Tiempo transcurrido: ${Math.floor(duration)} segundos
- Fragmento actual: ${this.currentFragment}
- Tamaño total: ${(this.totalSize / 1024 / 1024).toFixed(2)} MB
- Directorio: ${this.sessionDir}
      `);
    }, 60000);
  }

  startNewFragment() {
    const fragmentPath = path.join(this.sessionDir, `fragment-${this.currentFragment}.raw`);
    console.log(`Iniciando fragmento ${this.currentFragment}`);

    try {
      // Detener el fragmento anterior si existe
      if (this.currentStream) {
        this.currentStream.end();
      }

      // Crear stream para el nuevo fragmento
      this.currentStream = fs.createWriteStream(fragmentPath);
      
      // Iniciar la grabación
      const micStream = this.microphone.startRecording();

      // Manejar los datos
      micStream.on('data', (data) => {
        if (this.isRecording) {
          this.totalSize += data.length;
          this.currentStream.write(data);
        }
      });

      // Programar el siguiente fragmento
      setTimeout(() => {
        if (this.isRecording) {
          this.currentFragment++;
          this.startNewFragment();
        }
      }, this.fragmentDuration);

    } catch (error) {
      console.error('Error al iniciar fragmento:', error);
      this.stop();
    }
  }

  stop() {
    if (!this.isRecording) {
      console.log('No hay grabación en curso');
      return;
    }

    console.log('Deteniendo grabación...');
    
    clearInterval(this.statsInterval);
    
    if (this.microphone) {
      try {
        this.microphone.stopRecording();
      } catch (error) {
        console.error('Error al detener el micrófono:', error);
      }
    }

    if (this.currentStream) {
      this.currentStream.end();
    }

    this.isRecording = false;
    this.microphone = null;
    this.currentStream = null;

    const duration = (Date.now() - this.startTime) / 1000;
    console.log(`
Grabación finalizada:
- Duración total: ${Math.floor(duration)} segundos
- Fragmentos grabados: ${this.currentFragment}
- Tamaño total: ${(this.totalSize / 1024 / 1024).toFixed(2)} MB
- Directorio: ${this.sessionDir}
    `);
  }
}

// Crear instancia del grabador
const recorder = new LongRecorder();

// Iniciar grabación
console.log('Presiona Ctrl+C para detener la grabación');
recorder.start();

// Manejar la señal de interrupción (Ctrl+C)
process.on('SIGINT', () => {
  console.log('\nSeñal de interrupción recibida');
  recorder.stop();
  process.exit(0);
}); 