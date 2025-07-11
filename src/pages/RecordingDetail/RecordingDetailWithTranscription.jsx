import React, { useState, useEffect } from 'react';
import recordingsService from '../../services/recordingsService';
import TranscriptionViewer from '../../components/TranscriptionViewer/TranscriptionViewer';
import { sendToGemini } from '../../services/geminiService';

// Puedes reemplazar estos mocks si tienes datos reales en la grabación
const mockTopics = [
  { name: 'Introduction', timestamp: '0:00', timestampSeconds: 0 },
  { name: 'Marketing Strategy', timestamp: '5:20', timestampSeconds: 320 },
  { name: 'Budget Discussion', timestamp: '12:45', timestampSeconds: 765 },
  { name: 'Launch Date', timestamp: '20:10', timestampSeconds: 1210 },
  { name: 'Action Items', timestamp: '28:30', timestampSeconds: 1710 },
];

export default function RecordingDetailWithTranscription({ recording, onBack }) {
  const [question, setQuestion] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTimestamp, setCurrentTimestamp] = useState(null);
  const [participants, setParticipants] = useState(recording?.participants || []);
  const [newParticipantName, setNewParticipantName] = useState('');
  const [showParticipantForm, setShowParticipantForm] = useState(false);

  // Transcripción
  const [transcription, setTranscription] = useState(null);
  const [transcriptionLoading, setTranscriptionLoading] = useState(false);
  const [transcriptionError, setTranscriptionError] = useState(null);

  // Estado para la respuesta de Gemini
  const [geminiData, setGeminiData] = useState({ resumen_breve: '', resumen_extenso: '', ideas: [] });
  const [geminiLoading, setGeminiLoading] = useState(false);
  const [geminiError, setGeminiError] = useState(null);
  const [geminiResult, setGeminiResult] = useState(null);
  const [geminiChecked, setGeminiChecked] = useState(false); // Para evitar doble llamada

  // Estado para el histórico de preguntas
  const [qaHistory, setQaHistory] = useState([]);
  const [questionInput, setQuestionInput] = useState('');
  const [questionLoading, setQuestionLoading] = useState(false);
  const [questionError, setQuestionError] = useState(null);
  const [questionAnswer, setQuestionAnswer] = useState(null);

  useEffect(() => {
    if (!recording) return;
    setTranscription(null);
    setTranscriptionLoading(true);
    setTranscriptionError(null);
    recordingsService.getTranscription(recording.id)
      .then((data) => {
        setTranscription(data);
      })
      .catch((err) => {
        setTranscriptionError('Error al cargar la transcripción');
      })
      .finally(() => setTranscriptionLoading(false));
  }, [recording]);

  // Lógica automática para obtener resumen Gemini
  useEffect(() => {
    const fetchGemini = async () => {
      if (!recording?.id || !transcription || geminiChecked) return;
      setGeminiChecked(true);
      setGeminiLoading(true);
      setGeminiError(null);
      setGeminiResult(null);
      // 1. Intentar cargar resumen guardado
      const existing = await recordingsService.getGeminiSummary(recording.id);
      if (existing && existing.resumen_breve && existing.resumen_extenso && Array.isArray(existing.ideas)) {
        setGeminiData(existing);
        setGeminiLoading(false);
        return;
      }
      // 2. Si no existe, llamar a Gemini
      try {
        const txt = await recordingsService.getTranscriptionTxt(recording.id);
        if (!txt) {
          setGeminiError('No se pudo obtener el texto de la transcripción.');
          setGeminiLoading(false);
          return;
        }
        const data = await sendToGemini(txt);
        let text = data?.candidates?.[0]?.content?.parts?.[0]?.text || 'Sin respuesta de Gemini';
        // Limpiar bloque de código Markdown antes de parsear
        let cleanText = text.replace(/^\s*```(?:json)?\s*([\s\S]*?)\s*```\s*$/i, '$1').trim();
        let parsed = null;
        try {
          parsed = JSON.parse(cleanText);
        } catch (e) {}
        if (parsed && parsed.resumen_breve && parsed.resumen_extenso && Array.isArray(parsed.ideas)) {
          setGeminiData(parsed);
          await recordingsService.saveGeminiSummary(recording.id, parsed);
        } else {
          setGeminiResult(text);
          setGeminiData({ resumen_breve: '', resumen_extenso: '', ideas: [] });
        }
      } catch (error) {
        setGeminiError('Error al obtener respuesta de Gemini');
      } finally {
        setGeminiLoading(false);
      }
    };
    fetchGemini();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recording, transcription]);

  // Cargar histórico al montar
  useEffect(() => {
    if (!recording?.id) return;
    recordingsService.getQuestionHistory(recording.id).then(setQaHistory);
  }, [recording]);

  // Participantes
  useEffect(() => {
    if (!recording?.id) return;
    recordingsService.getParticipants(recording.id).then((saved) => {
      if (saved && saved.length > 0) setParticipants(saved);
    });
  }, [recording]);

  // Handler para enviar pregunta
  const handleAskQuestion = async (e) => {
    e.preventDefault();
    setQuestionLoading(true);
    setQuestionError(null);
    setQuestionAnswer(null);
    try {
      const txt = await recordingsService.getTranscriptionTxt(recording.id);
      if (!txt) {
        setQuestionError('No se pudo obtener el texto de la transcripción.');
        setQuestionLoading(false);
        return;
      }
      // Prompt personalizado
      const prompt = `${questionInput}\n\nResponde de forma concisa.`;
      const body = {
        contents: [
          { parts: [
              { text: `${prompt}\n\nTranscripción:\n${txt}` }
            ]
          }
        ]
      };
      // Obtener la clave de settings
      const settings = await import('../../services/settingsService');
      const { getSettings } = settings;
      const s = await getSettings();
      const GEMINI_API_KEY = s.geminiApiKey;
      if (!GEMINI_API_KEY) throw new Error('No se ha configurado la Gemini API Key en los ajustes.');
      const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
      const response = await fetch(GEMINI_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-goog-api-key': GEMINI_API_KEY,
        },
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error('Error en la API de Gemini: ' + response.status);
      const data = await response.json();
      let text = data?.candidates?.[0]?.content?.parts?.[0]?.text || 'Sin respuesta de Gemini';
      // Limpiar bloque de código Markdown si lo hay
      let cleanText = text.replace(/^```[a-z]*\n?/i, '').replace(/```$/i, '').trim();
      setQuestionAnswer(cleanText);
      // Guardar en histórico
      const qa = { pregunta: questionInput, respuesta: cleanText, fecha: new Date().toISOString() };
      await recordingsService.saveQuestionHistory(recording.id, qa);
      setQaHistory(prev => [...prev, qa]);
      setQuestionInput('');
    } catch (error) {
      setQuestionError(error.message || 'Error al obtener respuesta de Gemini');
    } finally {
      setQuestionLoading(false);
    }
  };

  const handlePlayFromTimestamp = (timestampSeconds) => {
    setIsPlaying(true);
    setCurrentTimestamp(timestampSeconds);
    // Aquí irá la lógica real de reproducción
    console.log(`Playing from ${timestampSeconds} seconds`);
  };

  const handleAddParticipant = async () => {
    if (newParticipantName.trim()) {
      const newParticipant = {
        id: Date.now(),
        name: newParticipantName.trim(),
        role: 'Participante'
      };
      const updated = [...participants, newParticipant];
      setParticipants(updated);
      setNewParticipantName('');
      setShowParticipantForm(false);
      await recordingsService.saveParticipants(recording.id, updated);
    }
  };

  const handleRemoveParticipant = async (participantId) => {
    const updated = participants.filter(p => p.id !== participantId);
    setParticipants(updated);
    await recordingsService.saveParticipants(recording.id, updated);
  };

  // Handler para el botón de Gemini
  const handleGeminiClick = async () => {
    setGeminiLoading(true);
    setGeminiError(null);
    setGeminiResult(null);
    try {
      const txt = await recordingsService.getTranscriptionTxt(recording.id);
      if (!txt) {
        setGeminiError('No se pudo obtener el texto de la transcripción.');
        setGeminiLoading(false);
        return;
      }
      const data = await sendToGemini(txt);
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || 'Sin respuesta de Gemini';
      let parsed = null;
      try {
        parsed = JSON.parse(text);
      } catch (e) {
        // Si no es JSON válido, mostrar el texto original
      }
      if (parsed && parsed.resumen_breve && parsed.resumen_extenso && Array.isArray(parsed.ideas)) {
        setGeminiData(parsed);
        setGeminiResult(null);
      } else {
        setGeminiResult(text);
        setGeminiData({ resumen_breve: '', resumen_extenso: '', ideas: [] });
      }
    } catch (error) {
      setGeminiError('Error al obtener respuesta de Gemini');
    } finally {
      setGeminiLoading(false);
    }
  };

  return (
    <div
      className="flex min-h-screen flex-col bg-[#221112]"
      style={{ fontFamily: '"Plus Jakarta Sans", "Noto Sans", sans-serif' }}
    >
      <header className="flex items-center justify-between whitespace-nowrap border-b border-solid border-b-[#472426] px-10 py-3">
        <div className="flex items-center gap-4 text-white">
          <div className="size-4">
            <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M42.4379 44C42.4379 44 36.0744 33.9038 41.1692 24C46.8624 12.9336 42.2078 4 42.2078 4L7.01134 4C7.01134 4 11.6577 12.932 5.96912 23.9969C0.876273 33.9029 7.27094 44 7.27094 44L42.4379 44Z"
                fill="currentColor"
              ></path>
            </svg>
          </div>
          <h2 className="text-white text-lg font-bold leading-tight tracking-[-0.015em]">Meeting Recorder</h2>
        </div>
        <div className="flex items-center gap-8">
          <button
            onClick={onBack}
            className="flex cursor-pointer items-center justify-center overflow-hidden rounded-full h-10 bg-[#472426] text-white gap-2 text-sm font-bold leading-normal tracking-[0.015em] px-2.5"
          >
            <div className="text-white">
              <svg xmlns="http://www.w3.org/2000/svg" width="20px" height="20px" fill="currentColor" viewBox="0 0 256 256">
                <path d="M224,128a8,8,0,0,1-8,8H40a8,8,0,0,1,0-16H216A8,8,0,0,1,224,128ZM40,72H216a8,8,0,0,0,0-16H40a8,8,0,0,0,0,16ZM216,184H40a8,8,0,0,0,0,16H216a8,8,0,0,0,0-16Z"></path>
              </svg>
            </div>
          </button>
          <div
            className="bg-center bg-no-repeat aspect-square bg-cover rounded-full size-10"
            style={{
              backgroundImage:
                'url("https://lh3.googleusercontent.com/aida-public/AB6AXuAogyadNUeGL36ivwWfecIbkXtQgBfVQeOlMBPDuo96aaTlM9NBlwpxPPZO8BPgTUK4kU85TvtZesaONhHFtVUv55Put8hqzQgkVFr2GKxPe0Z5_QkH8TSa1aRiTPzYV3PzZ16GuRU0TN3_rt4NooSThdUdWpvMYvFrRgtxoXnIQbQCxqXmVggpEtpXRPCeL0hrP1O8v3JD0eeSEOefzzO8SPQxS_EQ9f_7ecMTpM9T6eL0B5KM9R0OqyJNcKlaK6C8V4qnp3E")',
            }}
          ></div>
        </div>
      </header>
      <div className="gap-1 px-6 flex flex-1 justify-center py-5">
        {/* Columna izquierda: participantes, temas, etc. */}
        <div className="layout-content-container flex flex-col w-[30rem]">
          <h2 className="text-white text-[22px] font-bold leading-tight tracking-[-0.015em] px-4 pb-3 pt-5">Meeting Summary</h2>
          <p className="text-white text-base font-normal leading-normal pb-3 pt-1 px-4">
            {geminiData.resumen_breve || recording?.summary || 'Esta reunión discutió el lanzamiento del producto, centrándose en estrategias de marketing y cronograma.'}
          </p>
          <h2 className="text-white text-[22px] font-bold leading-tight tracking-[-0.015em] px-4 pb-3 pt-5">Key Topics</h2>
          {(geminiData.ideas.length > 0 ? geminiData.ideas : (recording?.topics || mockTopics.map(t => t.name))).map((idea, index) => (
            <div key={index} className="flex items-center gap-4 bg-[#221112] px-4 min-h-14 justify-between group hover:bg-[#331a1b] transition-colors">
              <p className="text-white text-base font-normal leading-normal flex-1 break-words whitespace-pre-line">{idea}</p>
            </div>
          ))}
          <h2 className="text-white text-[22px] font-bold leading-tight tracking-[-0.015em] px-4 pb-3 pt-5">Participantes</h2>
          <div className="px-4 pb-4">
            {participants.map((participant) => (
              <div key={participant.id} className="flex items-center justify-between bg-[#221112] px-4 py-3 mb-2 rounded-lg hover:bg-[#331a1b] transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-[#e92932] rounded-full flex items-center justify-center">
                    <span className="text-white text-sm font-bold">
                      {participant.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <p className="text-white text-sm font-medium">{participant.name}</p>
                    <p className="text-[#c89295] text-xs">{participant.role}</p>
                  </div>
                </div>
                <button
                  onClick={() => handleRemoveParticipant(participant.id)}
                  className="text-[#c89295] hover:text-[#e92932] transition-colors p-1"
                  title="Eliminar participante"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 256 256">
                    <path d="M205.66,194.34a8,8,0,0,1-11.32,11.32L128,139.31,61.66,205.66a8,8,0,0,1-11.32-11.32L116.69,128,50.34,61.66A8,8,0,0,1,61.66,50.34L128,116.69l66.34-66.35a8,8,0,0,1,11.32,11.32L139.31,128Z"></path>
                  </svg>
                </button>
              </div>
            ))}
            {showParticipantForm ? (
              <div className="flex items-center gap-2 mt-3">
                <input
                  type="text"
                  value={newParticipantName}
                  onChange={(e) => setNewParticipantName(e.target.value)}
                  placeholder="Nombre del participante"
                  className="flex-1 px-3 py-2 text-white bg-[#331a1b] border border-[#472426] rounded-lg focus:outline-none focus:border-[#663336]"
                  onKeyPress={(e) => e.key === 'Enter' && handleAddParticipant()}
                />
                <button
                  onClick={handleAddParticipant}
                  className="px-3 py-2 bg-[#e92932] text-white rounded-lg hover:bg-[#d41f27] transition-colors"
                >
                  ✓
                </button>
                <button
                  onClick={() => {
                    setShowParticipantForm(false);
                    setNewParticipantName('');
                  }}
                  className="px-3 py-2 bg-[#472426] text-white rounded-lg hover:bg-[#663336] transition-colors"
                >
                  ✕
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowParticipantForm(true)}
                className="flex items-center gap-2 w-full px-4 py-3 mt-2 bg-[#331a1b] text-[#c89295] rounded-lg hover:bg-[#472426] hover:text-white transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 256 256">
                  <path d="M224,128a8,8,0,0,1-8,8H136v80a8,8,0,0,1-16,0V136H40a8,8,0,0,1,0-16h80V40a8,8,0,0,1,16,0v80h80A8,8,0,0,1,224,128Z"></path>
                </svg>
                <span className="text-sm">Agregar participante</span>
              </button>
            )}
          </div>
        </div>
        {/* Columna central: título, input, mensajes y transcripción */}
        <div className="layout-content-container flex flex-col flex-1">
          {/* Resumen extenso destacado */}
          {geminiData.resumen_extenso && (
            <div className="bg-[#331a1b] text-white rounded-lg p-6 mb-6 whitespace-pre-line text-lg font-normal">
              <span className="font-bold block mb-2">Resumen detallado de la reunión:</span>
              {geminiData.resumen_extenso}
            </div>
          )}
          <div className="flex flex-wrap justify-between gap-3 p-4">
            <p className="text-white tracking-light text-[32px] font-bold leading-tight min-w-72">{recording?.title || 'Product Launch Meeting'}</p>
          </div>
          {/* Input de pregunta y respuesta */}
          <form className="flex max-w-[480px] flex-wrap items-end gap-4 px-4 py-3" onSubmit={handleAskQuestion}>
            <label className="flex flex-col min-w-40 flex-1">
              <input
                placeholder="Haz una pregunta sobre la reunión"
                className="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-xl text-white focus:outline-0 focus:ring-0 border border-[#663336] bg-[#331a1b] focus:border-[#663336] h-14 placeholder:text-[#c89295] p-[15px] text-base font-normal leading-normal"
                value={questionInput}
                onChange={e => setQuestionInput(e.target.value)}
                disabled={questionLoading}
              />
            </label>
            <button
              type="submit"
              className="px-4 py-2 bg-[#e92932] text-white rounded-lg hover:bg-[#d41f27] transition-colors font-bold"
              disabled={questionLoading || !questionInput.trim()}
            >
              {questionLoading ? 'Consultando...' : 'Preguntar'}
            </button>
          </form>
          {questionError && <div className="text-red-400 px-4">{questionError}</div>}
          {/* Eliminar visualización de respuesta individual */}
          {/* Histórico de preguntas y respuestas, sin título */}
          {qaHistory.length > 0 && (
            <div className="bg-[#221112] text-white rounded-lg p-4 mt-6 mx-4 max-h-[350px] overflow-y-auto">
              <ul className="space-y-2">
                {[...qaHistory].reverse().map((qa, idx) => (
                  <li key={idx} className="border-b border-[#472426] pb-2 mb-2 last:border-b-0 last:mb-0 last:pb-0">
                    <div className="text-[#e92932] font-semibold">{qa.pregunta}</div>
                    <div className="text-white whitespace-pre-line">{qa.respuesta}</div>
                    <div className="text-xs text-[#c89295] mt-1">{new Date(qa.fecha).toLocaleString('es-ES')}</div>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {/* Transcripción debajo del input */}
          <div className="w-full flex-1 px-4 pb-4">
            {/* Indicador de generación de resumen */}
            <div className="mb-4">
              {geminiLoading && (
                <div className="text-[#e92932] font-bold py-2">Generando resumen...</div>
              )}
              {geminiError && (
                <div className="text-red-400 mt-2">{geminiError}</div>
              )}

              {(!geminiData.resumen_extenso && geminiResult) && (
                typeof geminiResult === 'string' ? (
                  <div className="bg-[#331a1b] text-white rounded-lg p-4 mt-3 whitespace-pre-line">
                    {geminiResult.replace(/```[\s\S]*?\n|```/g, '').replace(/^json\n/, '')}
                  </div>
                ) : null
              )}
            </div>
            <TranscriptionViewer
              transcription={transcription}
              loading={transcriptionLoading}
              error={transcriptionError}
            />
          </div>
        </div>
      </div>
    </div>
  );
} 