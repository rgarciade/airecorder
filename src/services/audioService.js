export async function getSystemMicrophones() {
  try {
    // Obtener la lista de dispositivos de audio
    const devices = await navigator.mediaDevices.enumerateDevices();
    
    // Filtrar solo los dispositivos de entrada de audio (micrófonos)
    const microphones = devices
      .filter(device => device.kind === 'audioinput')
      .map(device => ({
        value: device.deviceId,
        label: device.label || `Micrófono ${device.deviceId.slice(0, 5)}...`
      }));

    return microphones;
  } catch (error) {
    console.error('Error al obtener los micrófonos:', error);
    return [];
  }
}

class AudioRecorder {
  constructor(options = {}) {
    this.options = {
      frequency: 44100,
      channels: 1,
      bitwidth: 16,
      encoding: 'signed-integer',
      device: 'default',
      duration: 4, // 4 segundos por defecto
      ...options
    };

    this.mediaRecorder = null;
    this.audioChunks = [];
    this.recordingStartTime = null;
    this.isRecording = false;
    this.onDataCallback = null;
    this.onStopCallback = null;
    this.recordingTimeout = null;
    this.audioContext = null;
    this.microphoneStream = null;
  }

  async start(deviceId = null, duration = null) {
    if (this.isRecording) {
      console.log('Ya está grabando');
      return;
    }

    try {
      // Usar duración especificada o la por defecto, o sin timeout si es null
      const recordingDuration = duration || this.options.duration;

      // Crear contexto de audio para grabar solo el micrófono
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();

      // 1. Obtener stream del micrófono
      const microphoneConstraints = {
        audio: {
          deviceId: deviceId ? { exact: deviceId } : undefined,
          sampleRate: this.options.frequency,
          channelCount: this.options.channels,
          sampleSize: this.options.bitwidth,
          echoCancellation: true,        // Cancelación de eco
          noiseSuppression: true,        // Supresión de ruido
          autoGainControl: true,            // Baja latencia
          volume: 0.8                   // Reducir volumen del micrófono
        }
      };

      this.microphoneStream = await navigator.mediaDevices.getUserMedia(microphoneConstraints);
      console.log('Stream de micrófono obtenido');

      // 2. Configurar MediaRecorder con el stream del micrófono
      this.mediaRecorder = new MediaRecorder(this.microphoneStream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      this.audioChunks = [];
      this.isRecording = true;
      this.recordingStartTime = Date.now();

      // Configurar eventos
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
          if (this.onDataCallback) {
            this.onDataCallback(event.data);
          }
        }
      };

      this.mediaRecorder.onstop = () => {
        this.handleRecordingStop();
      };

      // Iniciar grabación
      this.mediaRecorder.start();
      console.log(`Grabación iniciada ${duration ? `por ${recordingDuration} segundos` : 'manualmente'} (solo micrófono)`);

      // Configurar timeout para detener automáticamente solo si hay duración
      if (duration && duration > 0) {
        this.recordingTimeout = setTimeout(() => {
          this.stop();
        }, recordingDuration * 1000);
      }

    } catch (error) {
      console.error('Error al iniciar la grabación:', error);
      this.stop();
      throw error;
    }
  }

  stop() {
    if (!this.isRecording) {
      console.log('No hay grabación activa');
      return;
    }

    try {
      if (this.recordingTimeout) {
        clearTimeout(this.recordingTimeout);
        this.recordingTimeout = null;
      }

      if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
        this.mediaRecorder.stop();
      }

      // Detener todos los streams
      if (this.microphoneStream) {
        this.microphoneStream.getTracks().forEach(track => track.stop());
      }

      // Cerrar contexto de audio
      if (this.audioContext) {
        this.audioContext.close();
      }

      this.isRecording = false;
      console.log('Grabación detenida');

    } catch (error) {
      console.error('Error al detener la grabación:', error);
    }
  }

  handleRecordingStop() {
    if (this.audioChunks.length > 0) {
      // Crear blob con los datos de audio mezclado
      const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm;codecs=opus' });
      
      // Crear URL para el blob
      const audioUrl = URL.createObjectURL(audioBlob);
      
      const duration = this.recordingStartTime ? (Date.now() - this.recordingStartTime) / 1000 : 0;
      
      const recordingData = {
        blob: audioBlob,
        url: audioUrl,
        duration: duration,
        size: audioBlob.size,
        timestamp: new Date().toISOString(),
        type: 'mixed' // Indicar que es una grabación mezclada
      };

      if (this.onStopCallback) {
        this.onStopCallback(recordingData);
      }

      console.log(`Grabación mezclada completada: ${duration.toFixed(2)} segundos, ${audioBlob.size} bytes`);
      
      return recordingData;
    }
  }

  // Métodos para configurar callbacks
  onData(callback) {
    this.onDataCallback = callback;
  }

  onStop(callback) {
    this.onStopCallback = callback;
  }

  // Método para obtener estadísticas
  getStats() {
    if (!this.isRecording) return null;
    
    const elapsedTime = (Date.now() - this.recordingStartTime) / 1000;
    const totalSize = this.audioChunks.reduce((sum, chunk) => sum + chunk.size, 0);
    
    return {
      elapsedTime: elapsedTime.toFixed(2),
      totalSize,
      isRecording: this.isRecording,
      type: 'mixed'
    };
  }
}

