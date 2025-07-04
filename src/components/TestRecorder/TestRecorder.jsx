import React, { useState, useEffect } from 'react';

export default function TestRecorder() {
  const [audioDevices, setAudioDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingResult, setRecordingResult] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadAudioDevices();
  }, []);

  const loadAudioDevices = async () => {
    try {
      const result = await window.electronAPI.getAudioDevices();
      if (result.success) {
        setAudioDevices(result.devices);
        // Seleccionar el primer dispositivo por defecto
        if (result.devices.length > 0) {
          setSelectedDevice(result.devices[0].id);
        }
      } else {
        setError(result.error || 'Error cargando dispositivos de audio');
      }
    } catch (err) {
      setError('Error al conectar con el sistema de audio');
      console.error('Error loading audio devices:', err);
    }
  };

  const startTestRecording = async () => {
    if (!selectedDevice) {
      setError('Por favor selecciona un dispositivo de audio');
      return;
    }

    setIsRecording(true);
    setError(null);
    setRecordingResult(null);
    setIsLoading(true);

    try {
      const result = await window.electronAPI.startTestRecording(selectedDevice, 4);
      if (result.success) {
        setRecordingResult(result.result);
        setError(null);
      } else {
        setError(result.error || 'Error durante la grabación');
      }
    } catch (err) {
      setError('Error al iniciar la grabación');
      console.error('Error starting test recording:', err);
    } finally {
      setIsRecording(false);
      setIsLoading(false);
    }
  };

  const stopRecording = async () => {
    try {
      await window.electronAPI.stopRecording();
      setIsRecording(false);
      setIsLoading(false);
    } catch (err) {
      console.error('Error stopping recording:', err);
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="bg-[#472426] rounded-xl p-6 max-w-2xl mx-auto">
      <h2 className="text-white text-2xl font-bold mb-6 text-center">Test Recorder</h2>
      
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
            <option key={device.id} value={device.id}>
              {device.name} ({device.type})
            </option>
          ))}
        </select>
      </div>

      {/* Botón de grabación */}
      <div className="text-center mb-6">
        <button
          onClick={isRecording ? stopRecording : startTestRecording}
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
              Grabando... (4s)
            </div>
          ) : isRecording ? (
            'Detener Grabación'
          ) : (
            'Iniciar Test Record (4s)'
          )}
        </button>
      </div>

      {/* Información de grabación */}
      {isRecording && (
        <div className="text-center mb-4">
          <div className="flex items-center justify-center gap-2 text-white">
            <div className="w-3 h-3 bg-red-500 rounded-full animate-ping"></div>
            <span>Grabando micrófono y audio del sistema...</span>
          </div>
        </div>
      )}

      {/* Resultado de la grabación */}
      {recordingResult && (
        <div className="bg-[#221112] rounded-lg p-4 mb-4">
          <h3 className="text-white font-bold mb-3">Grabación Completada:</h3>
          <div className="space-y-2 text-sm">
            <div className="text-green-400">
              ✓ Duración: {recordingResult.duration} segundos
            </div>
            <div className="text-white">
              📁 Archivos generados:
            </div>
            <ul className="text-[#c89295] ml-4 space-y-1">
              <li>• Micrófono: {recordingResult.microphoneFile.split('/').pop()}</li>
              <li>• Audio del sistema: {recordingResult.systemFile.split('/').pop()}</li>
              <li>• Audio mezclado: {recordingResult.mixedFile.split('/').pop()}</li>
            </ul>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-900 border border-red-700 rounded-lg p-4 mb-4">
          <h3 className="text-red-200 font-bold mb-2">Error:</h3>
          <p className="text-red-300 text-sm">{error}</p>
        </div>
      )}

      {/* Información */}
      <div className="bg-[#221112] rounded-lg p-4 text-sm text-[#c89295]">
        <h4 className="text-white font-medium mb-2">Información:</h4>
        <ul className="space-y-1">
          <li>• La grabación durará exactamente 4 segundos</li>
          <li>• Se grabará tanto el micrófono como el audio del sistema</li>
          <li>• Se generarán 3 archivos: micrófono, sistema y mezclado</li>
          <li>• Los archivos se guardan en formato WAV</li>
        </ul>
      </div>
    </div>
  );
}