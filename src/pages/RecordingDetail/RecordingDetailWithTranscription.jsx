import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import recordingsService from '../../services/recordingsService';
import projectsService from '../../services/projectsService';
import TranscriptionViewer from '../../components/TranscriptionViewer/TranscriptionViewer';
import { generateWithContext } from '../../services/aiService';
import { getSettings, updateSettings } from '../../services/settingsService';
import { getAvailableModels } from '../../services/ollamaService';
import { shortSummaryPrompt, keyPointsPrompt,detailedSummaryPrompt, chatQuestionPrompt } from '../../prompts/aiPrompts';
import ProjectSelector from '../../components/ProjectSelector/ProjectSelector';
import ChatInterface from '../../components/ChatInterface/ChatInterface';

// Puedes reemplazar estos mocks si tienes datos reales en la grabación
const mockTopics = [
];

// Los prompts ahora se importan desde aiPrompts.js

// Componentes personalizados para el renderizado de Markdown del resumen detallado
const detailedSummaryMarkdownComponents = {
  p: ({ children }) => <p className="mb-3 text-white leading-relaxed">{children}</p>,
  ul: ({ children }) => <ul className="mb-3 ml-4 list-disc text-white">{children}</ul>,
  ol: ({ children }) => <ol className="mb-3 ml-4 list-decimal text-white">{children}</ol>,
  li: ({ children }) => <li className="mb-1 text-white">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold text-white">{children}</strong>,
  em: ({ children }) => <em className="italic text-gray-300">{children}</em>,
  code: ({ inline, children }) => 
    inline ? (
      <code className="bg-gray-800 text-yellow-400 px-1 py-0.5 rounded text-sm font-mono">{children}</code>
    ) : (
      <pre className="bg-gray-800 text-yellow-400 p-3 rounded-lg overflow-x-auto mb-3"><code className="text-sm font-mono">{children}</code></pre>
    ),
  h1: ({ children }) => <h1 className="text-xl font-bold text-white mb-3 mt-4 first:mt-0">{children}</h1>,
  h2: ({ children }) => <h2 className="text-lg font-semibold text-white mb-2 mt-3 first:mt-0">{children}</h2>,
  h3: ({ children }) => <h3 className="text-base font-medium text-white mb-2 mt-2 first:mt-0">{children}</h3>,
  blockquote: ({ children }) => <blockquote className="border-l-4 border-gray-600 pl-4 italic text-gray-300 mb-3">{children}</blockquote>,
};

