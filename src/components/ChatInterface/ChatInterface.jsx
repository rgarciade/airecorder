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
  onOllamaModelChange = () => { },
  onNavigateToRecording,
  onDeleteMessage
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

  // Procesar mensaje para convertir citas en enlaces
  const processMessageContent = (content) => {
    if (!content) return '';
    // Regex para capturar [Ref: ID | "Titulo" | Timestamp]
    // Soporta variantes con o sin comillas, con o sin timestamp
    return content.replace(
      /\[Ref:\s*([^|\]]+?)\s*\|\s*"?([^|"]+?)"?\s*(?:\|\s*([^\]]+?))?\]/g,
      (match, id, title, timestamp) => {
        const cleanId = id.trim();
        const cleanTitle = title.trim();
        const cleanTime = timestamp ? timestamp.trim() : '';
        const displayText = cleanTime ? `${cleanTitle} (${cleanTime})` : cleanTitle;
        const linkUrl = `citation:${cleanId}${cleanTime ? `:${cleanTime}` : ''}`;
        return `[📎 ${displayText}](${linkUrl})`;
      }
    );
  };

  // Componentes personalizados para el renderizado de Markdown
  const markdownComponents = {
    p: ({ children }) => <p className={styles.messageParagraph}>{children}</p>,
    a: ({ href, children }) => {
      if (href && href.startsWith('citation:')) {
        const [_, id, time] = href.split(':');
        return (
          <button
            className="inline-flex items-center gap-1 px-1.5 py-0.5 mx-1 bg-[#472426] hover:bg-[#663336] text-[#e92932] hover:text-white rounded text-xs font-medium transition-colors cursor-pointer border border-[#e92932]/30"
            onClick={(e) => {
              e.preventDefault();
              if (onNavigateToRecording) {
                onNavigateToRecording(id, time);
              }
            }}
            title="Ir a la grabación"
          >
            {children}
          </button>
        );
      }
      return <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">{children}</a>;
    },
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
    h4: ({ children }) => <h4 className={styles.messageHeading3}>{children}</h4>,
    h5: ({ children }) => <h5 className={styles.messageHeading3}>{children}</h5>,
    h6: ({ children }) => <h6 className={styles.messageHeading3}>{children}</h6>,
    blockquote: ({ children }) => (
      <blockquote className="border-l-4 border-[#e92932] pl-4 my-2 italic text-gray-300">
        {children}
      </blockquote>
    ),
    hr: () => <hr className="border-t border-[#472426] my-4" />,
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
    // Manejar saltos de línea
    br: () => <br />,
    // Manejar texto plano
    text: ({ children }) => <>{children}</>,
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
              <div key={message.id} className={`${styles.message} ${styles[message.tipo]} group relative`}>
                {onDeleteMessage && (
                  <button
                    onClick={() => onDeleteMessage(message.id)}
                    className="absolute top-2 right-2 p-1 text-[#c89295] opacity-0 group-hover:opacity-100 hover:text-white hover:bg-[#472426] rounded transition-all"
                    title="Eliminar mensaje"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 256 256">
                      <path d="M216,48H176V40a24,24,0,0,0-24-24H104A24,24,0,0,0,80,40v8H40a8,8,0,0,0,0,16h8V208a16,16,0,0,0,16,16H192a16,16,0,0,0,16-16V64h8a8,8,0,0,0,0-16ZM96,40a8,8,0,0,1,8-8h48a8,8,0,0,1,8,8v8H96Zm96,168H64V64H192ZM112,104v64a8,8,0,0,1-16,0V104a8,8,0,0,1,16,0Zm48,0v64a8,8,0,0,1-16,0V104a8,8,0,0,1,16,0Z"></path>
                    </svg>
                  </button>
                )}
                <div className={styles.messageAvatar}>
                  {message.avatar || (message.tipo === 'asistente' ? '🤖' : '👤')}
                </div>
                <div className={styles.messageContent}>
                  <div className={styles.messageText}>
                    <ReactMarkdown 
                      components={markdownComponents}
                      remarkPlugins={[]}
                      rehypePlugins={[]}
                    >
                      {processMessageContent(message.contenido || '')}
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
