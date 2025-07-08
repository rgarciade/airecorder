const Microphone = require('node-microphone');
const fs = require('fs');
const path = require('path');
const wav = require('wav');

class AudioRecorder {
    constructor(options = {}) {
        this.options = {
            frequency: 44100,
            channels: 1,
            bitwidth: 16,
            encoding: 'signed-integer',
            device: 'default',
            filePrefix: 'recording',
            maxDuration: 5 * 60, // 5 minutos por archivo
            outputDir: path.join(__dirname, '../recordings'),
            ...options
        };

        this.microphone = null;
        this.currentStream = null;
        this.currentFile = null;
        this.currentFileStream = null;
        this.currentWavWriter = null;
        this.recordingStartTime = null;
        this.sessionId = new Date().toISOString().replace(/[:.]/g, '-');
        this.recordingCounter = 0;
        this.totalBytesRecorded = 0;
        this.isRecording = false;

        // Crear directorio de sesión
        this.sessionDir = path.join(this.options.outputDir, this.sessionId);
        if (!fs.existsSync(this.sessionDir)) {
            fs.mkdirSync(this.sessionDir, { recursive: true });
        }
    }

    start() {
        if (this.isRecording) {
            console.log('Ya está grabando');
            return;
        }

        try {
            this.microphone = new Microphone({
                rate: this.options.frequency,
                channels: this.options.channels,
                bitwidth: this.options.bitwidth,
                encoding: this.options.encoding,
                device: this.options.device
            });

            this.isRecording = true;
            this.startNewFile();

            this.currentStream = this.microphone.startRecording();
            
            this.currentStream.on('data', (data) => {
                this.handleAudioData(data);
            });

            this.currentStream.on('error', (error) => {
                console.error('Error en la grabación:', error);
                this.stop();
            });

            console.log('Grabación iniciada');
            this.startStatsInterval();

        } catch (error) {
            console.error('Error al iniciar la grabación:', error);
            this.stop();
        }
    }

    stop() {
        if (!this.isRecording) {
            console.log('No hay grabación activa');
            return;
        }

        try {
            if (this.microphone) {
                this.microphone.stopRecording();
            }
            
            if (this.currentFileStream) {
                this.currentFileStream.end();
            }

            if (this.currentWavWriter) {
                this.currentWavWriter.end();
            }

            if (this.statsInterval) {
                clearInterval(this.statsInterval);
            }

            this.isRecording = false;
            this.currentStream = null;
            this.currentFileStream = null;
            this.currentWavWriter = null;
            this.microphone = null;
            
            console.log('Grabación detenida');
            this.logFinalStats();

        } catch (error) {
            console.error('Error al detener la grabación:', error);
        }
    }

    startNewFile() {
        if (this.currentFileStream) {
            this.currentFileStream.end();
        }

        if (this.currentWavWriter) {
            this.currentWavWriter.end();
        }

        this.recordingCounter++;
        
        // Crear archivo WAV
        const wavFile = path.join(
            this.sessionDir,
            `${this.options.filePrefix}_${this.recordingCounter}.wav`
        );
        
        this.currentWavWriter = new wav.FileWriter(wavFile, {
            channels: this.options.channels,
            sampleRate: this.options.frequency,
            bitDepth: this.options.bitwidth
        });

        this.recordingStartTime = Date.now();
        
        console.log(`Nuevo archivo iniciado: ${wavFile}`);
    }

    handleAudioData(data) {
        if (!this.isRecording || !this.currentWavWriter) return;

        this.currentWavWriter.write(data);
        this.totalBytesRecorded += data.length;

        // Verificar si debemos iniciar un nuevo archivo
        const elapsedTime = (Date.now() - this.recordingStartTime) / 1000;
        if (elapsedTime >= this.options.maxDuration) {
            console.log(`Alcanzada duración máxima de ${this.options.maxDuration} segundos`);
            this.startNewFile();
        }
    }

    startStatsInterval() {
        this.statsInterval = setInterval(() => {
            const elapsedTime = (Date.now() - this.recordingStartTime) / 1000;
            const bytesPerSecond = this.totalBytesRecorded / elapsedTime;
            
            console.log(`
                Estadísticas de grabación:
                - Tiempo transcurrido: ${elapsedTime.toFixed(2)} segundos
                - Bytes grabados: ${this.totalBytesRecorded}
                - Velocidad: ${(bytesPerSecond / 1024).toFixed(2)} KB/s
                - Archivo actual: ${this.currentWavWriter ? path.basename(this.currentWavWriter.path) : 'ninguno'}
            `);
        }, 5000); // Mostrar estadísticas cada 5 segundos
    }

    logFinalStats() {
        const totalTime = (Date.now() - this.recordingStartTime) / 1000;
        console.log(`
            Estadísticas finales:
            - Duración total: ${totalTime.toFixed(2)} segundos
            - Archivos generados: ${this.recordingCounter}
            - Bytes totales: ${this.totalBytesRecorded}
            - Directorio de sesión: ${this.sessionDir}
        `);
    }
}

module.exports = AudioRecorder; 