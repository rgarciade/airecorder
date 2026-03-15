import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import styles from './ProjectDetail.module.css';
import projectAiService from '../../services/projectAiService';
import projectChatService from '../../services/projectChatService';
import projectsService from '../../services/projectsService';
import recordingsService from '../../services/recordingsService';
import ProjectChatPanel from '../../components/ProjectChatPanel/ProjectChatPanel';
import ProjectTimeline from '../../components/ProjectTimeline/ProjectTimeline';
import ParticipantsList from '../../components/ParticipantsList/ParticipantsList';
import ProjectRecordingSummaries from '../../components/ProjectRecordingSummaries/ProjectRecordingSummaries';
import ChatInterface from '../../components/ChatInterface/ChatInterface';
import EpicsTab from '../RecordingDetail/components/EpicsTab/EpicsTab';
import ProjectKanbanBoard from './components/ProjectKanbanBoard/ProjectKanbanBoard';
import ProjectAttachmentsTab from './components/ProjectAttachmentsTab/ProjectAttachmentsTab';
import { MdArrowBack, MdRefresh, MdFormatListBulleted, MdGridView } from 'react-icons/md';
import ragService from '../../services/ragService';
import ContextBar from '../../components/ContextBar/ContextBar';
import { getSettings, updateSettings } from '../../services/settingsService';
import { getAvailableModels, checkModelSupportsStreaming } from '../../services/ai/ollamaProvider';
import { getLMStudioModels } from '../../services/ai/lmStudioProvider';
import { checkModelVisionSupport } from '../../services/ai/huggingFaceService';
import chatPendingService from '../../services/chatPendingService';
import { getAttachments } from '../../services/attachmentsService';

const DEEPSEEK_CHAT_MODELS = [
  { value: 'deepseek-chat', label: 'DeepSeek Chat' },
  { value: 'deepseek-reasoner', label: 'DeepSeek Reasoner' },
  { value: 'deepseek-coder', label: 'DeepSeek Coder' },
];
const KIMI_CHAT_MODELS = [
  { value: 'kimi-k2', label: 'Kimi K2' },
  { value: 'kimi-k2-turbo-preview', label: 'Kimi K2 Turbo' },
  { value: 'kimi-k2.5', label: 'Kimi K2.5' },
];

