import React, { useState, useEffect } from 'react';

import { useAiProcessing } from '../../contexts/AiProcessingContext';
import ReactMarkdown from 'react-markdown';
import recordingsService from '../../services/recordingsService';
import projectsService from '../../services/projectsService';
import TranscriptionViewer from '../../components/TranscriptionViewer/TranscriptionViewer';
import { getSettings, updateSettings } from '../../services/settingsService';
import { getAvailableModels } from '../../services/ai/ollamaProvider';
import { generateWithContext } from '../../services/aiService';
import { shortSummaryPrompt, keyPointsPrompt, detailedSummaryPrompt, chatQuestionPrompt } from '../../prompts/aiPrompts';
import ProjectSelector from '../../components/ProjectSelector/ProjectSelector';
import ChatInterface from '../../components/ChatInterface/ChatInterface';
import recordingAiService from '../../services/recordingAiService';


// Puedes reemplazar estos mocks si tienes datos reales en la grabación
const mockTopics = [
];

// Los prompts ahora se importan desde aiPrompts.js

// Componentes personalizados para el renderizado de Markdown de Key Topics
const keyTopicsMarkdownComponents = {
  p: ({ children }) => <p className="text-white leading-normal">{children}</p>,
  strong: ({ children }) => <strong className="font-semibold text-[#e92932]">{children}</strong>,
  em: ({ children }) => <em className="italic text-gray-300">{children}</em>,
};

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
  const [editingParticipant, setEditingParticipant] = useState(null);
  const [editParticipantName, setEditParticipantName] = useState('');
  const [editParticipantRole, setEditParticipantRole] = useState('');
  const [showDeleteParticipantConfirm, setShowDeleteParticipantConfirm] = useState(false);
  const [participantToDelete, setParticipantToDelete] = useState(null);
  const [showEditParticipantConfirm, setShowEditParticipantConfirm] = useState(false);
  const [participantToEdit, setParticipantToEdit] = useState(null);

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

  // Estado para confirmación de regeneración
  const [showRegenerateConfirm, setShowRegenerateConfirm] = useState(false);
  const [regenerateOptions, setRegenerateOptions] = useState({
    summaries: false,
    keyTopics: false,
    participants: false,
    detailedSummary: false
  });

  // Estado para progreso de generación
  const [generationProgress, setGenerationProgress] = useState({
    isGenerating: false,
    currentStep: '', // 'brief', 'keyTopics', 'detailed', 'participants'
    message: ''
  });

  // Estado para edición de título
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');

  useEffect(() => {
    if (!recording) return;
    setTranscription(null);
    setGeminiData({ resumen_breve: '', ideas: [] });
    setDetailedSummary('');
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

  // Hook del contexto de procesamiento (mantener por compatibilidad pero no usar)
  const { startRecordingAnalysis, getTaskStatus } = useAiProcessing();
  const analysisStatus = getTaskStatus(recording?.id);

  // Estado para verificar si se está generando
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);

  // Lógica automática para obtener resumen usando recordingAiService
  useEffect(() => {
    const loadOrGenerateSummary = async () => {
      if (!recording?.id) return;

      try {
        // 1. Verificar si ya se está generando
        const generating = await recordingAiService.isGenerating(recording.id);
        if (generating) {
          console.log(`⏳ Ya se está generando resumen para ${recording.id}`);
          setIsGeneratingAi(true);
          setGeminiLoading(true);
          setDetailedLoading(true);
          return;
        }

        // 2. Intentar cargar resumen existente
        const existing = await recordingAiService.getRecordingSummary(recording.id);
        
        // 3. Verificar si hay participantes guardados
        const savedParticipants = await recordingsService.getParticipants(recording.id);
        const hasParticipants = savedParticipants && savedParticipants.length > 0;
        // Solo generar participantes si no hay ninguno (ni manuales ni de IA)
        const needsParticipants = !hasParticipants;

        // 4. Verificar qué falta generar
        const needsSummary = !existing || !existing.resumen_breve;
        const needsKeyTopics = !existing || !existing.ideas || existing.ideas.length === 0;
        const needsDetailedSummary = !existing || !existing.resumen_detallado;

        // 5. Si todo existe, solo cargar
        if (!needsSummary && !needsKeyTopics && !needsDetailedSummary && !needsParticipants) {
          console.log('✅ Todos los datos de IA existen, cargando...');
          setGeminiData(existing);
          setDetailedSummary(existing.resumen_detallado || '');
          if (hasParticipants) {
            setParticipants(savedParticipants);
          }
          setGeminiLoading(false);
          setDetailedLoading(false);
          setIsGeneratingAi(false);
          return;
        }

        // 6. Si falta algo, generar solo lo que falta
        console.log(`🤖 Generando datos faltantes para ${recording.id}...`, {
          needsSummary,
          needsKeyTopics,
          needsDetailedSummary,
          needsParticipants
        });
        
        setIsGeneratingAi(true);
        setGeminiLoading(true);
        setDetailedLoading(true);

        // Generar resúmenes si faltan
        if (needsSummary || needsKeyTopics || needsDetailedSummary) {
          const summaryOptions = {
            summaries: needsSummary,
            keyTopics: needsKeyTopics,
            detailedSummary: needsDetailedSummary
          };
          
          const summary = await recordingAiService.generateRecordingSummary(
            recording.id,
            null,
            false,
            summaryOptions
          );

          if (summary) {
            setGeminiData(prev => ({
              resumen_breve: summary.resumen_breve || existing?.resumen_breve || prev?.resumen_breve || '',
              ideas: summary.ideas || existing?.ideas || prev?.ideas || []
            }));
            setDetailedSummary(summary.resumen_detallado || existing?.resumen_detallado || '');
          } else if (existing) {
            // Si no se generó nada nuevo pero hay datos existentes, cargarlos
            setGeminiData(existing);
            setDetailedSummary(existing.resumen_detallado || '');
          }
        } else {
          // Cargar datos existentes si no se necesita generar nada
          if (existing) {
            setGeminiData(existing);
            setDetailedSummary(existing.resumen_detallado || '');
          }
        }

        // Generar participantes si faltan
        if (needsParticipants) {
          console.log('👥 Generando participantes...');
          try {
            const participantsWithIds = await recordingAiService.extractParticipants(recording.id);
            if (participantsWithIds.length > 0) {
              // Preservar participantes manuales existentes (si los hay)
              const manualParticipants = savedParticipants.filter(p => !p.createdByAi);
              const allParticipants = [...manualParticipants, ...participantsWithIds];
              await recordingsService.saveParticipants(recording.id, allParticipants);
              setParticipants(allParticipants);
              console.log(`✅ ${participantsWithIds.length} participantes extraídos (${manualParticipants.length} manuales preservados)`);
            }
          } catch (error) {
            console.error('Error extrayendo participantes:', error);
          }
        } else if (hasParticipants) {
          setParticipants(savedParticipants);
        }

        setGeminiLoading(false);
        setDetailedLoading(false);
        setIsGeneratingAi(false);

      } catch (error) {
        console.error('Error cargando/generando resumen:', error);
        setGeminiError(error.message || 'Error al procesar el resumen');
        setGeminiLoading(false);
        setDetailedLoading(false);
        setIsGeneratingAi(false);
      }
    };

    loadOrGenerateSummary();
  }, [recording]);

  // Handler para mostrar confirmación de regeneración
  const handleRetryGeneration = async () => {
    // Reset options to default (todas deseleccionadas)
    setRegenerateOptions({
      summaries: false,
      keyTopics: false,
      participants: false,
      detailedSummary: false
    });

    // Cargar configuración actual de IA
    try {
      const settings = await getSettings();
      setAiProvider(settings.aiProvider || 'gemini');
      setSelectedOllamaModel(settings.ollamaModel || '');

      // Cargar modelos de Ollama disponibles
      if (settings.aiProvider === 'ollama' || !settings.aiProvider) {
        try {
          const models = await getAvailableModels();
          // Extraer solo los nombres de los modelos
          const modelNames = models.map(m => m.name || m);
          setOllamaModels(modelNames);
        } catch (error) {
          console.error('Error cargando modelos de Ollama:', error);
          setOllamaModels([]);
        }
      }
    } catch (error) {
      console.error('Error cargando configuración:', error);
    }

    setShowRegenerateConfirm(true);
  };

  // Handler para toggle de opciones de regeneración
  const handleToggleRegenerateOption = (option) => {
    setRegenerateOptions(prev => ({
      ...prev,
      [option]: !prev[option]
    }));
  };

  // Handler para regeneración confirmada
  const handleConfirmedRegeneration = async () => {
    if (!recording?.id) return;

    // Verificar que al menos una opción esté seleccionada
    const hasSelection = Object.values(regenerateOptions).some(v => v);
    if (!hasSelection) {
      alert('Selecciona al menos una opción para regenerar');
      return;
    }

    setShowRegenerateConfirm(false);

    try {
      console.log(`🔄 Regenerando elementos seleccionados para ${recording.id}...`, regenerateOptions);

      // Actualizar configuración de IA antes de regenerar
      try {
        const currentSettings = await getSettings();
        await updateSettings({
          ...currentSettings,
          aiProvider: aiProvider,
          ollamaModel: aiProvider === 'ollama' ? selectedOllamaModel : currentSettings.ollamaModel
        });
        console.log(`⚙️ Configuración de IA actualizada: ${aiProvider}${aiProvider === 'ollama' ? ` (${selectedOllamaModel})` : ''}`);
      } catch (error) {
        console.error('Error actualizando configuración de IA:', error);
      }

      // Si se van a regenerar resúmenes, cancelar generación previa
      if (regenerateOptions.summaries || regenerateOptions.keyTopics || regenerateOptions.detailedSummary) {
        await recordingAiService.cancelGeneration(recording.id);

        // Activar estado de generación
        setGenerationProgress({
          isGenerating: true,
          currentStep: 'starting',
          message: '🤖 Iniciando generación con IA...'
        });

        // Limpiar solo los estados que se van a regenerar
        if (regenerateOptions.summaries) {
          setGeminiData(prev => ({ ...prev, resumen_breve: '' }));
        }
        if (regenerateOptions.keyTopics) {
          setGeminiData(prev => ({ ...prev, ideas: [] }));
        }
        if (regenerateOptions.detailedSummary) {
          setDetailedSummary('');
        }

        setGeminiError(null);
        setIsGeneratingAi(true);
        setGeminiLoading(true);
        setDetailedLoading(true);

        // Actualizar mensaje según lo que se está generando
        const generatingMessages = [];
        if (regenerateOptions.detailedSummary) generatingMessages.push('resumen detallado');
        if (regenerateOptions.summaries) generatingMessages.push('resumen breve');
        if (regenerateOptions.keyTopics) generatingMessages.push('key topics');
        
        setGenerationProgress({
          isGenerating: true,
          currentStep: 'generating',
          message: `🤖 Generando ${generatingMessages.join(', ')}...`
        });

        // Generar solo los elementos seleccionados
        const summaryOptions = {
          summaries: regenerateOptions.summaries,
          keyTopics: regenerateOptions.keyTopics,
          detailedSummary: regenerateOptions.detailedSummary
        };

        const summary = await recordingAiService.generateRecordingSummary(
          recording.id,
          null,
          true,
          summaryOptions
        );

        if (summary) {
          setGeminiData(prev => ({
            resumen_breve: regenerateOptions.summaries ? summary.resumen_breve : (prev?.resumen_breve || ''),
            ideas: regenerateOptions.keyTopics ? summary.ideas : (prev?.ideas || [])
          }));

          if (regenerateOptions.detailedSummary) {
            setDetailedSummary(summary.resumen_detallado || '');
          }
        }

        setGeminiLoading(false);
        setDetailedLoading(false);
        setIsGeneratingAi(false);
      }

      // Regenerar participantes si está seleccionado
      if (regenerateOptions.participants) {
        setGenerationProgress({
          isGenerating: true,
          currentStep: 'participants',
          message: '🤖 Extrayendo participantes de la transcripción...'
        });

        try {
          const participantsWithIds = await recordingAiService.extractParticipants(recording.id);

          // Preservar participantes creados manualmente (sin flag createdByAi o con createdByAi: false)
          // Solo reemplazar los que fueron creados por IA
          const manualParticipants = participants.filter(p => !p.createdByAi);
          const allParticipants = [...manualParticipants, ...participantsWithIds];

          // Guardar participantes
          if (participantsWithIds.length > 0 || manualParticipants.length > 0) {
            await recordingsService.saveParticipants(recording.id, allParticipants);
            setParticipants(allParticipants);
            console.log(`✅ ${participantsWithIds.length} participantes extraídos por IA (${manualParticipants.length} manuales preservados)`);
          } else {
            console.log('ℹ️ No se encontraron participantes en la transcripción');
          }
        } catch (error) {
          console.error('Error extrayendo participantes:', error);
        }
      }

      // Finalizar generación
      setGenerationProgress({
        isGenerating: false,
        currentStep: 'completed',
        message: ''
      });

    } catch (error) {
      console.error('Error regenerando elementos:', error);
      setGeminiError(error.message || 'Error al regenerar elementos');
      setGeminiLoading(false);
      setDetailedLoading(false);
      setIsGeneratingAi(false);

      // Limpiar estado de progreso en caso de error
      setGenerationProgress({
        isGenerating: false,
        currentStep: 'error',
        message: ''
      });
    }
  };

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

  // Participantes se cargan en el useEffect principal de loadOrGenerateSummary

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

  const handleSaveTitle = async () => {
    if (!editedTitle.trim() || !recording?.id) return;

    try {
      await recordingsService.renameRecording(recording.id, editedTitle.trim());
      setIsEditingTitle(false);
      // Forzar recarga simple para asegurar consistencia
      window.location.reload();
    } catch (error) {
      console.error('Error renombrando grabación:', error);
      alert('Error al renombrar la grabación');
    }
  };

  const handleKeyDownTitle = (e) => {
    if (e.key === 'Enter') {
      handleSaveTitle();
    } else if (e.key === 'Escape') {
      setIsEditingTitle(false);
      setEditedTitle(recording?.name || 'Reunión sin título');
    }
  };

  const startEditingTitle = () => {
    // No permitir editar si hay un proceso de IA en curso
    if (isGeneratingAi) {
      return;
    }
    setEditedTitle(recording?.name || 'Reunión sin título');
    setIsEditingTitle(true);
  };

  const handleDeleteChatMessage = async (messageId) => {
    try {
      // El messageId viene en formato "user_0" o "assistant_0"
      // Extraer el índice del ID
      const match = messageId.match(/(user|assistant)_(\d+)/);
      if (!match) {
        console.error('Formato de ID de mensaje no reconocido:', messageId);
        return;
      }

      const index = parseInt(match[2], 10);
      
      // Eliminar el par pregunta-respuesta completo (ambos mensajes comparten el mismo índice)
      const updatedHistory = qaHistory.filter((_, i) => i !== index);

      setQaHistory(updatedHistory);
      
      // Guardar el historial completo actualizado
      // Usamos el método de recordingsService que debería manejar esto
      // Por ahora, guardamos cada elemento del historial actualizado
      // Nota: Esto no es ideal, pero funciona hasta que tengamos un método para guardar todo el historial de una vez
      try {
        // Leer el historial actual del archivo
        const currentHistory = await recordingsService.getQuestionHistory(recording.id);
        // Filtrar el elemento eliminado
        const newHistory = currentHistory.filter((_, i) => i !== index);
        
        // Reescribir el archivo completo usando el método de electron
        // Necesitamos acceder directamente al API de electron para escribir el archivo
        if (window.electronAPI?.writeQuestionHistory) {
          await window.electronAPI.writeQuestionHistory(recording.id, newHistory);
        } else {
          console.warn('Método writeQuestionHistory no disponible');
          // Por ahora solo actualizamos el estado local
        }
      } catch (error) {
        console.error('Error guardando historial actualizado:', error);
        // Al menos el estado local está actualizado
      }
    } catch (error) {
      console.error('Error eliminando mensaje:', error);
      alert('Error al eliminar el mensaje');
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
        role: 'Participante',
        createdByAi: false // Participantes manuales no tienen flag de IA
      };
      const updated = [...participants, newParticipant];
      setParticipants(updated);
      setNewParticipantName('');
      setShowParticipantForm(false);
      await recordingsService.saveParticipants(recording.id, updated);
    }
  };

  const handleRemoveParticipant = (participantId) => {
    const participant = participants.find(p => p.id === participantId);
    setParticipantToDelete(participantId);
    setShowDeleteParticipantConfirm(true);
  };

  const handleConfirmDeleteParticipant = async () => {
    if (!participantToDelete) return;
    
    const updated = participants.filter(p => p.id !== participantToDelete);
    setParticipants(updated);
    await recordingsService.saveParticipants(recording.id, updated);
    setShowDeleteParticipantConfirm(false);
    setParticipantToDelete(null);
  };

  const handleStartEditParticipant = (participant) => {
    setEditingParticipant(participant.id);
    setEditParticipantName(participant.name);
    setEditParticipantRole(participant.role || 'Participante');
  };

  const handleCancelEditParticipant = () => {
    setEditingParticipant(null);
    setEditParticipantName('');
    setEditParticipantRole('');
    setShowEditParticipantConfirm(false);
    setParticipantToEdit(null);
  };

  const handleSaveEditParticipant = (participantId) => {
    if (!editParticipantName.trim()) return;
    
    setParticipantToEdit(participantId);
    setShowEditParticipantConfirm(true);
  };

  const handleConfirmEditParticipant = async () => {
    if (!participantToEdit || !editParticipantName.trim()) return;

    const updated = participants.map(p => {
      if (p.id === participantToEdit) {
        return {
          ...p,
          name: editParticipantName.trim(),
          role: editParticipantRole.trim() || 'Participante',
          createdByAi: false // Al editar manualmente, quitar el flag de IA
        };
      }
      return p;
    });

    setParticipants(updated);
    setEditingParticipant(null);
    setEditParticipantName('');
    setEditParticipantRole('');
    await recordingsService.saveParticipants(recording.id, updated);
    setShowEditParticipantConfirm(false);
    setParticipantToEdit(null);
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


  if (!recording) {
    return (
      <div className="flex items-center justify-center h-full text-white">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mr-3"></div>
        Cargando grabación...
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#1a0f0f]">
      {/* Header con botón de volver y título editable */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#472426] bg-[#2a1a1b]">
        <div className="flex items-center gap-4 flex-1">
          <button
            onClick={onBack}
            className="p-2 hover:bg-[#472426] rounded-full text-white transition-colors"
            title="Volver"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 256 256">
              <path d="M224,128a8,8,0,0,1-8,8H59.31l58.35,58.34a8,8,0,0,1-11.32,11.32l-72-72a8,8,0,0,1,0-11.32l72-72a8,8,0,0,1,11.32,11.32L59.31,120H216A8,8,0,0,1,224,128Z"></path>
            </svg>
          </button>

          {isEditingTitle ? (
            <div className="flex items-center gap-2 flex-1 max-w-xl">
              <input
                type="text"
                value={editedTitle}
                onChange={(e) => setEditedTitle(e.target.value)}
                onKeyDown={handleKeyDownTitle}
                className="flex-1 bg-[#331a1b] text-white text-xl font-bold px-3 py-1 rounded border border-[#e92932] focus:outline-none"
                autoFocus
              />
              <button
                onClick={handleSaveTitle}
                className="p-1.5 bg-[#472426] text-green-400 rounded hover:bg-[#663336]"
                title="Guardar"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 256 256">
                  <path d="M229.66,21.66a8,8,0,0,0-11.32,0L71.06,169,37.66,135.6a8,8,0,0,0-11.32,11.32l40,40a8,8,0,0,0,11.32,0L229.66,33A8,8,0,0,0,229.66,21.66Z"></path>
                </svg>
              </button>
              <button
                onClick={() => setIsEditingTitle(false)}
                className="p-1.5 bg-[#472426] text-red-400 rounded hover:bg-[#663336]"
                title="Cancelar"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 256 256">
                  <path d="M205.66,194.34a8,8,0,0,1-11.32,11.32L128,139.31,61.66,205.66a8,8,0,0,1-11.32-11.32L116.69,128,50.34,61.66A8,8,0,0,1,61.66,50.34L128,116.69l66.34-66.35a8,8,0,0,1,11.32,11.32L139.31,128Z"></path>
                </svg>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3 group">
              <h1 className="text-white text-xl font-bold truncate max-w-xl" title={recording.name}>
                {recording.name || 'Reunión sin título'}
              </h1>
              <button
                onClick={startEditingTitle}
                disabled={isGeneratingAi}
                className={`text-[#c89295] opacity-0 group-hover:opacity-100 hover:text-white transition-opacity p-1 hover:bg-[#472426] rounded ${isGeneratingAi ? 'opacity-50 cursor-not-allowed' : ''}`}
                title={isGeneratingAi ? 'No se puede editar mientras se procesa la IA' : 'Editar nombre'}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 256 256">
                  <path d="M227.31,73.37,182.63,28.68a16,16,0,0,0-22.63,0L36.69,152.05A16,16,0,0,0,32,163.31V208a16,16,0,0,0,16,16H92.69A16,16,0,0,0,104,219.31L227.31,96a16,16,0,0,0,0-22.63ZM92.69,208H48V163.31l88-88L180.69,120ZM192,108.68,147.31,64l24-24L216,84.68Z"></path>
                </svg>
              </button>
            </div>
          )}
        </div>

      </div>

      <div className="px-6 flex flex-1 gap-4 py-5 overflow-hidden">
        {/* Columna izquierda: Meeting Summary, Key Topics, Participantes */}
        <div className="flex flex-col w-[30rem] min-w-[30rem] flex-shrink-0 overflow-y-auto">
          {/* Banner de estado de generación */}
          {generationProgress.isGenerating && (
            <div className="bg-[#472426] border border-[#e92932] rounded-lg px-4 py-3 mb-4 mx-4 mt-2">
              <div className="flex items-center gap-3">
                <div className="animate-spin text-[#e92932] text-xl">⚙️</div>
                <div className="flex-1">
                  <div className="text-white font-medium">{generationProgress.message}</div>
                  <div className="text-[#c89295] text-sm mt-1">
                    Esto puede tardar varios minutos...
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between px-4 pb-3 pt-5">
            <h2 className="text-white text-[22px] font-bold leading-tight tracking-[-0.015em]">Meeting Summary</h2>
            {geminiData.resumen_breve && !geminiLoading && (
              <button
                onClick={handleRetryGeneration}
                className="px-3 py-1.5 bg-[#472426] text-white rounded-lg hover:bg-[#663336] transition-colors text-xs flex items-center gap-1"
                title="Regenerar resúmenes con IA"
              >
                🔄 Regenerar
              </button>
            )}
          </div>
          <p className="text-white text-base font-normal leading-normal pb-3 pt-1 px-4">
            {geminiData.resumen_breve || recording?.summary || ''}
          </p>
          <h2 className="text-white text-[22px] font-bold leading-tight tracking-[-0.015em] px-4 pb-3 pt-5">Key Topics</h2>
          {(geminiData.ideas.length > 0 ? geminiData.ideas : (recording?.topics || mockTopics.map(t => t.name))).map((idea, index) => (
            <div key={index} className="flex items-center gap-4 bg-[#221112] px-4 min-h-14 justify-between group hover:bg-[#331a1b] transition-colors">
              <div className="text-white text-base font-normal leading-normal flex-1 break-words whitespace-pre-line">
                <ReactMarkdown components={keyTopicsMarkdownComponents}>
                  {idea}
                </ReactMarkdown>
              </div>
            </div>
          ))}
          <h2 className="text-white text-[22px] font-bold leading-tight tracking-[-0.015em] px-4 pb-3 pt-5">Participantes</h2>
          <div className="px-4 pb-4">
            {[...participants].sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' })).map((participant) => (
              <div key={participant.id} className="flex items-center justify-between bg-[#221112] px-4 py-3 mb-2 rounded-lg hover:bg-[#331a1b] transition-colors">
                {editingParticipant === participant.id ? (
                  // Modo edición
                  <div className="flex-1 flex flex-col gap-2">
                    <input
                      type="text"
                      value={editParticipantName}
                      onChange={(e) => setEditParticipantName(e.target.value)}
                      className="px-2 py-1 text-white bg-[#331a1b] border border-[#472426] rounded text-sm focus:outline-none focus:border-[#663336]"
                      placeholder="Nombre"
                      autoFocus
                    />
                    <input
                      type="text"
                      value={editParticipantRole}
                      onChange={(e) => setEditParticipantRole(e.target.value)}
                      className="px-2 py-1 text-white bg-[#331a1b] border border-[#472426] rounded text-sm focus:outline-none focus:border-[#663336]"
                      placeholder="Rol"
                    />
                    <div className="flex gap-2 mt-1">
                      <button
                        onClick={() => handleSaveEditParticipant(participant.id)}
                        className="px-2 py-1 bg-[#e92932] text-white rounded text-xs hover:bg-[#d41f27] transition-colors"
                      >
                        Guardar
                      </button>
                      <button
                        onClick={handleCancelEditParticipant}
                        className="px-2 py-1 bg-[#472426] text-white rounded text-xs hover:bg-[#663336] transition-colors"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  // Modo visualización
                  <>
                    <div className="flex items-center gap-3 flex-1">
                      <div className="w-8 h-8 bg-[#e92932] rounded-full flex items-center justify-center">
                        <span className="text-white text-sm font-bold">
                          {participant.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-white text-sm font-medium">{participant.name}</p>
                          {participant.createdByAi && (
                            <span className="text-[#8b5cf6] text-xs bg-[#8b5cf6]/20 px-1.5 py-0.5 rounded" title="Creado por IA">
                              🤖 IA
                            </span>
                          )}
                        </div>
                        <p className="text-[#c89295] text-xs">{participant.role}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleStartEditParticipant(participant)}
                        className="text-[#c89295] hover:text-[#8b5cf6] transition-colors p-1"
                        title="Editar participante"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 256 256">
                          <path d="M227.31,73.37,182.63,28.68a16,16,0,0,0-22.63,0L36.69,152.05A16,16,0,0,0,32,163.31V208a16,16,0,0,0,16,16H92.69A16,16,0,0,0,104,219.31L227.31,96a16,16,0,0,0,0-22.63ZM92.69,208H48V163.31l88-88L180.69,120ZM192,108.68,147.31,64l24-24L216,84.68Z"></path>
                        </svg>
                      </button>
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
                  </>
                )}
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
        {/* Columna derecha: Resumen detallado, Product Launch Meeting, Chat, Transcripción */}
        <div className="flex flex-col flex-1 min-w-0 overflow-y-auto">
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
                    <>Ocultar <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" /></svg></>
                  ) : (
                    <>Mostrar completo <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></svg></>
                  )}
                </button>
              </div>
              <p className="text-sm text-[#c89295] mb-3">Este resumen se usa como contexto para las preguntas del chat</p>
              <div
                className={`transition-all duration-300 prose prose-invert max-w-full ${isDetailedSummaryExpanded
                  ? 'max-h-[600px] overflow-y-auto'
                  : 'max-h-[100px] overflow-hidden'
                  }`}
              >
                <ReactMarkdown
                  components={detailedSummaryMarkdownComponents}
                  style={{
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    overflowWrap: 'break-word',
                    lineHeight: '1.6'
                  }}
                >
                  {detailedSummary}
                </ReactMarkdown>
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
              title="Chat con IA"
              placeholder="Haz preguntas sobre la reunión..."
              aiProvider={aiProvider}
              ollamaModels={ollamaModels}
              selectedOllamaModel={selectedOllamaModel}
              onOllamaModelChange={handleOllamaModelChange}
              onNavigateToRecording={handlePlayFromTimestamp}
              onDeleteMessage={handleDeleteChatMessage}
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
                <div className="flex items-center gap-3 text-[#e92932] font-bold py-2">
                  <span>Generando resumen estructurado...</span>
                  {isGeneratingAi && (
                    <button
                      onClick={handleRetryGeneration}
                      className="px-3 py-1 bg-[#472426] text-white rounded-lg hover:bg-[#663336] transition-colors text-sm flex items-center gap-1"
                      title="Reiniciar generación"
                    >
                      🔄 Reiniciar
                    </button>
                  )}
                </div>
              )}
              {detailedLoading && (
                <div className="flex items-center gap-3 text-[#e92932] font-bold py-2">
                  <span>Generando resumen detallado...</span>
                  {isGeneratingAi && (
                    <button
                      onClick={handleRetryGeneration}
                      className="px-3 py-1 bg-[#472426] text-white rounded-lg hover:bg-[#663336] transition-colors text-sm flex items-center gap-1"
                      title="Reiniciar generación"
                    >
                      🔄 Reiniciar
                    </button>
                  )}
                </div>
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

      {/* Modal de confirmación para regenerar resúmenes */}
      {showRegenerateConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[#2a1a1b] border border-[#472426] rounded-lg p-6 max-w-md mx-4">
            <h3 className="text-white text-xl font-bold mb-3">🔄 Regenerar con IA</h3>
            <p className="text-gray-300 mb-4">
              Selecciona qué elementos quieres regenerar:
            </p>

            {/* Opciones de regeneración */}
            <div className="space-y-3 mb-6">
              <label className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={regenerateOptions.summaries}
                  onChange={() => handleToggleRegenerateOption('summaries')}
                  className="mt-1 w-4 h-4 text-[#e92932] bg-[#331a1b] border-[#472426] rounded focus:ring-[#e92932] focus:ring-2"
                />
                <div className="flex-1">
                  <div className="text-white font-medium group-hover:text-[#e92932] transition-colors">
                    Resumen Breve
                  </div>
                  <div className="text-[#c89295] text-sm">
                    Resumen ejecutivo de 1-2 frases
                  </div>
                </div>
              </label>

              <label className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={regenerateOptions.keyTopics}
                  onChange={() => handleToggleRegenerateOption('keyTopics')}
                  className="mt-1 w-4 h-4 text-[#e92932] bg-[#331a1b] border-[#472426] rounded focus:ring-[#e92932] focus:ring-2"
                />
                <div className="flex-1">
                  <div className="text-white font-medium group-hover:text-[#e92932] transition-colors">
                    Key Topics / Ideas Principales
                  </div>
                  <div className="text-[#c89295] text-sm">
                    Lista de temas destacados
                  </div>
                </div>
              </label>

              <label className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={regenerateOptions.detailedSummary}
                  onChange={() => handleToggleRegenerateOption('detailedSummary')}
                  className="mt-1 w-4 h-4 text-[#e92932] bg-[#331a1b] border-[#472426] rounded focus:ring-[#e92932] focus:ring-2"
                />
                <div className="flex-1">
                  <div className="text-white font-medium group-hover:text-[#e92932] transition-colors">
                    Resumen Detallado
                  </div>
                  <div className="text-[#c89295] text-sm">
                    Análisis completo y extenso
                  </div>
                </div>
              </label>

              <label className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={regenerateOptions.participants}
                  onChange={() => handleToggleRegenerateOption('participants')}
                  className="mt-1 w-4 h-4 text-[#e92932] bg-[#331a1b] border-[#472426] rounded focus:ring-[#e92932] focus:ring-2"
                />
                <div className="flex-1">
                  <div className="text-white font-medium group-hover:text-[#e92932] transition-colors">
                    Participantes
                  </div>
                  <div className="text-[#c89295] text-sm">
                    Detectar participantes desde transcripción
                  </div>
                </div>
              </label>
            </div>

            {/* Configuración de IA */}
            <div className="border-t border-[#472426] pt-4 mb-4">
              <h4 className="text-white font-medium mb-3">Configuración de IA</h4>

              {/* Selector de proveedor */}
              <div className="mb-3">
                <label className="text-[#c89295] text-sm mb-2 block">Proveedor de IA</label>
                <select
                  value={aiProvider}
                  onChange={(e) => setAiProvider(e.target.value)}
                  className="w-full bg-[#331a1b] text-white border border-[#472426] rounded px-3 py-2 focus:outline-none focus:border-[#e92932]"
                >
                  <option value="gemini">Gemini (Google)</option>
                  <option value="ollama">Ollama (Local)</option>
                </select>
              </div>

              {/* Selector de modelo Ollama */}
              {aiProvider === 'ollama' && (
                <div className="mb-3">
                  <label className="text-[#c89295] text-sm mb-2 block">Modelo de Ollama</label>
                  <select
                    value={selectedOllamaModel}
                    onChange={(e) => setSelectedOllamaModel(e.target.value)}
                    className="w-full bg-[#331a1b] text-white border border-[#472426] rounded px-3 py-2 focus:outline-none focus:border-[#e92932]"
                  >
                    {ollamaModels.length === 0 ? (
                      <option value="">No hay modelos disponibles</option>
                    ) : (
                      ollamaModels.map(model => (
                        <option key={model} value={model}>{model}</option>
                      ))
                    )}
                  </select>
                  {ollamaModels.length === 0 && (
                    <p className="text-yellow-400 text-xs mt-1">
                      ⚠️ Asegúrate de que Ollama esté ejecutándose
                    </p>
                  )}
                </div>
              )}
            </div>

            <p className="text-yellow-400 text-xs mb-4 bg-yellow-900/20 border border-yellow-600/30 rounded px-3 py-2">
              ⚠️ Esta acción sobrescribirá los datos actuales y puede tardar varios minutos
            </p>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowRegenerateConfirm(false)}
                className="px-4 py-2 bg-[#472426] text-white rounded-lg hover:bg-[#663336] transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmedRegeneration}
                className="px-4 py-2 bg-[#e92932] text-white rounded-lg hover:bg-[#d41f27] transition-colors font-medium"
              >
                Regenerar Seleccionados
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de confirmación para eliminar participante */}
      {showDeleteParticipantConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[#2a1a1b] border border-[#472426] rounded-lg p-6 max-w-md mx-4">
            <h3 className="text-white text-xl font-bold mb-3">⚠️ Eliminar Participante</h3>
            <p className="text-gray-300 mb-4">
              ¿Estás seguro de que quieres eliminar a este participante? Esta acción no se puede deshacer.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowDeleteParticipantConfirm(false);
                  setParticipantToDelete(null);
                }}
                className="px-4 py-2 bg-[#472426] text-white rounded-lg hover:bg-[#663336] transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmDeleteParticipant}
                className="px-4 py-2 bg-[#e92932] text-white rounded-lg hover:bg-[#d41f27] transition-colors font-medium"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de confirmación para modificar participante */}
      {showEditParticipantConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[#2a1a1b] border border-[#472426] rounded-lg p-6 max-w-md mx-4">
            <h3 className="text-white text-xl font-bold mb-3">✏️ Modificar Participante</h3>
            <p className="text-gray-300 mb-4">
              ¿Estás seguro de que quieres guardar los cambios en este participante?
            </p>
            <div className="bg-[#331a1b] border border-[#472426] rounded p-3 mb-4">
              <p className="text-white text-sm mb-1">
                <span className="text-[#c89295]">Nombre:</span> {editParticipantName}
              </p>
              <p className="text-white text-sm">
                <span className="text-[#c89295]">Rol:</span> {editParticipantRole || 'Participante'}
              </p>
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowEditParticipantConfirm(false);
                  setParticipantToEdit(null);
                }}
                className="px-4 py-2 bg-[#472426] text-white rounded-lg hover:bg-[#663336] transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmEditParticipant}
                className="px-4 py-2 bg-[#e92932] text-white rounded-lg hover:bg-[#d41f27] transition-colors font-medium"
              >
                Guardar Cambios
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}