// Función de conveniencia para grabación rápida
export async function recordAudio(deviceId = null, duration = 4) {
  const recorder = new AudioRecorder();
  
  return new Promise((resolve, reject) => {
    recorder.onStop((recordingData) => {
      resolve(recordingData);
    });

    recorder.start(deviceId, duration).catch(reject);
  });
}

// Exportar la clase para uso avanzado
export { AudioRecorder }; 

// Nueva clase específica para grabación del audio del sistema
class SystemAudioRecorder {
  constructor() {
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.isRecording = false;
    this.recordingStartTime = null;
    this.systemStream = null;
    this.recordingTimeout = null;
  }

  async startSystemRecording(duration = 4) {
    if (this.isRecording) {
      console.log('Ya está grabando audio del sistema');
      return;
    }

    try {
      console.log('Solicitando captura de audio del sistema...');
      
      // Usar getDisplayMedia que ahora está manejado por setDisplayMediaRequestHandler
      this.systemStream = await navigator.mediaDevices.getDisplayMedia({
        video: true, // Requerido por la API
        audio: true  // Solicitar audio del sistema
      });

      console.log('Stream obtenido, verificando pistas de audio...');

      // Verificar si tiene audio
      const audioTracks = this.systemStream.getAudioTracks();
      console.log('Pistas de audio encontradas:', audioTracks.length);
      
      if (!audioTracks || audioTracks.length === 0) {
        throw new Error('No se pudo capturar el audio del sistema. La fuente no tiene audio disponible.');
      }

      // Detener la pista de video (no la necesitamos para grabar)
      const videoTracks = this.systemStream.getVideoTracks();
      if (videoTracks && videoTracks.length > 0) {
        console.log('Deteniendo pistas de video...');
        videoTracks.forEach(track => track.stop());
      }

      console.log('Configurando MediaRecorder...');

      // Configurar MediaRecorder
      this.mediaRecorder = new MediaRecorder(this.systemStream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      this.audioChunks = [];
      this.isRecording = true;
      this.recordingStartTime = Date.now();

      // Configurar eventos
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
          console.log('Chunk de audio recibido:', event.data.size, 'bytes');
        }
      };

      this.mediaRecorder.onstop = () => {
        console.log('MediaRecorder detenido, procesando grabación...');
        this.handleSystemRecordingStop();
      };

      // Iniciar grabación
      this.mediaRecorder.start();
      console.log(`Grabación de audio del sistema iniciada ${duration ? `por ${duration} segundos` : 'manualmente'}`);

      // Configurar timeout para detener automáticamente solo si hay duración
      if (duration && duration > 0) {
        this.recordingTimeout = setTimeout(() => {
          this.stopSystemRecording();
        }, duration * 1000);
      }

      return { success: true, message: 'Grabación del sistema iniciada' };

    } catch (error) {
      console.error('Error al iniciar la grabación del sistema:', error);
      
      let errorMessage = error.message;
      if (error.message.includes('Error starting capture') || error.message.includes('Permission denied')) {
        errorMessage = 'Error de permisos. En macOS, asegúrate de permitir "Grabación de pantalla" para esta aplicación en Ajustes del Sistema > Privacidad y Seguridad.';
      }
      
      this.stopSystemRecording();
      throw new Error(errorMessage);
    }
  }

  stopSystemRecording() {
    if (!this.isRecording) {
      return;
    }

    try {
      console.log('Deteniendo grabación del sistema...');
      
      if (this.recordingTimeout) {
        clearTimeout(this.recordingTimeout);
        this.recordingTimeout = null;
      }

      if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
        this.mediaRecorder.stop();
      }

      // Detener el stream
      if (this.systemStream) {
        this.systemStream.getTracks().forEach(track => track.stop());
      }

      this.isRecording = false;
      console.log('Grabación del sistema detenida');

    } catch (error) {
      console.error('Error al detener la grabación del sistema:', error);
    }
  }

  async handleSystemRecordingStop() {
    console.log('Procesando grabación terminada...');
    console.log('Chunks de audio recolectados:', this.audioChunks.length);
    
    if (this.audioChunks.length > 0) {
      // Crear blob con los datos de audio del sistema
      const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm;codecs=opus' });
      console.log('Blob de audio creado:', audioBlob.size, 'bytes');
      
      const duration = this.recordingStartTime ? (Date.now() - this.recordingStartTime) / 1000 : 0;
      const timestamp = new Date().toISOString();
      
      // Guardar el archivo en el directorio especificado
      try {
        await this.saveSystemAudioFile(audioBlob, timestamp);
        console.log(`Grabación del sistema completada: ${duration.toFixed(2)} segundos, ${audioBlob.size} bytes`);
        return { success: true, duration, size: audioBlob.size, timestamp };
      } catch (error) {
        console.error('Error al guardar el archivo:', error);
        throw error;
      }
    } else {
      throw new Error('No se grabaron datos de audio');
    }
  }

  async saveSystemAudioFile(audioBlob, timestamp) {
    // Usar la API de Electron para guardar el archivo
    if (window.electronAPI && window.electronAPI.saveSystemAudio) {
      const arrayBuffer = await audioBlob.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      const fileName = `system_audio_${timestamp.replace(/[:.]/g, '-')}.webm`;
      
      console.log('Guardando archivo:', fileName);
      const result = await window.electronAPI.saveSystemAudio(uint8Array, fileName);
      if (!result.success) {
        throw new Error(result.error);
      }
      console.log('Archivo guardado exitosamente en:', result.filePath);
      return result;
    } else {
      throw new Error('API de Electron no disponible para guardar archivos');
    }
  }
}