export default function RecordingDetailWithTranscription({ recording, onBack, onNavigateToProject }) {
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
  const [geminiData, setGeminiData] = useState({ resumen_breve: '', ideas: [] });
  const [geminiLoading, setGeminiLoading] = useState(false);
  const [geminiError, setGeminiError] = useState(null);
  const [geminiResult, setGeminiResult] = useState(null);
  const [geminiChecked, setGeminiChecked] = useState(false); // Para evitar doble llamada
  const [geminiSlowWarning, setGeminiSlowWarning] = useState(false); // Para mostrar advertencia de lentitud
  
  // Estado para resumen detallado
  const [detailedSummary, setDetailedSummary] = useState('');
  const [detailedLoading, setDetailedLoading] = useState(false);
  const [detailedError, setDetailedError] = useState(null);
  const [isDetailedSummaryExpanded, setIsDetailedSummaryExpanded] = useState(false);

  // Estado para el histórico de preguntas
  const [qaHistory, setQaHistory] = useState([]);
  const [questionLoading, setQuestionLoading] = useState(false);
  const [questionError, setQuestionError] = useState(null);
  const [questionAnswer, setQuestionAnswer] = useState(null);
  const [questionSlowWarning, setQuestionSlowWarning] = useState(false); // Para mostrar advertencia de lentitud
  
  // Estado para el proyecto
  const [currentProject, setCurrentProject] = useState(null);
  const [showProjectSelector, setShowProjectSelector] = useState(false);
  
  // Estado para configuración de IA
  const [aiProvider, setAiProvider] = useState('gemini');
  const [ollamaModels, setOllamaModels] = useState([]);
  const [selectedOllamaModel, setSelectedOllamaModel] = useState('');

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
      setDetailedLoading(true);
      setGeminiError(null);
      setDetailedError(null);
      setGeminiResult(null);
      
      // 1. Intentar cargar resumen guardado
      const existing = await recordingsService.getAiSummary(recording.id);
      console.log('Resumen existente cargado:', existing); // Debug
      if (existing && existing.resumen_breve && Array.isArray(existing.ideas)) {
        setGeminiData(existing);
        setDetailedSummary(existing.resumen_detallado || '');
        console.log('Resumen detallado cargado:', existing.resumen_detallado); // Debug
        setGeminiLoading(false);
        setDetailedLoading(false);
        return;
      }
      
      // 2. Si no existe, generar ambos resúmenes en paralelo
      try {
        const txt = await recordingsService.getTranscriptionTxt(recording.id);
        if (!txt) {
          setGeminiError('No se pudo obtener el texto de la transcripción.');
          setDetailedError('No se pudo obtener el texto de la transcripción.');
          setGeminiLoading(false);
          setDetailedLoading(false);
          return;
        }
        
        // Configurar timeout de 10 segundos
        const timeoutId = setTimeout(() => {
          setGeminiSlowWarning(true);
        }, 10000);


        const detailedResponse = await generateWithContext(detailedSummaryPrompt, txt)
        const detailedResponseText = detailedResponse.text || '';
        // Generar ambos resúmenes en paralelo
        const [ shortSummary , keyPointResponse] = await Promise.all([
          generateWithContext(shortSummaryPrompt, detailedResponseText?? txt),
          generateWithContext(keyPointsPrompt, detailedResponseText?? txt)
        ]);
        debugger;
        clearTimeout(timeoutId);
        setGeminiSlowWarning(false);
        
        // Procesar resumen estructurado
        const shortSummaryText = shortSummary.text || '';
        const detailedText = detailedResponse.text || '';
        const keyPointText = keyPointResponse.text || '';
        
        setDetailedSummary(detailedText);
        
        // Procesar ideas/keypoints
        let ideas = [];
        if (keyPointText) {
          ideas = keyPointText.split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0 && (line.startsWith('-') || line.startsWith('•') || /^\d+\./.test(line)))
            .map(line => line.replace(/^[•-]\s*|^\d+\.\s*/, ''));
        }

        const dataToSave = {
          resumen_breve: shortSummaryText,
          ideas: ideas,
          resumen_detallado: detailedText,
          key_points: keyPointText,
          resumen_corto: shortSummaryText
        };

        setGeminiData(dataToSave);
        
        await recordingsService.saveAiSummary(recording.id, dataToSave);
        //} else {
         // setGeminiResult(summaryText);
          //setGeminiData({ resumen_breve: '', ideas: [] });
       // }
      } catch (error) {
        setGeminiError('Error al obtener respuesta de IA: ' + error.message);
        setDetailedError('Error al obtener resumen detallado: ' + error.message);
        setGeminiSlowWarning(false);
      } finally {
        setGeminiLoading(false);
        setDetailedLoading(false);
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

  // Convertir historial de preguntas y respuestas al formato del chat
  const convertQaHistoryToChatHistory = () => {
    const chatHistory = [];
    qaHistory.forEach((qa, index) => {
      // Agregar pregunta del usuario
      chatHistory.push({
        id: `user_${index}`,
        tipo: 'usuario',
        contenido: qa.pregunta,
        fecha: qa.fecha,
        avatar: '👤'
      });
      // Agregar respuesta del asistente
      chatHistory.push({
        id: `assistant_${index}`,
        tipo: 'asistente',
        contenido: qa.respuesta,
        fecha: qa.fecha,
        avatar: '🤖'
      });
    });
    return chatHistory;
  };

  // Participantes
  useEffect(() => {
    if (!recording?.id) return;
    recordingsService.getParticipants(recording.id).then((saved) => {
      if (saved && saved.length > 0) setParticipants(saved);
    });
  }, [recording]);

  // Cargar proyecto actual
  useEffect(() => {
    if (!recording?.id) return;
    projectsService.getRecordingProject(recording.id).then((project) => {
      if (project) setCurrentProject(project);
    });
  }, [recording]);

  // Cargar configuración de IA
  useEffect(() => {
    const loadAiConfig = async () => {
      try {
        const settings = await getSettings();
        setAiProvider(settings.aiProvider || 'gemini');
        setSelectedOllamaModel(settings.ollamaModel || '');
        
        // Si el proveedor es Ollama, cargar modelos
        if (settings.aiProvider === 'ollama') {
          try {
            const models = await getAvailableModels();
            setOllamaModels(models);
          } catch (error) {
            console.error('Error cargando modelos de Ollama:', error);
          }
        }
      } catch (error) {
        console.error('Error cargando configuración de IA:', error);
      }
    };

    loadAiConfig();
  }, []);

  // Handler para cambiar modelo de Ollama
  const handleOllamaModelChange = async (modelName) => {
    setSelectedOllamaModel(modelName);
    try {
      // Obtener la configuración actual para preservar el aiProvider
      const currentSettings = await getSettings();
      await updateSettings({
        ...currentSettings,
        ollamaModel: modelName
      });
    } catch (error) {
      console.error('Error actualizando modelo de Ollama:', error);
    }
  };

  // Handler para enviar pregunta
  const handleAskQuestion = async (questionText) => {
    setQuestionLoading(true);
    setQuestionError(null);
    setQuestionAnswer(null);
    setQuestionSlowWarning(false);
    try {
      // Usar el resumen detallado como contexto en lugar de la transcripción completa
      let contextToUse = detailedSummary;
      
      // Si no hay resumen detallado, usar la transcripción completa como fallback
      if (!contextToUse) {
        contextToUse = await recordingsService.getTranscriptionTxt(recording.id);
      }
      
      if (!contextToUse) {
        setQuestionError('No se pudo obtener el contexto para responder la pregunta.');
        setQuestionLoading(false);
        return;
      }
      
      // Configurar timeout de 10 segundos
      const timeoutId = setTimeout(() => {
        setQuestionSlowWarning(true);
      }, 10000);
      
      // Usar prompt centralizado
      const prompt = chatQuestionPrompt(questionText);
      const response = await generateWithContext(prompt, contextToUse);
      clearTimeout(timeoutId);
      setQuestionSlowWarning(false);
      
      let text = response.text || 'Sin respuesta de IA';
      setQuestionAnswer(text);
      // Guardar en histórico
      const qa = { pregunta: questionText, respuesta: text, fecha: new Date().toISOString() };
      await recordingsService.saveQuestionHistory(recording.id, qa);
      setQaHistory(prev => [...prev, qa]);
    } catch (error) {
      setQuestionError(error.message || 'Error al obtener respuesta de IA');
      setQuestionSlowWarning(false);
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

  const handleMoveToProject = async (project) => {
    if (project && recording?.id) {
      try {
        await projectsService.addRecordingToProject(project.id, recording.id);
        setCurrentProject(project);
        setShowProjectSelector(false);
      } catch (error) {
        console.error('Error moviendo grabación al proyecto:', error);
      }
    } else {
      // Eliminar de proyecto actual
      if (currentProject && recording?.id) {
        try {
          await projectsService.removeRecordingFromProject(currentProject.id, recording.id);
          setCurrentProject(null);
          setShowProjectSelector(false);
        } catch (error) {
          console.error('Error eliminando grabación del proyecto:', error);
        }
      }
    }
  };

  // Handler para el botón de IA


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
          {/* Resumen detallado destacado con colapsar/expandir */}
          {detailedSummary && (
            <div className="bg-[#2a1a1b] text-white rounded-lg p-6 mb-6 border border-[#472426]">
              <div className="flex items-center justify-between mb-3">
                <span className="font-bold text-[#e92932]">📋 Resumen Detallado (Contexto del Chat)</span>
                <button
                  onClick={() => setIsDetailedSummaryExpanded(!isDetailedSummaryExpanded)}
                  className="text-[#c89295] hover:text-white transition-colors flex items-center gap-1"
                >
                  {isDetailedSummaryExpanded ? (
                    <>Ocultar <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd"/></svg></>
                  ) : (
                    <>Mostrar completo <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd"/></svg></>
                  )}
                </button>
              </div>
              <p className="text-sm text-[#c89295] mb-3">Este resumen se usa como contexto para las preguntas del chat</p>
              <div 
                className={`transition-all duration-300 ${
                  isDetailedSummaryExpanded 
                    ? 'max-h-none' 
                    : 'max-h-32 overflow-hidden relative'
                }`}
              >
                <ReactMarkdown components={detailedSummaryMarkdownComponents}>
                  {detailedSummary}
                </ReactMarkdown>
                {!isDetailedSummaryExpanded && (
                  <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-[#2a1a1b] to-transparent"></div>
                )}
              </div>
            </div>
          )}
          <div className="flex flex-wrap justify-between gap-3 p-4 items-start">
            <div>
              <p className="text-white tracking-light text-[32px] font-bold leading-tight min-w-72">{recording?.title || 'Product Launch Meeting'}</p>
              {currentProject && (
                <div className="flex items-center gap-2 mt-3">
                  <button
                    onClick={() => onNavigateToProject && onNavigateToProject(currentProject)}
                    className="bg-[#8b5cf6] text-white px-3 py-1 rounded-full text-sm font-medium hover:bg-[#7c3aed] transition-all hover:shadow-lg flex items-center gap-1.5 group"
                    title="Ir al proyecto"
                  >
                    📁 {currentProject.name}
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 256 256" className="opacity-70 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all">
                      <path d="M221.66,133.66l-72,72a8,8,0,0,1-11.32-11.32L196.69,136H40a8,8,0,0,1,0-16H196.69L138.34,61.66a8,8,0,0,1,11.32-11.32l72,72A8,8,0,0,1,221.66,133.66Z"></path>
                    </svg>
                  </button>
                  <button 
                    onClick={() => setShowProjectSelector(true)}
                    className="text-[#c89295] hover:text-white text-sm underline"
                  >
                    Cambiar
                  </button>
                </div>
              )}
              {!currentProject && (
                <button 
                  onClick={() => setShowProjectSelector(true)}
                  className="mt-3 bg-[#472426] text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-[#663336] transition-colors"
                >
                  + Agregar a Proyecto
                </button>
              )}
            </div>
          </div>
          {/* Chat Interface */}
          <div className="px-4 py-3">
            <ChatInterface
              chatHistory={convertQaHistoryToChatHistory()}
              onSendMessage={handleAskQuestion}
              isLoading={questionLoading}
              placeholder="Haz una pregunta sobre la reunión"
              title="Chat de la Reunión"
              aiProvider={aiProvider}
              ollamaModels={ollamaModels}
              selectedOllamaModel={selectedOllamaModel}
              onOllamaModelChange={handleOllamaModelChange}
            />
          </div>
          {questionSlowWarning && (
            <div className="text-yellow-400 py-2 text-sm bg-yellow-900/20 border border-yellow-600/30 rounded-lg px-4 mx-4 my-2">
              ⏳ La respuesta puede tardar más tiempo dependiendo del modelo de IA seleccionado. Por favor, espera...
            </div>
          )}
          {questionError && <div className="text-red-400 px-4">{questionError}</div>}
          {/* Transcripción debajo del input */}
          <div className="w-full flex-1 px-4 pb-4">
            {/* Indicadores de generación de resúmenes */}
            <div className="mb-4">
              {geminiLoading && (
                <div className="text-[#e92932] font-bold py-2">Generando resumen estructurado...</div>
              )}
              {detailedLoading && (
                <div className="text-[#e92932] font-bold py-2">Generando resumen detallado...</div>
              )}
              {geminiSlowWarning && (
                <div className="text-yellow-400 py-2 text-sm bg-yellow-900/20 border border-yellow-600/30 rounded-lg px-3 my-2">
                  ⏳ La respuesta puede tardar más tiempo dependiendo del modelo de IA seleccionado. Por favor, espera...
                </div>
              )}
              {geminiError && (
                <div className="text-red-400 mt-2">{geminiError}</div>
              )}
              {detailedError && (
                <div className="text-red-400 mt-2">{detailedError}</div>
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

      {/* Selector de proyecto */}
      {showProjectSelector && (
        <ProjectSelector
          selectedProjectId={currentProject?.id}
          onSelect={handleMoveToProject}
          onCancel={() => setShowProjectSelector(false)}
        />
      )}
    </div>
  );
} 