import React, { useState, useEffect } from 'react';
import styles from './ProjectDetail.module.css';
import projectAiService from '../../services/projectAiService';
import projectChatService from '../../services/projectChatService';
import ProjectChatPanel from '../../components/ProjectChatPanel/ProjectChatPanel';
import ProjectTimeline from '../../components/ProjectTimeline/ProjectTimeline';
import MembersList from '../../components/MembersList/MembersList';
import ChatInterface from '../../components/ChatInterface/ChatInterface';

export default function ProjectDetail({ project, onBack }) {
  // Estados para datos del proyecto
  const [projectSummary, setProjectSummary] = useState(null);
  const [projectMembers, setProjectMembers] = useState([]);
  const [projectHighlights, setProjectHighlights] = useState([]);
  const [projectDetails, setProjectDetails] = useState(null);
  
  // Estados para el chat
  const [chats, setChats] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [chatHistory, setChatHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  
  // Estados para modales
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [newChatName, setNewChatName] = useState('');

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

  const loadProjectData = async () => {
    setIsLoading(true);
    try {
      const [summary, members, highlights, details] = await Promise.all([
        projectAiService.getProjectSummary(project.id),
        projectAiService.getProjectMembers(project.id),
        projectAiService.getProjectHighlights(project.id),
        projectAiService.getProjectDetails(project.id)
      ]);
      
      setProjectSummary(summary);
      setProjectMembers(members);
      setProjectHighlights(highlights);
      setProjectDetails(details);
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
    setShowNewChatModal(true);
  };

  const handleCreateNewChat = async () => {
    if (!newChatName.trim()) return;
    
    try {
      const newChat = await projectChatService.createProjectChat(project.id, newChatName.trim());
      setChats(prev => [...prev, newChat]);
      setActiveChatId(newChat.id);
      setNewChatName('');
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

  const handleSendMessage = async (messageText) => {
    if (!messageText.trim() || !activeChatId || isSendingMessage) return;
    
    setIsSendingMessage(true);
    
    try {
      // Guardar mensaje del usuario
      const userMessage = {
        tipo: 'usuario',
        contenido: messageText.trim()
      };
      
      await projectChatService.saveProjectChatMessage(project.id, activeChatId, userMessage);
      
      // Generar respuesta de la IA
      const aiResponse = await projectChatService.generateAiResponse(project.id, messageText, activeChatId);
      
      const aiMessage = {
        tipo: 'asistente',
        contenido: aiResponse
      };
      
      await projectChatService.saveProjectChatMessage(project.id, activeChatId, aiMessage);
      
      // Recargar historial
      await loadChatHistory(activeChatId);
    } catch (error) {
      console.error('Error enviando mensaje:', error);
    } finally {
      setIsSendingMessage(false);
    }
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

      {/* Main Content - 3 Columnas */}
      <div className={styles.mainContent}>
        {/* Columna Izquierda - Resumen y Timeline */}
        <div className={styles.leftColumn}>
          {/* Resumen del Proyecto */}
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Resumen del Proyecto</h2>
            <p className={styles.projectSummary}>
              {projectSummary?.resumen_breve || 'Cargando resumen del proyecto...'}
            </p>
          </div>

          {/* Aspectos Destacados */}
          <div className={styles.section}>
            <ProjectTimeline highlights={projectHighlights} />
          </div>

          {/* Miembros del Equipo */}
          <div className={styles.section}>
            <MembersList members={projectMembers} />
          </div>
        </div>

        {/* Columna Central - Chat */}
        <div className={styles.centerColumn}>
          <ChatInterface
            chatHistory={chatHistory}
            onSendMessage={handleSendMessage}
            isLoading={isSendingMessage}
            placeholder="Haz una pregunta sobre el proyecto..."
            title="Chat del Proyecto"
          />
        </div>

        {/* Columna Derecha - Detalles y Chats */}
        <div className={styles.rightColumn}>
          {/* Detalles del Proyecto */}
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Detalles del Proyecto</h3>
            {projectDetails && (
              <div className={styles.detailsList}>
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>Nombre del Proyecto</span>
                  <span className={styles.detailValue}>{projectDetails.nombre_proyecto}</span>
                </div>
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>Estado</span>
                  <span className={styles.detailValue}>{projectDetails.estado}</span>
                </div>
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>Fecha de Inicio</span>
                  <span className={styles.detailValue}>{projectDetails.fecha_inicio}</span>
                </div>
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>Fecha de Finalización</span>
                  <span className={styles.detailValue}>{projectDetails.fecha_finalizacion}</span>
                </div>
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>Presupuesto</span>
                  <span className={styles.detailValue}>{projectDetails.presupuesto}</span>
                </div>
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>Duración Prevista</span>
                  <span className={styles.detailValue}>{projectDetails.duracion_prevista}</span>
                </div>
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>Grabaciones</span>
                  <span className={styles.detailValue}>
                    {projectDetails.grabaciones_analizadas}/{projectDetails.grabaciones_totales}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Panel de Chats */}
          <div className={styles.section}>
            <ProjectChatPanel
              chats={chats}
              activeChatId={activeChatId}
              onChatSelect={handleChatSelect}
              onNewChat={handleNewChat}
              onDeleteChat={handleDeleteChat}
            />
          </div>
        </div>
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
                onKeyPress={(e) => e.key === 'Enter' && handleCreateNewChat()}
              />
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
                disabled={!newChatName.trim()}
                className={styles.modalConfirmButton}
              >
                Crear
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