// Función de conveniencia para grabar solo audio del sistema
export async function recordSystemAudio(duration = 4) {
  const recorder = new SystemAudioRecorder();
  
  return new Promise((resolve, reject) => {
    recorder.startSystemRecording(duration)
      .then(() => {
        // Esperar a que termine la grabación
        const checkInterval = setInterval(() => {
          if (!recorder.isRecording) {
            clearInterval(checkInterval);
            resolve({ success: true, message: 'Grabación del sistema completada' });
          }
        }, 100);
      })
      .catch(reject);
  });
}

// Exportar la nueva clase
export { SystemAudioRecorder }; 

// Nueva clase para grabación mezclada (micrófono + sistema)
class MixedAudioRecorder {
  constructor() {
    this.audioRecorder = null;
    this.systemRecorder = null;
    this.isRecording = false;
    this.recordingStartTime = null;
    this.recordingTimeout = null;
    this.onStopCallback = null;
    this.microphoneAudioData = null;
    this.systemAudioData = null;
    this.audioContext = null;
    this.recordingName = null; // Para guardar el nombre de la grabación
    this.shouldDiscard = false; // Flag para indicar si se debe descartar la grabación
  }

  async startMixedRecording(deviceId = null, duration = 4) {
    if (this.isRecording) {
      console.log('Ya está grabando audio dual');
      return;
    }

    try {
      console.log('Iniciando grabación dual (micrófono + sistema por separado)...');
      
      this.isRecording = true;
      this.recordingStartTime = Date.now();
      this.microphoneAudioData = null;
      this.systemAudioData = null;
      this.shouldDiscard = false; // Resetear flag de descarte

      // Crear contexto de audio
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();

      // Inicializar ambos grabadores
      this.audioRecorder = new AudioRecorder();
      this.systemRecorder = new SystemAudioRecorder();

      // Configurar callbacks para cuando terminen las grabaciones
      let completedRecordings = 0;
      const totalRecordings = 2;

      const checkCompletion = () => {
        completedRecordings++;
        console.log(`Grabación completada: ${completedRecordings}/${totalRecordings}`);
        
        if (completedRecordings === totalRecordings) {
          console.log('Ambas grabaciones completadas, guardando archivos por separado...');
          this.handleSeparateRecordingStop();
        }
      };

      // Configurar callback para micrófono
      this.audioRecorder.onStop((recordingData) => {
        console.log('Grabación de micrófono completada');
        this.microphoneAudioData = recordingData;
        checkCompletion();
      });

      // Iniciar la grabación del sistema primero
      console.log('Iniciando grabación del sistema...');
      await this.systemRecorder.startSystemRecording(duration);
      
      // Configurar callback personalizado para sistema
      if (this.systemRecorder.mediaRecorder) {
        const originalOnStop = this.systemRecorder.mediaRecorder.onstop;
        
        this.systemRecorder.mediaRecorder.onstop = () => {
          console.log('Grabación del sistema completada');
          if (this.systemRecorder.audioChunks.length > 0) {
            const audioBlob = new Blob(this.systemRecorder.audioChunks, { type: 'audio/webm;codecs=opus' });
            const audioUrl = URL.createObjectURL(audioBlob);
            const duration = this.systemRecorder.recordingStartTime ? (Date.now() - this.systemRecorder.recordingStartTime) / 1000 : 0;
            
            this.systemAudioData = {
              blob: audioBlob,
              url: audioUrl,
              duration: duration,
              size: audioBlob.size,
              timestamp: new Date().toISOString(),
              type: 'system'
            };
          }
          checkCompletion();
        };
      } else {
        throw new Error('No se pudo inicializar la grabación del sistema');
      }

      // Iniciar la grabación del micrófono
      console.log('Iniciando grabación del micrófono...');
      await this.audioRecorder.start(deviceId, duration);
      
      console.log('Ambas grabaciones iniciadas correctamente');

      // Solo configurar timeout si se especifica una duración
      if (duration && duration > 0) {
        this.recordingTimeout = setTimeout(() => {
          this.stopMixedRecording();
        }, duration * 1000);
      }

      return { success: true, message: 'Grabación dual iniciada' };

    } catch (error) {
      console.error('Error al iniciar la grabación dual:', error);
      this.stopMixedRecording();
      throw error;
    }
  }

