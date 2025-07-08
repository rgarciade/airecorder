import React, { useState, useEffect } from 'react';
import { getSystemMicrophones, AudioRecorder, recordSystemAudio } from '../../services/audioService';

export default function TestRecorder() {
  const [audioDevices, setAudioDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingResult, setRecordingResult] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [recorder, setRecorder] = useState(null);
  const [recordingDuration, setRecordingDuration] = useState(4);
  const [showScreenPrompt, setShowScreenPrompt] = useState(false);
  const [isRecordingSystem, setIsRecordingSystem] = useState(false);

  useEffect(() => {
    loadAudioDevices();
  }, []);

  const loadAudioDevices = async () => {
    try {
      const devices = await getSystemMicrophones();
      setAudioDevices(devices);
      // Seleccionar el primer dispositivo por defecto
      if (devices.length > 0) {
        setSelectedDevice(devices[0].value);
      }
    } catch (err) {
      setError('Error al cargar dispositivos de audio');
      console.error('Error loading audio devices:', err);
    }
  };

  // Nuevo flujo: mostrar aviso antes de grabar
  const handleStartRecordingClick = () => {
    if (!selectedDevice) {
      setError('Por favor selecciona un dispositivo de audio');
      return;
    }
    setShowScreenPrompt(true);
  };

  // Nueva función para probar grabación del audio del sistema
  const handleTestSystemAudio = async () => {
    setIsRecordingSystem(true);
    setError(null);
    
    try {
      console.log('Iniciando grabación del audio del sistema...');
      const result = await recordSystemAudio(4); // 4 segundos
      console.log('Grabación del sistema completada:', result);
      setError('✅ Grabación del sistema completada y guardada en Desktop/recorder');
    } catch (err) {
      console.error('Error al grabar audio del sistema:', err);
      setError('Error al grabar audio del sistema: ' + err.message);
    } finally {
      setIsRecordingSystem(false);
    }
  };

  // Cuando el usuario confirma el aviso, inicia la grabación real
  const startTestRecording = async () => {
    setShowScreenPrompt(false);
    setIsRecording(true);
    setError(null);
    setRecordingResult(null);
    setIsLoading(true);

    try {
      const audioRecorder = new AudioRecorder();
      setRecorder(audioRecorder);

      // Configurar callback para cuando termine la grabación
      audioRecorder.onStop((recordingData) => {
        setRecordingResult(recordingData);
        setIsRecording(false);
        setIsLoading(false);
        setRecorder(null);
      });

      // Iniciar grabación
      await audioRecorder.start(selectedDevice, recordingDuration);
      
    } catch (err) {
      // Si el error es por falta de audio del sistema, mostrar advertencia específica
      if (err.message && err.message.includes('No se pudo capturar el audio del sistema')) {
        setError(
          'No se pudo capturar el audio del sistema. Si usas macOS, necesitas instalar un driver virtual como BlackHole, Loopback o similar y seleccionarlo como fuente de entrada. Si usas Windows, asegúrate de seleccionar una ventana/pantalla con audio.'
        );
      } else {
        setError('Error al iniciar la grabación: ' + err.message);
      }
      setIsRecording(false);
      setIsLoading(false);
    }
  };

  const stopRecording = () => {
    if (recorder) {
      recorder.stop();
      setIsRecording(false);
      setIsLoading(false);
      setRecorder(null);
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const playRecording = () => {
    if (recordingResult && recordingResult.url) {
      const audio = new Audio(recordingResult.url);
      audio.play().catch(err => {
        console.error('Error playing audio:', err);
        setError('Error al reproducir el audio');
      });
    }
  };

  const downloadRecording = () => {
    if (recordingResult && recordingResult.url) {
      const a = document.createElement('a');
      a.href = recordingResult.url;
      a.download = `grabacion_${recordingResult.timestamp.replace(/[:.]/g, '-')}.webm`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  return (
    <div className="bg-[#472426] rounded-xl p-6 max-w-2xl mx-auto">
      <h2 className="text-white text-2xl font-bold mb-6 text-center">Test Recorder</h2>
      
      {/* Nuevo botón para probar audio del sistema */}
      <div className="mb-6 text-center">
        <button
          onClick={handleTestSystemAudio}
          disabled={isRecordingSystem || isRecording}
          className={`px-6 py-3 rounded-lg font-bold text-white transition-all duration-300 ${
            isRecordingSystem
              ? 'bg-orange-600 animate-pulse'
              : 'bg-orange-500 hover:bg-orange-600 disabled:bg-gray-600 disabled:cursor-not-allowed'
          }`}
        >
          {isRecordingSystem ? (
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              Grabando Audio del Sistema... (4s)
            </div>
          ) : (
            '🔊 Probar Grabación Audio del Sistema'
          )}
        </button>
        <p className="text-[#c89295] text-sm mt-2">
          Graba 4 segundos del audio del sistema y lo guarda en Desktop/recorder
        </p>
      </div>

      {/* Modal de aviso para selección de pantalla/ventana */}
      {showScreenPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60">
          <div className="bg-[#221112] rounded-xl p-8 max-w-md w-full text-center border border-[#663336] shadow-lg">
            <h3 className="text-white text-xl font-bold mb-4">Selecciona la pantalla o ventana a grabar</h3>
            <p className="text-[#c89295] mb-6">
              Para capturar el audio del sistema, debes seleccionar la pantalla o ventana que deseas grabar en el siguiente diálogo.<br/>
              Si cancelas, la grabación no se iniciará.
            </p>
            <div className="flex gap-4 justify-center">
              <button
                className="px-6 py-2 bg-[#e92932] hover:bg-[#d41f27] text-white rounded-lg font-bold"
                onClick={startTestRecording}
              >
                Continuar
              </button>
              <button
                className="px-6 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-bold"
                onClick={() => setShowScreenPrompt(false)}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Selector de dispositivos */}
      <div className="mb-6">
        <label className="block text-white text-sm font-medium mb-2">
          Seleccionar Micrófono:
        </label>
        <select
          value={selectedDevice}
          onChange={(e) => setSelectedDevice(e.target.value)}
          className="w-full p-3 bg-[#221112] text-white rounded-lg border border-[#663336] focus:border-[#e92932] focus:outline-none"
          disabled={isRecording}
        >
          <option value="">Seleccionar dispositivo...</option>
          {audioDevices.map((device) => (
            <option key={device.value} value={device.value}>
              {device.label}
            </option>
          ))}
        </select>
      </div>

      {/* Selector de duración */}
      <div className="mb-6">
        <label className="block text-white text-sm font-medium mb-2">
          Duración de grabación:
        </label>
        <select
          value={recordingDuration}
          onChange={(e) => setRecordingDuration(parseInt(e.target.value))}
          className="w-full p-3 bg-[#221112] text-white rounded-lg border border-[#663336] focus:border-[#e92932] focus:outline-none"
          disabled={isRecording}
        >
          <option value={2}>2 segundos</option>
          <option value={4}>4 segundos</option>
          <option value={6}>6 segundos</option>
          <option value={10}>10 segundos</option>
          <option value={15}>15 segundos</option>
        </select>
      </div>

      {/* Botón de grabación */}
      <div className="text-center mb-6">
        <button
          onClick={isRecording ? stopRecording : handleStartRecordingClick}
          disabled={!selectedDevice || isLoading}
          className={`px-8 py-4 rounded-full font-bold text-white transition-all duration-300 ${
            isRecording
              ? 'bg-red-600 hover:bg-red-700 animate-pulse'
              : 'bg-[#e92932] hover:bg-[#d41f27] disabled:bg-gray-600 disabled:cursor-not-allowed'
          }`}
        >
          {isLoading ? (
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              Grabando... ({recordingDuration}s)
            </div>
          ) : isRecording ? (
            'Detener Grabación'
          ) : (
            `Iniciar Test Record (${recordingDuration}s)`
          )}
        </button>
      </div>

      {/* Información de grabación */}
      {isRecording && (
        <div className="text-center mb-4">
          <div className="flex items-center justify-center gap-2 text-white mb-2">
            <div className="w-3 h-3 bg-red-500 rounded-full animate-ping"></div>
            <span>Grabando solo micrófono...</span>
          </div>
          <div className="text-sm text-[#c89295]">
            🎤 Micrófono activo
          </div>
        </div>
      )}

      {/* Resultado de la grabación */}
      {recordingResult && (
        <div className="bg-[#221112] rounded-lg p-4 mb-4">
          <h3 className="text-white font-bold mb-3">Grabación Completada:</h3>
          <div className="space-y-2 text-sm">
            <div className="text-green-400">
              ✓ Duración: {recordingResult.duration.toFixed(2)} segundos
            </div>
            <div className="text-green-400">
              ✓ Tamaño: {formatFileSize(recordingResult.size)}
            </div>
            <div className="text-green-400">
              ✓ Tipo: Solo micrófono
            </div>
            <div className="text-white">
              📁 Archivo generado: {recordingResult.timestamp}
            </div>
            {/* Botones de acción */}
            <div className="flex gap-2 mt-4">
              <button
                onClick={playRecording}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
              >
                ▶️ Reproducir
              </button>
              <button
                onClick={downloadRecording}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                💾 Descargar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className={`rounded-lg p-4 mb-4 text-center ${
          error.includes('✅') ? 'bg-green-900 text-green-200' : 'bg-red-900 text-red-200'
        }`}>
          {error}
        </div>
      )}
    </div>
  );
}