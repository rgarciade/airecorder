const AudioRecorder = require('./test-recorder');

// Crear una instancia del grabador con opciones personalizadas
const recorder = new AudioRecorder({
    frequency: 44100,      // Frecuencia de muestreo
    channels: 1,           // Mono
    bitwidth: 16,          // 16 bits por muestra
    device: 'default',     // Dispositivo de entrada por defecto
    filePrefix: 'test',    // Prefijo para los archivos
    maxDuration: 300       // 5 minutos por archivo
});

console.log('Iniciando prueba de grabación...');
console.log('La grabación se dividirá en archivos de 5 minutos');
console.log('Presiona Ctrl+C para detener la grabación');

// Manejar la señal de interrupción (Ctrl+C)
process.on('SIGINT', () => {
    console.log('\nSeñal de interrupción recibida');
    recorder.stop();
    process.exit(0);
});

// Iniciar la grabación
recorder.start(); 