  stopMixedRecording() {
    if (!this.isRecording) {
      return;
    }

    try {
      console.log('Deteniendo grabación dual...');
      
      if (this.recordingTimeout) {
        clearTimeout(this.recordingTimeout);
        this.recordingTimeout = null;
      }

      // Detener ambas grabaciones
      if (this.audioRecorder) {
        this.audioRecorder.stop();
      }
      
      if (this.systemRecorder) {
        this.systemRecorder.stopSystemRecording();
      }

      this.isRecording = false;
      console.log('Grabación dual detenida');

    } catch (error) {
      console.error('Error al detener la grabación dual:', error);
    }
  }

  stopAndDiscard() {
    if (!this.isRecording) {
      return;
    }

    try {
      console.log('Descartando grabación...');
      
      // Marcar que no se debe guardar
      this.shouldDiscard = true;
      
      if (this.recordingTimeout) {
        clearTimeout(this.recordingTimeout);
        this.recordingTimeout = null;
      }

      // Detener ambas grabaciones
      if (this.audioRecorder) {
        this.audioRecorder.stop();
      }
      
      if (this.systemRecorder) {
        this.systemRecorder.stopSystemRecording();
      }

      // Limpiar datos de audio
      this.microphoneAudioData = null;
      this.systemAudioData = null;
      this.recordingName = null;

      this.isRecording = false;
      console.log('Grabación descartada');

    } catch (error) {
      console.error('Error al descartar la grabación:', error);
    }
  }

