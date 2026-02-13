import React, { useState, useEffect } from 'react';
import styles from './ProjectDetail.module.css';
import projectAiService from '../../services/projectAiService';
import projectChatService from '../../services/projectChatService';
import projectsService from '../../services/projectsService';
import ProjectChatPanel from '../../components/ProjectChatPanel/ProjectChatPanel';
import ProjectTimeline from '../../components/ProjectTimeline/ProjectTimeline';
import ParticipantsList from '../../components/ParticipantsList/ParticipantsList';
import ProjectRecordingSummaries from '../../components/ProjectRecordingSummaries/ProjectRecordingSummaries';
import ChatInterface from '../../components/ChatInterface/ChatInterface';

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

  // Estados para modales
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [newChatName, setNewChatName] = useState('');
  const [selectedRecordingIds, setSelectedRecordingIds] = useState([]);

  // --- EFFECTS ---
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
      const aiResponse = await projectChatService.generateAiResponse(project.id, trimmedMessage, activeChatId);

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

  return (
    <div className={styles.container}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <button onClick={onBack} className={styles.backButton}>
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 256 256">
              <path d="M224,128a8,8,0,0,1-8,8H40a8,8,0,0,1,0-16H216A8,8,0,0,1,224,128ZM40,72H216a8,8,0,0,0,0-16H40a8,8,0,0,0,0,16ZM216,184H40a8,8,0,0,0,0,16H216a8,8,0,0,0,0-16Z"></path>
            </svg>
          </button>
          <div>
            <h1 className={styles.projectTitle}>
              Resumen del Proyecto: {project?.name || 'Proyecto'}
            </h1>
          </div>
        </div>
        <div className={styles.headerRight}>
          <button onClick={onBack} className={styles.volverButton}>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 256 256">
              <path d="M224,128a8,8,0,0,1-8,8H59.31l58.35,58.34a8,8,0,0,1-11.32,11.32l-72-72a8,8,0,0,1,0-11.32l72-72a8,8,0,0,1,11.32,11.32L59.31,120H216A8,8,0,0,1,224,128Z"></path>
            </svg>
            Volver
          </button>
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
                <h2 className={styles.sectionTitle}>Resumen del Proyecto</h2>
                <p className={styles.projectSummary}>
                  {projectSummary?.resumen_breve || 'Cargando resumen del proyecto...'}
                </p>
              </div>

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
              <div className={styles.chatInterfaceWrapper}>
                <ChatInterface
                  chatHistory={chatHistory}
                  onSendMessage={handleSendMessage}
                  isLoading={isSendingMessage}
                  placeholder="Haz una pregunta sobre el proyecto..."
                  title={activeChat ? `Chat: ${activeChat.nombre}` : "Chat del Proyecto"}
                  onNavigateToRecording={(recordingId, timestamp) => {
                    if (props.onNavigateToRecording) {
                      props.onNavigateToRecording(recordingId, timestamp);
                    }
                  }}
                />
              </div>
              {activeChat?.contexto && activeChat.contexto.length > 0 && (
                <div className={styles.chatContextInfo}>
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
                {recordingSummaries.map(rec => (
                  <label key={rec.id} className={styles.recordingOption}>
                    <input 
                      type="checkbox"
                      checked={selectedRecordingIds.includes(rec.id)}
                      onChange={() => handleToggleRecordingSelection(rec.id)}
                    />
                    <span className={styles.recordingOptionLabel}>
                      {rec.title || `Grabación ${rec.id}`}
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
