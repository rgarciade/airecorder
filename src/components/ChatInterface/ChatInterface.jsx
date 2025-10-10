import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import styles from './ChatInterface.module.css';

export default function ChatInterface({ 
  chatHistory = [], 
  onSendMessage, 
  isLoading = false, 
  placeholder = "Haz una pregunta...",
  title = "Chat",
  aiProvider = 'gemini',
  ollamaModels = [],
  selectedOllamaModel = '',
  onOllamaModelChange = () => {}
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

  // Componentes personalizados para el renderizado de Markdown
  const markdownComponents = {
    p: ({ children }) => <p className={styles.messageParagraph}>{children}</p>,
    ul: ({ children }) => <ul className={styles.messageList}>{children}</ul>,
    ol: ({ children }) => <ol className={styles.messageList}>{children}</ol>,
    li: ({ children }) => <li className={styles.messageListItem}>{children}</li>,
    strong: ({ children }) => <strong className={styles.messageBold}>{children}</strong>,
    em: ({ children }) => <em className={styles.messageItalic}>{children}</em>,
    code: ({ inline, children }) => 
      inline ? (
        <code className={styles.messageInlineCode}>{children}</code>
      ) : (
        <pre className={styles.messageCodeBlock}><code>{children}</code></pre>
      ),
    h1: ({ children }) => <h1 className={styles.messageHeading1}>{children}</h1>,
    h2: ({ children }) => <h2 className={styles.messageHeading2}>{children}</h2>,
    h3: ({ children }) => <h3 className={styles.messageHeading3}>{children}</h3>,
    table: ({ children }) => (
      <div className={styles.messageTableWrapper}>
        <table className={styles.messageTable}>{children}</table>
      </div>
    ),
    thead: ({ children }) => <thead className={styles.messageTableHead}>{children}</thead>,
    tbody: ({ children }) => <tbody className={styles.messageTableBody}>{children}</tbody>,
    tr: ({ children }) => <tr className={styles.messageTableRow}>{children}</tr>,
    th: ({ children }) => <th className={styles.messageTableHeader}>{children}</th>,
    td: ({ children }) => <td className={styles.messageTableCell}>{children}</td>,
  };

  return (
    <div className={styles.container}>
      <div className={styles.chatContainer}>
        <h2 className={styles.chatTitle}>{title}</h2>
        
        {/* Input para enviar mensaje */}
        <form onSubmit={handleSubmit} className={styles.messageForm}>
          <div className={styles.messageInputContainer}>
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder={placeholder}
              className={styles.messageInput}
              disabled={isLoading}
            />
            {aiProvider === 'ollama' && ollamaModels.length > 0 && (
              <select
                value={selectedOllamaModel}
                onChange={(e) => onOllamaModelChange(e.target.value)}
                className={styles.ollamaModelSelector}
                disabled={isLoading}
              >
                {ollamaModels.map((model) => (
                  <option key={model.name} value={model.name}>
                    {model.name}
                  </option>
                ))}
              </select>
            )}
          </div>
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

        {/* Historial de mensajes */}
        <div className={styles.chatHistory}>
          {chatHistory.length === 0 ? (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>💬</div>
              <p className={styles.emptyText}>No hay mensajes aún</p>
              <p className={styles.emptySubtext}>Haz una pregunta para comenzar</p>
            </div>
          ) : (
            [...chatHistory].reverse().map((message) => (
              <div key={message.id} className={`${styles.message} ${styles[message.tipo]}`}>
                <div className={styles.messageAvatar}>
                  {message.avatar || (message.tipo === 'asistente' ? '🤖' : '👤')}
                </div>
                <div className={styles.messageContent}>
                  <div className={styles.messageText}>
                    <ReactMarkdown components={markdownComponents}>
                      {message.contenido}
                    </ReactMarkdown>
                  </div>
                  <div className={styles.messageTime}>
                    {formatMessageTime(message.fecha)}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