export default function ProjectDetail({ project, onBack, onNavigateToRecording: navigateToRecordingProp }) {
  // Wrapper para usar el prop renombrado
  const props = { onNavigateToRecording: navigateToRecordingProp };
  
  // --- STATE ---
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'chat' | 'tasks'
  const [isContextExpanded, setIsContextExpanded] = useState(false);

  // Estado de tareas del proyecto
  const [projectTasks, setProjectTasks] = useState([]);
  const [tasksView, setTasksView] = useState('kanban'); // 'list' | 'kanban'
  
  // Estados para datos del proyecto
  const [projectSummary, setProjectSummary] = useState(null);
  const [projectMembers, setProjectMembers] = useState([]);
  const [projectHighlights, setProjectHighlights] = useState([]);
  const [projectDetails, setProjectDetails] = useState(null);
  const [recordingSummaries, setRecordingSummaries] = useState([]);
  const [projectDuration, setProjectDuration] = useState(0);

  // Estados para el chat
  const [chats, setChats] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [chatHistory, setChatHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);

  // Estados para adjuntos del proyecto
  const [projectAttachments, setProjectAttachments] = useState([]);
  const [activeAttachments, setActiveAttachments] = useState([]);

  // Estados para RAG de proyecto
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [ragStatuses, setRagStatuses] = useState({}); // { [recId]: null|false|true|'skipped' }
  const [ragTotalChunks, setRagTotalChunks] = useState({}); // { [recId]: number }
  const [lastContextInfo, setLastContextInfo] = useState(null);
  const [maxContextLength, setMaxContextLength] = useState(8000);
  const [ragMode, setRagMode] = useState('auto'); // 'auto' | 'detallado'

  // Estados para adjuntos del contexto del chat
  const [projectContextAttachments, setProjectContextAttachments] = useState([]);
  const [activeProjectAttachments, setActiveProjectAttachments] = useState([]);

  // Estados para selector de modelo de sesión
  const [aiProvider, setAiProvider] = useState('geminifree');
  const [settingsModel, setSettingsModel] = useState('');
  const [sessionModel, setSessionModel] = useState(null);
  const [isVerifyingModel, setIsVerifyingModel] = useState(false);
  const [projectOllamaModels, setProjectOllamaModels] = useState([]);
  const [projectLmStudioModels, setProjectLmStudioModels] = useState([]);
  const [currentModelSupportsVision, setCurrentModelSupportsVision] = useState(false);
  const [ollamaHost, setOllamaHost] = useState('http://localhost:11434');

  // Estados para modales
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [newChatName, setNewChatName] = useState('');
  const [selectedRecordingIds, setSelectedRecordingIds] = useState([]);

  // --- EFFECTS ---
  // Cargar configuración de IA al montar
  useEffect(() => {
    (async () => {
      try {
        const s = await getSettings();
        const provider = s.aiProvider || 'geminifree';
        setAiProvider(provider);
        const host = s.ollamaHost || 'http://localhost:11434';
        setOllamaHost(host);
        
        // Priorizar modelo de chat (ragModel) si existe para Ollama/LM Studio
        const modelByProvider = {
          ollama: s.ollamaRagModel || s.ollamaModel,
          deepseek: s.deepseekModel,
          kimi: s.kimiModel,
          gemini: s.geminiModel,
          geminifree: s.geminiFreeModel,
          lmstudio: s.lmStudioRagModel || s.lmStudioModel,
        };
        const currentModel = modelByProvider[provider] || '';
        setSettingsModel(currentModel);
        
        // Inicializar el modelo de sesión para que el ChatInterface lo muestre correctamente
        if (provider === 'ollama') setSelectedOllamaModel(currentModel);
        if (provider === 'lmstudio') setSelectedLmStudioModel(currentModel);
        
        // Guardar context length
        let ctxLen = 8000;
        if (provider === 'ollama' && s.ollamaContextLength) {
          ctxLen = s.ollamaContextLength;
        } else if (provider === 'lmstudio' && s.lmStudioContextLength) {
          ctxLen = s.lmStudioContextLength;
        } else if (provider === 'gemini' || provider === 'geminifree') {
          ctxLen = 1000000;
        } else if (provider === 'kimi') {
          ctxLen = 32000;
        } else if (provider === 'deepseek') {
          ctxLen = 64000;
        }
        setMaxContextLength(ctxLen);

        // Comprobar soporte de visión para el modelo actual
        const checkVision = async () => {
          const activeModel = sessionModel || currentModel;
          if (activeModel) {
            const supportsVision = await checkModelVisionSupport(activeModel);
            setCurrentModelSupportsVision(supportsVision);
          }
        };
        checkVision();

        if (provider === 'ollama') {
          try {
            const models = await getAvailableModels(host);
            const modelNames = models.map(m => m.name || m);
            setProjectOllamaModels(modelNames.filter(m => !m.toLowerCase().includes('embed')));
          } catch {
            setProjectOllamaModels([]);
          }
        }
        if (provider === 'lmstudio') {
          try {
            const models = await getLMStudioModels();
            const modelNames = models.map(m => m.name || m);
            setProjectLmStudioModels(modelNames);
          } catch {
            setProjectLmStudioModels([]);
          }
        }
      } catch (e) {
        console.error('Error cargando configuración de IA en ProjectDetail:', e);
      }
    })();
  }, []);

  // Cargar datos del proyecto al montar
  useEffect(() => {
    if (project) {
      loadProjectData();
    }
  }, [project]);

  // Cargar chats del proyecto
  useEffect(() => {
    if (project) {
      loadProjectChats();
    }
  }, [project]);

  // Cargar historial del chat activo
  useEffect(() => {
    if (activeChatId && project) {
      loadChatHistory(activeChatId);
    }
  }, [activeChatId, project]);

  // Suscripción a chatPendingService para restaurar estado de carga tras navegación
  useEffect(() => {
    if (!activeChatId) return;
    const pendingKey = `chat_${activeChatId}`;

    const unsubscribe = chatPendingService.subscribe(pendingKey, (pending) => {
      if (pending && pending.status === 'pending') {
        setIsSendingMessage(true);
      } else if (pending && pending.status === 'error') {
        setIsSendingMessage(false);
        loadChatHistory(activeChatId);
        chatPendingService.clearPending(pendingKey);
      } else if (!pending) {
        // Petición completada o no hay ninguna: recargar historial y quitar loading
        setIsSendingMessage(false);
        loadChatHistory(activeChatId);
      }
    });

    return () => unsubscribe();
  }, [activeChatId]);

  // Auto-indexar grabaciones del chat activo cuando cambia el chat seleccionado
  useEffect(() => {
    if (!activeChatId) return;
    const chat = chats.find(c => c.id === activeChatId);
    if (!chat?.contexto?.length) return;

    chat.contexto.forEach(async (recId) => {
      if (ragStatuses[recId] !== undefined) return;

      const statusResult = await ragService.getStatus(recId);
      if (statusResult.indexed) {
        setRagStatuses(prev => ({ ...prev, [recId]: true }));
        setRagTotalChunks(prev => ({ ...prev, [recId]: statusResult.totalChunks || 0 }));
        return;
      }

      // No indexado: lanzar indexación
      setRagStatuses(prev => ({ ...prev, [recId]: false }));
      const result = await ragService.indexRecording(recId);
      if (result.skippedRag) {
        setRagStatuses(prev => ({ ...prev, [recId]: 'skipped' }));
      } else if (result.indexed) {
        setRagStatuses(prev => ({ ...prev, [recId]: true }));
        setRagTotalChunks(prev => ({ ...prev, [recId]: result.totalChunks || 0 }));
      } else {
        setRagStatuses(prev => ({ ...prev, [recId]: null }));
      }
    });
  }, [activeChatId, chats]);

  // Cargar adjuntos del contexto del chat activo
  useEffect(() => {
    if (!activeChatId) {
      setProjectContextAttachments([]);
      return;
    }
    const chat = chats.find(c => c.id === activeChatId);
    if (!chat?.contexto?.length) {
      setProjectContextAttachments([]);
      return;
    }

    const loadAttachments = async () => {
      let allAttachments = [];
      for (const recId of chat.contexto) {
        try {
          const atts = await getAttachments(recId);
          // Decorar los adjuntos con la grabación a la que pertenecen
          const recording = recordingSummaries.find(r => r.id === recId) || { title: `Grabación ${recId}` };
          const decoratedAtts = atts.map(att => ({
            ...att,
            recordingId: recId,
            recordingTitle: recording.title
          }));
          allAttachments = [...allAttachments, ...decoratedAtts];
        } catch (error) {
          console.error(`Error cargando adjuntos para la grabación ${recId}:`, error);
        }
      }
      setProjectContextAttachments(allAttachments);
    };

    loadAttachments();
  }, [activeChatId, chats, recordingSummaries]);

  // --- HANDLERS ---
  const loadProjectTasks = async () => {
    try {
      const tasks = await recordingsService.getProjectTaskSuggestions(project.id);
      setProjectTasks(tasks || []);
    } catch (error) {
      console.error('Error cargando tareas del proyecto:', error);
    }
  };

  const handleUpdateProjectTask = async (updatedTask) => {
    const saved = await recordingsService.updateTaskSuggestion(
      updatedTask.id, updatedTask.title, updatedTask.content,
      updatedTask.layer || 'general', updatedTask.status || 'backlog'
    );
    if (saved) {
      setProjectTasks(prev => prev.map(t => t.id === saved.id ? { ...t, ...saved } : t));
    }
  };

  const handleDeleteProjectTask = async (taskId) => {
    const ok = await recordingsService.deleteTaskSuggestion(taskId);
    if (ok) {
      setProjectTasks(prev => prev.filter(t => t.id !== taskId));
    }
  };

  const handleBulkDeleteProjectTasks = async (ids) => {
    await Promise.all(ids.map(id => recordingsService.deleteTaskSuggestion(id)));
    setProjectTasks(prev => prev.filter(t => !ids.includes(t.id)));
  };

  const handleGetProjectTaskComments = (taskId) => recordingsService.getTaskComments(taskId);
  const handleAddProjectTaskComment = (taskId, content) => recordingsService.addTaskComment(taskId, content);
  const handleDeleteProjectTaskComment = (commentId) => recordingsService.deleteTaskComment(commentId);

  const handleCreateProjectTask = async ({ title, content, layer, status = 'backlog' }) => {
    const saved = await recordingsService.createProjectTask(project.id, title, content, layer, status);
    if (saved) setProjectTasks(prev => [...prev, saved]);
  };

  // Reordenar tareas dentro de una columna del Kanban
  // updates: [{ id, sort_order }]
  const handleUpdateProjectTasksOrder = async (updates) => {
    await recordingsService.updateTasksSortOrder(updates);
    const updatesMap = Object.fromEntries(updates.map(u => [u.id, u.sort_order]));
    setProjectTasks(prev =>
      prev
        .map(t => updatesMap[t.id] !== undefined ? { ...t, sort_order: updatesMap[t.id] } : t)
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    );
  };

  const loadProjectData = async () => {
    setIsLoading(true);
    try {
      const [summary, members, highlights, details, recordings, duration, tasks] = await Promise.all([
        projectAiService.getProjectSummary(project.id),
        projectAiService.getProjectMembers(project.id),
        projectAiService.getProjectHighlights(project.id),
        projectAiService.getProjectDetails(project.id),
        projectAiService.getProjectRecordingSummaries(project.id),
        projectsService.getProjectTotalDuration(project.id),
        recordingsService.getProjectTaskSuggestions(project.id)
      ]);

      // Cargar adjuntos de todas las grabaciones del proyecto
      let allAttachments = [];
      if (recordings && recordings.length > 0) {
        const attachmentsPromises = recordings.map(async (rec) => {
          const atts = await getAttachments(rec.id);
          return atts.map(a => ({ ...a, recordingId: rec.id, recordingName: rec.title }));
        });
        const nestedAtts = await Promise.all(attachmentsPromises);
        allAttachments = nestedAtts.flat();
      }

      setProjectSummary(summary);
      setProjectMembers(members);
      setProjectHighlights(highlights);
      setProjectDetails(details);
      setRecordingSummaries(recordings);
      setProjectDuration(duration);
      setProjectTasks(tasks || []);
      setProjectAttachments(allAttachments);
    } catch (error) {
      console.error('Error cargando datos del proyecto:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadProjectChats = async () => {
    try {
      const chatsList = await projectChatService.getProjectChats(project.id);
      setChats(chatsList);

      // Seleccionar el primer chat como activo
      if (chatsList.length > 0) {
        setActiveChatId(chatsList[0].id);
      }
    } catch (error) {
      console.error('Error cargando chats del proyecto:', error);
    }
  };

  const loadChatHistory = async (chatId) => {
    try {
      const history = await projectChatService.getProjectChatHistory(project.id, chatId);
      setChatHistory(history);
    } catch (error) {
      console.error('Error cargando historial del chat:', error);
    }
  };

  const handleChatSelect = (chatId) => {
    setActiveChatId(chatId);
  };

  const handleNewChat = () => {
    setSelectedRecordingIds(recordingSummaries.map(r => r.id)); // Por defecto todas seleccionadas
    setShowNewChatModal(true);
  };

  const handleToggleRecordingSelection = (id) => {
    setSelectedRecordingIds(prev => 
      prev.includes(id) ? prev.filter(rid => rid !== id) : [...prev, id]
    );
  };

  const handleCreateNewChat = async () => {
    if (!newChatName.trim()) return;

    try {
      const newChat = await projectChatService.createProjectChat(
        project.id, 
        newChatName.trim(), 
        selectedRecordingIds
      );
      setChats(prev => [...prev, newChat]);
      setActiveChatId(newChat.id);
      setNewChatName('');
      setSelectedRecordingIds([]);
      setShowNewChatModal(false);
    } catch (error) {
      console.error('Error creando nuevo chat:', error);
    }
  };

  const handleDeleteChat = async (chatId) => {
    try {
      await projectChatService.deleteProjectChat(project.id, chatId);
      setChats(prev => prev.filter(chat => chat.id !== chatId));

      // Si se eliminó el chat activo, seleccionar otro
      if (activeChatId === chatId) {
        const remainingChats = chats.filter(chat => chat.id !== chatId);
        setActiveChatId(remainingChats.length > 0 ? remainingChats[0].id : null);
      }
    } catch (error) {
      console.error('Error eliminando chat:', error);
    }
  };

  const handleUpdateMembers = async (newMembers) => {
    try {
      await projectAiService.updateProjectMembers(project.id, newMembers);
      setProjectMembers(newMembers);
    } catch (error) {
      console.error('Error actualizando miembros:', error);
    }
  };

  const handleAddMember = async (member) => {
    const newMember = {
      ...member,
      id: Date.now(),
      avatar_color: '#3994EF'
    };
    const updated = [...projectMembers, newMember];
    await handleUpdateMembers(updated);
  };

  const handleRemoveMember = async (id) => {
    if (window.confirm('¿Estás seguro de eliminar este miembro?')) {
      const updated = projectMembers.filter(m => m.id !== id);
      await handleUpdateMembers(updated);
    }
  };

  const handleUpdateMember = async (id, data) => {
    const updated = projectMembers.map(m => 
      m.id === id ? { ...m, ...data } : m
    );
    await handleUpdateMembers(updated);
  };

  const handleUpdateHighlights = async (newHighlights) => {
    try {
      await projectAiService.updateProjectHighlights(project.id, newHighlights);
      setProjectHighlights(newHighlights);
    } catch (error) {
      console.error('Error actualizando aspectos destacados:', error);
    }
  };

  const handleRegenerateProjectSummary = async () => {
    setIsRegenerating(true);
    try {
      await projectAiService.regenerateAnalysis(project.id);
      await loadProjectData();
    } catch (error) {
      console.error('Error regenerando análisis:', error);
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleSessionModelChange = async (model) => {
    setSessionModel(model);

    // Comprobar soporte de visión para el nuevo modelo seleccionado
    checkModelVisionSupport(model).then(supportsVision => {
      setCurrentModelSupportsVision(supportsVision);
    });

    // Para Ollama y LM Studio: el modelo elegido en el chat se guarda como "Modelo de Chat"
    // (ollamaRagModel / lmStudioRagModel), sin tocar el Modelo General.
    try {
      const settingsUpdate = {};
      if (aiProvider === 'ollama') settingsUpdate.ollamaRagModel = model;
      else if (aiProvider === 'lmstudio') settingsUpdate.lmStudioRagModel = model;
      else if (aiProvider === 'deepseek') settingsUpdate.deepseekModel = model;
      else if (aiProvider === 'kimi') settingsUpdate.kimiModel = model;
      else if (aiProvider === 'gemini') settingsUpdate.geminiModel = model;
      else if (aiProvider === 'geminifree') settingsUpdate.geminiFreeModel = model;
      
      if (Object.keys(settingsUpdate).length > 0) {
        await updateSettings(settingsUpdate);
      }
    } catch (err) {
      console.error("Error saving model to settings:", err);
    }

    if (aiProvider === 'ollama') {
      setIsVerifyingModel(true);
      try {
        const ok = await checkModelSupportsStreaming(model, ollamaHost);
        console.log(`[ProjectDetail] Modelo de chat ${model} soporta streaming: ${ok}`);
        await updateSettings({ ollamaModelSupportsStreaming: ok });
      } catch {
        // ignorar
      } finally {
        setIsVerifyingModel(false);
      }
    }
  };

  const handleResetChat = async () => {
    if (!activeChatId) return;
    if (!window.confirm('¿Borrar todo el historial de este chat? Esta acción no se puede deshacer.')) return;
    try {
      await projectChatService.clearChatHistory(activeChatId);
      setChatHistory([]);
      setLastContextInfo(null);
    } catch (error) {
      console.error('Error reiniciando chat:', error);
    }
  };

  const handleReIndexRAG = async () => {
    const chat = chats.find(c => c.id === activeChatId);
    if (!chat?.contexto?.length) return;
    const recordingIds = chat.contexto;

    // Marcar todas como indexando
    const indexingState = {};
    recordingIds.forEach(id => { indexingState[id] = false; });
    setRagStatuses(prev => ({ ...prev, ...indexingState }));

    for (const recId of recordingIds) {
      await ragService.deleteIndex(recId);
      const result = await ragService.indexRecording(recId);
      if (result.skippedRag) {
        setRagStatuses(prev => ({ ...prev, [recId]: 'skipped' }));
      } else if (result.indexed) {
        setRagStatuses(prev => ({ ...prev, [recId]: true }));
        setRagTotalChunks(prev => ({ ...prev, [recId]: result.totalChunks || 0 }));
      } else {
        setRagStatuses(prev => ({ ...prev, [recId]: null }));
      }
    }
  };

  const handleProjectAttachmentsChange = (newAttachments) => {
    setProjectAttachments(newAttachments);
    
    // En proyectos, la clave única es recordingId + filename
    setActiveAttachments(prev => prev.filter(att => 
      newAttachments.some(na => na.recordingId === att.recordingId && na.filename === att.filename)
    ));
  };

  const handleSendMessage = async (messageText, attachmentsToUse = []) => {
    if (!messageText.trim() || !activeChatId || isSendingMessage) return;

    const trimmedMessage = messageText.trim();
    const tempId = Date.now().toString();

    // 1. Añadir optimísticamente el mensaje del usuario al estado local (V2)
    const tempUserMessage = {
      id: `temp_u_${tempId}`,
      tipo: 'usuario',
      contenido: trimmedMessage,
      fecha: new Date().toISOString(),
      chatVersion: 2,
      adjuntos: attachmentsToUse.map(a => ({ filename: a.filename, type: a.type }))
    };

    setChatHistory(prev => [...prev, tempUserMessage]);
    setIsSendingMessage(true);

    // Registrar petición pendiente
    const pendingKey = `chat_${activeChatId}`;
    chatPendingService.setPending(pendingKey, trimmedMessage);

    try {
      // 2. Guardar mensaje del usuario en DB
      await projectChatService.saveProjectChatMessage(project.id, activeChatId, {
        tipo: 'usuario',
        contenido: trimmedMessage,
        chatVersion: 2,
        adjuntos: attachmentsToUse.map(a => ({ filename: a.filename, type: a.type }))
      });

      // 3. Generar respuesta de la IA con streaming nativo (V2)
      // Extraer contenido de adjuntos para pasarlo al servicio
      let extraContext = '';
      const attachmentImages = [];
      
      for (const att of attachmentsToUse) {
        try {
          const content = await window.electronAPI.readAttachmentContent(att.recordingId, att.filename);
          if (!content || !content.success) continue;
          if (content.type === 'image') {
            attachmentImages.push({ base64: content.data, mimeType: content.mimeType });
          } else if (content.type === 'text') {
            extraContext += `\n\n--- ADJUNTO: ${att.filename} ---\n${content.data}\n--- FIN ADJUNTO ---`;
          }
        } catch (err) {
          console.warn(`Error leyendo adjunto ${att.filename}:`, err);
        }
      }

      const sessionOptions = { 
        model: sessionModel || undefined,
        images: attachmentImages.length > 0 ? attachmentImages : undefined,
        extraContext: extraContext || undefined
      };
      
      let streamingAnswer = '';

      const { text: aiResponse, contextInfo } = await projectChatService.generateAiResponse(
        project.id, trimmedMessage, activeChatId, chatHistory, ragMode, sessionOptions,
        (chunk) => {
          streamingAnswer += chunk;
          // Actualizar el mensaje de streaming en tiempo real
          setChatHistory(prev => {
            const withoutStreaming = prev.filter(m => m.id !== `streaming_${tempId}`);
            return [...withoutStreaming, {
              id: `streaming_${tempId}`,
              tipo: 'asistente',
              contenido: streamingAnswer,
              fecha: new Date().toISOString(),
              chatVersion: 2,
            }];
          });
        }
      );
      setLastContextInfo(contextInfo || null);

      // 4. Guardar respuesta de la IA en DB
      await projectChatService.saveProjectChatMessage(project.id, activeChatId, {
        tipo: 'asistente',
        contenido: aiResponse,
        chatVersion: 2,
      });

      // 5. Recargar historial real para sincronizar IDs y fechas (reemplaza el mensaje de streaming)
      await loadChatHistory(activeChatId);

      chatPendingService.clearPending(pendingKey);
    } catch (error) {
      console.error('Error enviando mensaje:', error);
      chatPendingService.setError(pendingKey, error.message);
    } finally {
      setIsSendingMessage(false);
    }
  };

  const formatDuration = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  };


  if (isLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          <div className={styles.spinner}></div>
          <p>Cargando proyecto...</p>
        </div>
      </div>
    );
  }

  const activeChat = chats.find(c => c.id === activeChatId);

  // Cómputo agregado del estado RAG para el chat activo
  const activeChatRecordingIds = activeChat?.contexto || [];
  const isAnyIndexing = activeChatRecordingIds.some(id => ragStatuses[id] === false);
  const allRagKnown = activeChatRecordingIds.length > 0 && activeChatRecordingIds.every(id => ragStatuses[id] !== undefined);
  const someRagIndexed = activeChatRecordingIds.some(id => ragStatuses[id] === true);
  const totalRagChunksCount = activeChatRecordingIds.reduce((s, id) => s + (ragTotalChunks[id] || 0), 0);
  const aggregateRagIndexed = isAnyIndexing ? false : (allRagKnown ? (someRagIndexed ? true : 'skipped') : null);
  const activeChatAttachments = projectAttachments.filter(a => activeChatRecordingIds.includes(a.recordingId));

  return (
    <div className={styles.container}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <button onClick={onBack} className={styles.backButton}>
            <MdArrowBack size={24} />
          </button>
          <div>
            <h1 className={styles.projectTitle}>
              Resumen del Proyecto: {project?.name || 'Proyecto'}
            </h1>
          </div>
        </div>
        <div className={styles.headerRight}>
        </div>
      </header>

      {/* Tabs Navigation */}
      <nav className={styles.tabsNav}>
        <button
          className={`${styles.tabButton} ${activeTab === 'overview' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          Vista General
        </button>
        <button
          className={`${styles.tabButton} ${activeTab === 'chat' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('chat')}
        >
          Chat con IA
        </button>
        <button
          className={`${styles.tabButton} ${activeTab === 'tasks' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('tasks')}
        >
          Tareas
          {projectTasks.length > 0 && (
            <span className={styles.tabBadge}>{projectTasks.length}</span>
          )}
        </button>
        <button
          className={`${styles.tabButton} ${activeTab === 'attachments' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('attachments')}
        >
          Adjuntos
          {projectAttachments.length > 0 && (
            <span className={styles.tabBadge}>{projectAttachments.length}</span>
          )}
        </button>
      </nav>

      {/* Main Content */}
      <div className={styles.mainContent}>
        {activeTab === 'tasks' ? (
          <div className={styles.tasksContent}>
            {/* Toggle lista / kanban */}
            <div className={styles.tasksViewToggle}>
              <button
                className={`${styles.viewToggleBtn} ${tasksView === 'list' ? styles.viewToggleActive : ''}`}
                onClick={() => setTasksView('list')}
                title="Vista lista"
              >
                <MdFormatListBulleted size={16} />
              </button>
              <button
                className={`${styles.viewToggleBtn} ${tasksView === 'kanban' ? styles.viewToggleActive : ''}`}
                onClick={() => setTasksView('kanban')}
                title="Vista tablero"
              >
                <MdGridView size={16} />
              </button>
            </div>

            {tasksView === 'list' ? (
              <EpicsTab
                tasks={projectTasks}
                isGenerating={false}
                hasTranscription={false}
                onGenerateMore={null}
                onCreateTask={handleCreateProjectTask}
                onUpdateTask={handleUpdateProjectTask}
                onImproveTask={null}
                onDeleteTask={handleDeleteProjectTask}
                onBulkDeleteTasks={handleBulkDeleteProjectTasks}
                improvingTaskId={null}
                newTaskIds={null}
                recordingMap={Object.fromEntries((recordingSummaries || []).map(r => [r.id, { id: r.id, title: r.title }]))}
                onNavigateToRecording={(recordingId) => props.onNavigateToRecording?.(recordingId)}
                getTaskComments={handleGetProjectTaskComments}
                onAddComment={handleAddProjectTaskComment}
                onDeleteComment={handleDeleteProjectTaskComment}
                projectEmptyHint="Abre una transcripción del proyecto, genera tareas con IA y pulsa «Agregar» para incorporarlas aquí, o crea tareas manualmente desde este mismo proyecto."
              />
            ) : (
              <ProjectKanbanBoard
                tasks={projectTasks}
                recordingMap={Object.fromEntries((recordingSummaries || []).map(r => [r.id, { id: r.id, title: r.title }]))}
                onUpdateTask={handleUpdateProjectTask}
                onDeleteTask={handleDeleteProjectTask}
                onNavigateToRecording={(recordingId) => props.onNavigateToRecording?.(recordingId)}
                getTaskComments={handleGetProjectTaskComments}
                onAddComment={handleAddProjectTaskComment}
                onDeleteComment={handleDeleteProjectTaskComment}
                onCreateTask={handleCreateProjectTask}
                onUpdateTasksOrder={handleUpdateProjectTasksOrder}
                projectEmptyHint="Abre una transcripción del proyecto, genera tareas con IA y pulsa «Agregar» para incorporarlas aquí, o crea tareas manualmente desde este mismo proyecto."
              />
            )}
          </div>
        ) : activeTab === 'attachments' ? (
          <div className={styles.attachmentsContent}>
            <ProjectAttachmentsTab 
              recordings={recordingSummaries}
              attachments={projectAttachments} 
              onAttachmentsChange={handleProjectAttachmentsChange}
            />
          </div>
        ) : activeTab === 'overview' ? (
          <div className={styles.overviewGrid}>
            {/* Columna Izquierda - Resumen y Grabaciones */}
            <div className={styles.leftColumn}>
              {/* Resumen del Proyecto */}
              <div className={styles.section}>
                <div className={styles.sectionTitleRow}>
                  <h2 className={styles.sectionTitle}>Resumen del Proyecto</h2>
                  <button
                    onClick={handleRegenerateProjectSummary}
                    disabled={isRegenerating}
                    className={styles.regenerateButton}
                    title="Regenerar resumen con IA"
                  >
                    <MdRefresh size={16} className={isRegenerating ? styles.spinning : ''} />
                    {isRegenerating ? 'Regenerando...' : 'Regenerar'}
                  </button>
                </div>
                <p className={styles.projectSummary}>
                  {projectSummary?.resumen_breve || 'Cargando resumen del proyecto...'}
                </p>
              </div>

              {/* Highlights de las Últimas 2 Reuniones */}
              {recordingSummaries.length > 0 && (() => {
                const lastTwoRecordings = recordingSummaries.slice(0, 2);

                const recordingsWithHighlights = lastTwoRecordings.filter(rec =>
                  rec.summary?.ideas && rec.summary.ideas.length > 0
                );

                if (recordingsWithHighlights.length === 0) return null;

                return (
                  <div className={styles.section}>
                    <h2 className={styles.sectionTitle}>Highlights de las Últimas 2 Reuniones</h2>
                    <div className={styles.recentHighlights}>
                      {recordingsWithHighlights.map((recording, idx) => {
                        const highlights = recording.summary.ideas;

                        return (
                          <div key={recording.id} className={styles.highlightGroup}>
                            <h4 className={styles.highlightRecordingTitle}>
                              Reunión {idx + 1}: {recording.title}
                            </h4>
                            <ul className={styles.highlightList}>
                              {highlights.map((highlight, highlightIdx) => (
                                <li key={highlightIdx} className={styles.highlightItem}>
                                  <ReactMarkdown>{highlight}</ReactMarkdown>
                                </li>
                              ))}
                            </ul>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* Resúmenes de Grabaciones */}
              <div className={styles.section}>
                <h2 className={styles.sectionTitle}>Grabaciones</h2>
                <ProjectRecordingSummaries
                  recordings={recordingSummaries}
                  onNavigateToRecording={(recordingId) => {
                    if (props.onNavigateToRecording) {
                      props.onNavigateToRecording(recordingId);
                    }
                  }}
                />
              </div>
            </div>

            {/* Columna Derecha - Detalles, Timeline, Miembros */}
            <div className={styles.rightColumn}>
              {/* Detalles del Proyecto */}
              <div className={styles.section}>
                <h3 className={styles.sectionTitle}>Detalles del Proyecto</h3>
                {projectDetails && (
                  <div className={styles.detailsList}>
                    <div className={styles.detailItem}>
                      <span className={styles.detailLabel}>Fecha de Inicio</span>
                      <span className={styles.detailValue}>{projectDetails.fecha_inicio}</span>
                    </div>
                    <div className={styles.detailItem}>
                      <span className={styles.detailLabel}>Duración Actual</span>
                      <span className={styles.detailValue}>{formatDuration(projectDuration)}</span>
                    </div>
                    <div className={styles.detailItem}>
                      <span className={styles.detailLabel}>Grabaciones Analizadas</span>
                      <span className={styles.detailValue}>
                        {projectDetails.grabaciones_analizadas}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Aspectos Destacados */}
              <div className={styles.section}>
                <ProjectTimeline 
                  highlights={projectHighlights} 
                  onUpdateHighlights={handleUpdateHighlights}
                />
              </div>

              {/* Miembros del Equipo */}
              <div className={styles.section}>
                <ParticipantsList 
                  title="Miembros del Equipo"
                  participants={projectMembers} 
                  onAddParticipant={handleAddMember}
                  onRemoveParticipant={handleRemoveMember}
                  onUpdateParticipant={handleUpdateMember}
                />
              </div>
            </div>
          </div>
        ) : (
          <div className={styles.chatGrid}>
            {/* Chat Principal */}
            <div className={styles.chatMain}>
              {activeChatRecordingIds.length > 0 && (
                <ContextBar
                  contextInfo={lastContextInfo}
                  maxContextLength={maxContextLength}
                  ragIndexed={aggregateRagIndexed}
                  ragTotalChunks={totalRagChunksCount}
                  ragMode={ragMode}
                  onRagModeChange={setRagMode}
                  isProject={true}
                />
              )}
              <div className={styles.chatInterfaceWrapper}>
                <ChatInterface
                  chatHistory={chatHistory}
                  onSendMessage={handleSendMessage}
                  isLoading={isSendingMessage || isAnyIndexing}
                  placeholder={isAnyIndexing ? 'Indexando grabaciones...' : 'Haz una pregunta sobre el proyecto...'}
                  title={activeChat ? `Chat: ${activeChat.nombre}` : "Chat del Proyecto"}
                  onResetChat={handleResetChat}
                  onNavigateToRecording={(recordingId, timestamp) => {
                    if (props.onNavigateToRecording) {
                      props.onNavigateToRecording(recordingId, timestamp);
                    }
                  }}
                  currentModel={sessionModel || settingsModel}
                  availableModels={
                    aiProvider === 'ollama'   ? projectOllamaModels.map(m => ({ value: m, label: m })) :
                    aiProvider === 'lmstudio' ? projectLmStudioModels.map(m => ({ value: m, label: m })) :
                    aiProvider === 'deepseek' ? DEEPSEEK_CHAT_MODELS :
                    aiProvider === 'kimi'     ? KIMI_CHAT_MODELS :
                    []
                  }
                  onModelChange={handleSessionModelChange}
                  isVerifyingModel={isVerifyingModel}
                  modelSupportsVision={currentModelSupportsVision}
                  allowNewAttachments={false}
                  recordAttachments={projectContextAttachments}
                  activeAttachments={activeProjectAttachments}
                  onActiveAttachmentsChange={setActiveProjectAttachments}
                />
              </div>
              {activeChat?.contexto && activeChat.contexto.length > 0 && (
                <div className={styles.chatContextInfo}>
                  <div className={styles.chatContextHeader}>
                    <button
                      className={styles.chatContextTitle}
                      onClick={() => setIsContextExpanded(!isContextExpanded)}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 256 256">
                        <path d="M200,64V168a8,8,0,0,1-16,0V83.31L69.66,197.66a8,8,0,0,1-11.32-11.32L172.69,72H88a8,8,0,0,1,0-16H192A8,8,0,0,1,200,64Z"></path>
                      </svg>
                      <span>Contexto del Chat ({activeChat.contexto.length} grabaciones)</span>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="12"
                        height="12"
                        fill="currentColor"
                        viewBox="0 0 256 256"
                        className={`${styles.contextChevron} ${isContextExpanded ? styles.expanded : ''}`}
                      >
                        <path d="M213.66,101.66l-80,80a8,8,0,0,1-11.32,0l-80-80a8,8,0,0,1,11.32-11.32L128,164.69l74.34-74.35a8,8,0,0,1,11.32,11.32Z"></path>
                      </svg>
                    </button>
                    <button
                      className={styles.reindexButton}
                      onClick={handleReIndexRAG}
                      disabled={isAnyIndexing}
                      title="Re-indexar todas las grabaciones del contexto"
                    >
                      <MdRefresh size={13} className={isAnyIndexing ? styles.spinning : ''} />
                      Re-indexar
                    </button>
                  </div>
                  {isContextExpanded && (
                    <div className={styles.chatContextList}>
                      {activeChat.contexto.map(recId => {
                        const recording = recordingSummaries.find(r => r.id === recId);
                        if (!recording) return null;
                        
                        return (
                          <div key={recId} className={styles.chatContextItem}>
                            <span className={styles.chatContextItemName}>• {recording.title || `Grabación ${recId}`}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Panel de Historial de Chats */}
            <div className={styles.rightColumn}>
              <ProjectChatPanel
                chats={chats}
                activeChatId={activeChatId}
                onChatSelect={handleChatSelect}
                onNewChat={handleNewChat}
                onDeleteChat={handleDeleteChat}
              />
            </div>
          </div>
        )}
      </div>

      {/* Modal para nuevo chat */}
      {showNewChatModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <h3 className={styles.modalTitle}>Nuevo Chat</h3>
            <div className={styles.modalContent}>
              <input
                type="text"
                value={newChatName}
                onChange={(e) => setNewChatName(e.target.value)}
                placeholder="Nombre del chat..."
                className={styles.modalInput}
                autoFocus
              />
              
              <span className={styles.modalSubtitle}>Contexto del chat:</span>
              <div className={styles.recordingSelector}>
                {[...recordingSummaries].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0)).map(rec => (
                  <label key={rec.id} className={styles.recordingOption}>
                    <input 
                      type="checkbox"
                      checked={selectedRecordingIds.includes(rec.id)}
                      onChange={() => handleToggleRecordingSelection(rec.id)}
                    />
                    <span className={styles.recordingOptionLabel}>
                      {rec.title || `Grabación ${rec.id}`}
                      {rec.date && (
                        <span className={styles.recordingOptionDate}>
                          {new Date(rec.date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </span>
                      )}
                    </span>
                  </label>
                ))}
              </div>
            </div>
            <div className={styles.modalActions}>
              <button
                onClick={() => {
                  setShowNewChatModal(false);
                  setNewChatName('');
                }}
                className={styles.modalCancelButton}
              >
                Cancelar
              </button>
              <button
                onClick={handleCreateNewChat}
                disabled={!newChatName.trim() || selectedRecordingIds.length === 0}
                className={styles.modalConfirmButton}
              >
                Crear Chat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