  async handleSeparateRecordingStop() {
    try {
      console.log('Procesando archivos de grabación separados...');
      
      // Si se marcó para descartar, no guardar nada
      if (this.shouldDiscard) {
        console.log('Grabación marcada para descarte, no se guardará');
        this.shouldDiscard = false;
        this.microphoneAudioData = null;
        this.systemAudioData = null;
        this.recordingName = null;
        return;
      }
      
      if (!this.microphoneAudioData || !this.systemAudioData) {
        throw new Error('Faltan datos de audio para guardar');
      }

      const timestamp = new Date().toISOString();
      const folderName = this.recordingName || `grabacion_${timestamp.replace(/[:.]/g, '-')}`;

      // Guardar ambos archivos en la misma carpeta
      const results = await Promise.all([
        this.saveSeparateAudioFile(this.microphoneAudioData.blob, folderName, 'microphone'),
        this.saveSeparateAudioFile(this.systemAudioData.blob, folderName, 'system')
      ]);

      const recordingData = {
        success: true,
        folderName: folderName,
        files: {
          microphone: results[0],
          system: results[1]
        },
        duration: Math.max(this.microphoneAudioData.duration, this.systemAudioData.duration),
        timestamp: timestamp,
        type: 'separate'
      };

      console.log('Grabación dual completada:', recordingData);
      
      if (this.onStopCallback) {
        this.onStopCallback(recordingData);
      }

      // Limpiar recursos
      this.cleanup();

    } catch (error) {
      console.error('Error al guardar archivos separados:', error);
      if (this.onStopCallback) {
        this.onStopCallback({ error: error.message });
      }
      this.cleanup();
    }
  }

  async saveSeparateAudioFile(audioBlob, folderName, audioType) {
    // Usar la API de Electron para guardar archivos separados
    if (window.electronAPI && window.electronAPI.saveSeparateAudio) {
      const arrayBuffer = await audioBlob.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      const fileName = `${folderName}-${audioType}.webm`;
      
      console.log(`Guardando archivo de ${audioType}:`, fileName);
      const result = await window.electronAPI.saveSeparateAudio(uint8Array, folderName, fileName);
      if (!result.success) {
        throw new Error(result.error);
      }
      console.log(`Archivo de ${audioType} guardado exitosamente en:`, result.filePath);
      return result;
    } else {
      throw new Error('API de Electron no disponible para guardar archivos separados');
    }
  }

  // Nuevo método para detener y guardar con nombre personalizado
  async stopAndSave(customFolderName) {
    if (!this.isRecording) {
      throw new Error('No hay grabación activa');
    }

    // Guardar el nombre personalizado para usar en handleSeparateRecordingStop
    this.recordingName = customFolderName;

    return new Promise((resolve, reject) => {
      // Configurar callback temporal para manejar el guardado personalizado
      const originalCallback = this.onStopCallback;
      
      this.onStopCallback = async (recordingData) => {
        try {
          if (recordingData.error) {
            reject(new Error(recordingData.error));
            return;
          }

          // Restaurar callback original si existía
          this.onStopCallback = originalCallback;
          
          resolve(recordingData);
          
          // Llamar al callback original si existía
          if (originalCallback) {
            originalCallback(recordingData);
          }
        } catch (error) {
          this.onStopCallback = originalCallback;
          reject(error);
        }
      };

      // Detener la grabación
      this.stopMixedRecording();
    });
  }

  cleanup() {
    // Limpiar recursos
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    
    this.audioRecorder = null;
    this.systemRecorder = null;
    this.microphoneAudioData = null;
    this.systemAudioData = null;
  }

  // Métodos para configurar callbacks
  onStop(callback) {
    this.onStopCallback = callback;
  }

  // Método para obtener estadísticas
  getStats() {
    if (!this.isRecording) return null;
    
    const elapsedTime = (Date.now() - this.recordingStartTime) / 1000;
    
    return {
      elapsedTime: elapsedTime.toFixed(2),
      isRecording: this.isRecording,
      type: 'mixed'
    };
  }
}

// Función de conveniencia para grabación dual (archivos separados)
export async function recordMixedAudio(deviceId = null, duration = 4) {
  const recorder = new MixedAudioRecorder();
  
  return new Promise((resolve, reject) => {
    recorder.onStop((recordingData) => {
      if (recordingData.error) {
        reject(new Error(recordingData.error));
      } else {
        resolve(recordingData);
      }
    });

    recorder.startMixedRecording(deviceId, duration).catch(reject);
  });
}

// Exportar la clase con el nuevo nombre más descriptivo
export { MixedAudioRecorder as DualAudioRecorder };

// Mantener la exportación original para compatibilidad
export { MixedAudioRecorder }; 