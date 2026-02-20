import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import styles from './ProjectDetail.module.css';
import projectAiService from '../../services/projectAiService';
import projectChatService from '../../services/projectChatService';
import projectsService from '../../services/projectsService';
import ProjectChatPanel from '../../components/ProjectChatPanel/ProjectChatPanel';
import ProjectTimeline from '../../components/ProjectTimeline/ProjectTimeline';
import ParticipantsList from '../../components/ParticipantsList/ParticipantsList';
import ProjectRecordingSummaries from '../../components/ProjectRecordingSummaries/ProjectRecordingSummaries';
import ChatInterface from '../../components/ChatInterface/ChatInterface';
import { MdArrowBack, MdRefresh } from 'react-icons/md';
import ragService from '../../services/ragService';
import ContextBar from '../../components/ContextBar/ContextBar';
import { getSettings } from '../../services/settingsService';
import { getAvailableModels, checkModelSupportsStreaming } from '../../services/ai/ollamaProvider';

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
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'chat'
  const [isContextExpanded, setIsContextExpanded] = useState(false);
  
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

  // Estados para RAG de proyecto
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [ragStatuses, setRagStatuses] = useState({}); // { [recId]: null|false|true|'skipped' }
  const [ragTotalChunks, setRagTotalChunks] = useState({}); // { [recId]: number }
  const [lastContextInfo, setLastContextInfo] = useState(null);
  const [ragMode, setRagMode] = useState('auto'); // 'auto' | 'detallado'

  // Estados para selector de modelo de sesión
  const [aiProvider, setAiProvider] = useState('geminifree');
  const [settingsModel, setSettingsModel] = useState('');
  const [sessionModel, setSessionModel] = useState(null);
  const [isVerifyingModel, setIsVerifyingModel] = useState(false);
  const [projectOllamaModels, setProjectOllamaModels] = useState([]);
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
        const modelByProvider = {
          ollama: s.ollamaModel,
          deepseek: s.deepseekModel,
          kimi: s.kimiModel,
          gemini: s.geminiModel,
          geminifree: s.geminiFreeModel,
          lmstudio: s.lmStudioModel,
        };
        setSettingsModel(modelByProvider[provider] || '');
        if (provider === 'ollama') {
          try {
            const models = await getAvailableModels(host);
            const modelNames = models.map(m => m.name || m);
            setProjectOllamaModels(modelNames.filter(m => !m.toLowerCase().includes('embed')));
          } catch {
            setProjectOllamaModels([]);
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

  // --- HANDLERS ---
  const loadProjectData = async () => {
    setIsLoading(true);
    try {
      const [summary, members, highlights, details, recordings, duration] = await Promise.all([
        projectAiService.getProjectSummary(project.id),
        projectAiService.getProjectMembers(project.id),
        projectAiService.getProjectHighlights(project.id),
        projectAiService.getProjectDetails(project.id),
        projectAiService.getProjectRecordingSummaries(project.id),
        projectsService.getProjectTotalDuration(project.id)
      ]);

      setProjectSummary(summary);
      setProjectMembers(members);
      setProjectHighlights(highlights);
      setProjectDetails(details);
      setRecordingSummaries(recordings);
      setProjectDuration(duration);
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
    if (aiProvider === 'ollama') {
      setIsVerifyingModel(true);
      try {
        const ok = await checkModelSupportsStreaming(model, ollamaHost);
        // En el chat de proyecto no usamos streaming directo, pero actualizamos el estado
        console.log(`[ProjectDetail] Modelo ${model} soporta streaming: ${ok}`);
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

  const handleSendMessage = async (messageText) => {
    if (!messageText.trim() || !activeChatId || isSendingMessage) return;

    const trimmedMessage = messageText.trim();
    
    // 1. Añadir optimísticamente el mensaje del usuario al estado local
    const tempUserMessage = {
      id: `temp_u_${Date.now()}`,
      tipo: 'usuario',
      contenido: trimmedMessage,
      fecha: new Date().toISOString()
    };
    
    setChatHistory(prev => [...prev, tempUserMessage]);
    setIsSendingMessage(true);

    try {
      // 2. Guardar mensaje del usuario en DB
      await projectChatService.saveProjectChatMessage(project.id, activeChatId, {
        tipo: 'usuario',
        contenido: trimmedMessage
      });

      // 3. Generar respuesta de la IA
      const sessionOptions = { model: sessionModel || undefined };
      const { text: aiResponse, contextInfo } = await projectChatService.generateAiResponse(
        project.id, trimmedMessage, activeChatId, chatHistory, ragMode, sessionOptions
      );
      setLastContextInfo(contextInfo || null);

      // 4. Guardar respuesta de la IA en DB
      await projectChatService.saveProjectChatMessage(project.id, activeChatId, {
        tipo: 'asistente',
        contenido: aiResponse
      });

      // 5. Recargar historial real para sincronizar IDs y fechas
      await loadChatHistory(activeChatId);
    } catch (error) {
      console.error('Error enviando mensaje:', error);
      // Opcional: añadir mensaje de error al chat o revertir optimismo
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
      </nav>

      {/* Main Content */}
      <div className={styles.mainContent}>
        {activeTab === 'overview' ? (
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
                  ragIndexed={aggregateRagIndexed}
                  ragTotalChunks={totalRagChunksCount}
                  ragMode={ragMode}
                  onRagModeChange={setRagMode}
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
                    aiProvider === 'deepseek' ? DEEPSEEK_CHAT_MODELS :
                    aiProvider === 'kimi'     ? KIMI_CHAT_MODELS :
                    []
                  }
                  onModelChange={handleSessionModelChange}
                  isVerifyingModel={isVerifyingModel}
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
