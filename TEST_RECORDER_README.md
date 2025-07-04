# Test Recorder - Funcionalidad de Grabación de Audio

## Descripción
La funcionalidad **Test Recorder** permite grabar simultáneamente el audio del micrófono y el audio del sistema operativo durante un período de 4 segundos, generando archivos separados y un archivo mezclado.

## Características

### 🎤 Grabación Simultánea
- **Micrófono**: Graba el audio de entrada del micrófono seleccionado
- **Sistema**: Graba el audio del sistema operativo (monitor de audio)
- **Mezclado**: Combina ambos audios en un solo archivo

### ⏱️ Duración Fija
- Grabación automática de **4 segundos**
- No requiere intervención manual para detener

### 🎛️ Selección de Dispositivos
- Lista automática de dispositivos de audio disponibles
- Selección manual del micrófono a utilizar
- Detección automática del monitor de audio del sistema

## Cómo Usar

### 1. Acceso a la Funcionalidad
1. Abrir la aplicación VoiceNote
2. En la página principal, hacer clic en el botón **"Test Recorder"**
3. Se abrirá la interfaz de Test Recorder

### 2. Configuración
1. **Seleccionar Micrófono**: Elegir el dispositivo de audio desde el menú desplegable
2. **Verificar Dispositivos**: La aplicación mostrará los dispositivos disponibles automáticamente

### 3. Grabación
1. Hacer clic en **"Iniciar Test Record (4s)"**
2. La grabación comenzará automáticamente
3. Esperar 4 segundos hasta que termine
4. Los archivos se generarán automáticamente

### 4. Resultados
Al completar la grabación, se generan 3 archivos:
- `test-mic-[timestamp].wav` - Solo micrófono
- `test-system-[timestamp].wav` - Solo audio del sistema
- `test-mixed-[timestamp].wav` - Audio combinado

## Requisitos del Sistema

### Linux (Ubuntu/Debian)
```bash
# Instalar dependencias de audio
sudo apt-get update
sudo apt-get install pulseaudio-utils ffmpeg

# Verificar que PulseAudio esté ejecutándose
pulseaudio --check
```

### Permisos de Audio
La aplicación requiere permisos para:
- Acceder al micrófono
- Acceder al monitor de audio del sistema
- Escribir archivos en el directorio temporal

## Archivos Generados

### Ubicación
Los archivos se guardan en:
- **Linux**: `/tmp/voicenote-test-recordings/`

### Formato
- **Formato**: WAV (PCM 16-bit)
- **Frecuencia**: 44.1 kHz
- **Canales**: Mono (1 canal)

### Nomenclatura
```
test-mic-[YYYY-MM-DDTHH-MM-SS-sssZ].wav
test-system-[YYYY-MM-DDTHH-MM-SS-sssZ].wav
test-mixed-[YYYY-MM-DDTHH-MM-SS-sssZ].wav
```

## Solución de Problemas

### Error: "No se pueden detectar dispositivos de audio"
```bash
# Verificar dispositivos disponibles
pactl list short sources

# Reiniciar PulseAudio si es necesario
pulseaudio -k
pulseaudio --start
```

### Error: "Error durante la grabación"
1. Verificar que el micrófono esté conectado
2. Comprobar permisos de acceso al micrófono
3. Asegurar que PulseAudio esté ejecutándose

### Error: "Timeout en la grabación"
1. Verificar que FFmpeg esté instalado
2. Comprobar que el dispositivo seleccionado sea válido
3. Reiniciar la aplicación si persiste

## Tecnologías Utilizadas

- **Frontend**: React + Redux
- **Backend**: Electron (Node.js)
- **Audio**: FFmpeg con PulseAudio
- **IPC**: Electron IPC para comunicación entre procesos

## Estructura de Archivos

```
src/
├── components/
│   └── TestRecorder/
│       └── TestRecorder.jsx
├── pages/
│   └── TestRecorder/
│       └── TestRecorder.jsx
electron/
├── audioRecorder.js
├── main.js
└── preload.js
```

## API Interna

### IPC Handlers
- `get-audio-devices`: Obtiene lista de dispositivos de audio
- `start-test-recording`: Inicia grabación de prueba
- `stop-recording`: Detiene grabación manualmente
- `get-recording-files`: Lista archivos de grabación generados

### Funciones Expuestas
```javascript
window.electronAPI.getAudioDevices()
window.electronAPI.startTestRecording(microphoneId, duration)
window.electronAPI.stopRecording()
window.electronAPI.getRecordingFiles()
```

## Próximas Mejoras

- [ ] Soporte para Windows y macOS
- [ ] Configuración de duración personalizada
- [ ] Reproducción de archivos generados
- [ ] Exportación a diferentes formatos
- [ ] Análisis de calidad de audio