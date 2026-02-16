import React, { useState } from 'react';
import styles from './ProjectChatPanel.module.css';

export default function ProjectChatPanel({ 
  chats = [], 
  activeChatId, 
  onChatSelect, 
  onNewChat, 
  onDeleteChat 
}) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);

  const handleDeleteClick = (e, chatId) => {
    e.stopPropagation();
    setShowDeleteConfirm(chatId);
  };

  const handleDeleteConfirm = (chatId) => {
    onDeleteChat(chatId);
    setShowDeleteConfirm(null);
  };

  const handleDeleteCancel = () => {
    setShowDeleteConfirm(null);
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) return 'Ayer';
    if (diffDays < 7) return `${diffDays} días`;
    return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3 className={styles.title}>Historial de Chat</h3>
        <button 
          onClick={onNewChat}
          className={styles.newChatButton}
          title="Crear nuevo chat"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 256 256">
            <path d="M224,128a8,8,0,0,1-8,8H136v80a8,8,0,0,1-16,0V136H40a8,8,0,0,1,0-16h80V40a8,8,0,0,1,16,0v80h80A8,8,0,0,1,224,128Z"></path>
          </svg>
        </button>
      </div>

      <div className={styles.chatList}>
        {chats.length === 0 ? (
          <div className={styles.emptyState}>
            <p className={styles.emptyText}>No hay chats</p>
            <p className={styles.emptySubtext}>Crea tu primer chat</p>
          </div>
        ) : (
          chats.map((chat) => (
            <div
              key={chat.id}
              className={`${styles.chatItem} ${activeChatId === chat.id ? styles.active : ''}`}
              onClick={() => onChatSelect(chat.id)}
            >
              <div className={styles.chatIcon}>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 256 256">
                  <path d="M216,48H40A16,16,0,0,0,24,64V192a16,16,0,0,0,16,16H99.47l14.81,21.16a16,16,0,0,0,25.44,0L156.53,208H216a16,16,0,0,0,16-16V64A16,16,0,0,0,216,48ZM40,64H216V192H156.53a16,16,0,0,0-12.72,6.4L128,219.2l-15.81-20.8A16,16,0,0,0,99.47,192H40Z"></path>
                </svg>
              </div>
              
              <div className={styles.chatInfo}>
                <div className={styles.chatName}>{chat.nombre}</div>
                <div className={styles.chatDate}>{formatDate(chat.ultimo_mensaje)}</div>
              </div>

              <div className={styles.chatActions}>
                <button
                  onClick={(e) => handleDeleteClick(e, chat.id)}
                  className={styles.deleteButton}
                  title="Eliminar chat"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 256 256">
                    <path d="M205.66,194.34a8,8,0,0,1-11.32,11.32L128,139.31,61.66,205.66a8,8,0,0,1-11.32-11.32L116.69,128,50.34,61.66A8,8,0,0,1,61.66,50.34L128,116.69l66.34-66.35a8,8,0,0,1,11.32,11.32L139.31,128Z"></path>
                  </svg>
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal de confirmación de eliminación */}
      {showDeleteConfirm && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <h4 className={styles.modalTitle}>Eliminar Chat</h4>
            <p className={styles.modalText}>
              ¿Estás seguro de que quieres eliminar este chat? Esta acción no se puede deshacer.
            </p>
            <div className={styles.modalActions}>
              <button 
                onClick={handleDeleteCancel}
                className={styles.cancelButton}
              >
                Cancelar
              </button>
              <button 
                onClick={() => handleDeleteConfirm(showDeleteConfirm)}
                className={styles.confirmButton}
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
