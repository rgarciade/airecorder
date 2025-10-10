import React, { useState, useEffect } from 'react';
import styles from './ChatInterface.module.css';

export default function ChatInterface({ 
  chatHistory = [], 
  onSendMessage, 
  isLoading = false, 
  placeholder = "Haz una pregunta...",
  title = "Chat"
}) {
  const [newMessage, setNewMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || isLoading) return;
    
    const message = newMessage.trim();
    setNewMessage('');
    await onSendMessage(message);
  };

  const formatMessageTime = (dateString) => {
    return new Date(dateString).toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatMessageContent = (content) => {
    if (!content) return '';
    
    // Dividir el contenido en párrafos
    const paragraphs = content.split('\n\n');
    
    return paragraphs.map((paragraph, index) => {
      // Si el párrafo está vacío, no renderizar nada
      if (!paragraph.trim()) return null;
      
      // Detectar si es una lista (líneas que empiezan con - o números)
      const lines = paragraph.split('\n');
      const isList = lines.some(line => 
        line.trim().match(/^[-•*]\s+/) || 
        line.trim().match(/^\d+\.\s+/) ||
        line.trim().match(/^[a-zA-Z]\.\s+/)
      );
      
      if (isList) {
        return (
          <ul key={index} className={styles.messageList}>
            {lines.map((line, lineIndex) => {
              const trimmedLine = line.trim();
              if (!trimmedLine) return null;
              
              // Detectar diferentes tipos de listas
              const listItemMatch = trimmedLine.match(/^[-•*]\s+(.+)$/) || 
                                   trimmedLine.match(/^\d+\.\s+(.+)$/) ||
                                   trimmedLine.match(/^[a-zA-Z]\.\s+(.+)$/);
              
              if (listItemMatch) {
                return (
                  <li key={lineIndex} className={styles.messageListItem}>
                    {listItemMatch[1]}
                  </li>
                );
              }
              
              // Si no coincide con el patrón de lista, mostrar como párrafo normal
              return (
                <li key={lineIndex} className={styles.messageListItem}>
                  {trimmedLine}
                </li>
              );
            })}
          </ul>
        );
      }
      
      // Si no es una lista, renderizar como párrafo normal
      return (
        <p key={index} className={styles.messageParagraph}>
          {paragraph.trim()}
        </p>
      );
    }).filter(Boolean);
  };

  return (
    <div className={styles.container}>
      <div className={styles.chatContainer}>
        <h2 className={styles.chatTitle}>{title}</h2>
        
        {/* Historial de mensajes */}
        <div className={styles.chatHistory}>
          {chatHistory.length === 0 ? (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>💬</div>
              <p className={styles.emptyText}>No hay mensajes aún</p>
              <p className={styles.emptySubtext}>Haz una pregunta para comenzar</p>
            </div>
          ) : (
            chatHistory.map((message) => (
              <div key={message.id} className={`${styles.message} ${styles[message.tipo]}`}>
                <div className={styles.messageAvatar}>
                  {message.avatar || (message.tipo === 'asistente' ? '🤖' : '👤')}
                </div>
                <div className={styles.messageContent}>
                  <div className={styles.messageText}>
                    {formatMessageContent(message.contenido)}
                  </div>
                  <div className={styles.messageTime}>
                    {formatMessageTime(message.fecha)}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Input para enviar mensaje */}
        <form onSubmit={handleSubmit} className={styles.messageForm}>
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder={placeholder}
            className={styles.messageInput}
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={!newMessage.trim() || isLoading}
            className={styles.sendButton}
          >
            {isLoading ? (
              <div className={styles.sendingSpinner}></div>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 256 256">
                <path d="M200,32V144a8,8,0,0,1-16,0V59.31L69.66,189.66a8,8,0,0,1-11.32-11.32L172.69,48H88a8,8,0,0,1,0-16H192A8,8,0,0,1,200,32Z"></path>
              </svg>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
