import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import styles from './ChatInterface.module.css';
import { MdSend, MdPerson, MdSmartToy, MdDeleteOutline, MdMoreHoriz } from 'react-icons/md';

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
  onDeleteMessage,
  onResetChat,
  // Selector de modelo de sesión
  currentModel = '',
  availableModels = [],
  onModelChange = null,
  isVerifyingModel = false,
}) {
  const [newMessage, setNewMessage] = useState('');
  const [showOptions, setShowOptions] = useState(false);
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const messagesEndRef = useRef(null);
  const optionsRef = useRef(null);
  const modelDropdownRef = useRef(null);

  // Cerrar menús al hacer click fuera
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (optionsRef.current && !optionsRef.current.contains(event.target)) {
        setShowOptions(false);
      }
      if (modelDropdownRef.current && !modelDropdownRef.current.contains(event.target)) {
        setShowModelDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Auto-scroll al fondo durante el streaming
  // Solo hacemos scroll automático cuando isLoading es true (durante streaming)
  // Cuando termina (isLoading = false), NO hacemos scroll para evitar el "salto" final
  useEffect(() => {
    if (isLoading) {
      // Durante streaming: scroll instantáneo para seguir el texto en tiempo real
      messagesEndRef.current?.scrollIntoView({ behavior: 'auto', block: 'end' });
    }
  }, [chatHistory, isLoading]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || isLoading) return;

    const message = newMessage.trim();
    setNewMessage('');
    await onSendMessage(message);
  };

  const handleSuggestionClick = (text) => {
    onSendMessage(text);
  };

  const formatMessageTime = (dateString) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Procesar mensaje para convertir citas en enlaces y limpiar bloques de código envolventes
  const processMessageContent = (content) => {
    if (!content) return '';
    
    let processed = content;

    // 1. Desempaquetar bloques de código si envuelven todo el mensaje
    // Regex: Busca ```markdown ... ``` o ``` ... ``` al inicio y final
    // \s* permite espacios/saltos de línea antes/después
    const codeBlockRegex = /^\s*```(?:markdown)?\s*([\s\S]*?)\s*```\s*$/i;
    const match = processed.match(codeBlockRegex);
    if (match) {
      processed = match[1]; // Extraer el contenido interior
    }

    // 2. Procesar citas (existente)
    return processed.replace(
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
            className="inline-flex items-center gap-1 px-1.5 py-0.5 mx-1 bg-blue-50 hover:bg-blue-100 text-blue-600 hover:text-blue-700 rounded text-xs font-medium transition-colors cursor-pointer border border-blue-200"
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
      return <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">{children}</a>;
    },
    ul: ({ children }) => <ul className={styles.messageList}>{children}</ul>,
    ol: ({ children }) => <ol className={styles.messageList} style={{ listStyleType: 'decimal' }}>{children}</ol>,
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
      <blockquote className="border-l-4 border-gray-300 pl-4 my-2 italic text-gray-600">
        {children}
      </blockquote>
    ),
    hr: () => <hr className="border-t border-gray-300 my-4" />,
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
        {/* Header Rediseñado */}
        <div className={styles.chatHeader}>
          <div className={styles.chatHeaderLeft}>
            <div className={styles.headerIcon}>
              <MdSmartToy size={20} />
            </div>
            <span className={styles.headerTitle}>{title}</span>
          </div>
          
          <div className={styles.chatHeaderRight}>
            {currentModel && (
              <div className={styles.modelPill} ref={modelDropdownRef}>
                <button
                  className={styles.modelPillBtn}
                  onClick={() => availableModels.length > 1 && setShowModelDropdown(v => !v)}
                  disabled={isVerifyingModel || isLoading}
                  title={availableModels.length > 1 ? 'Cambiar modelo' : 'Modelo activo'}
                >
                  {isVerifyingModel && <span className={styles.verifySpinner} />}
                  <span className={styles.modelName}>{currentModel}</span>
                  {availableModels.length > 1 && !isVerifyingModel && <span className={styles.chevron}>▾</span>}
                </button>
                {showModelDropdown && (
                  <div className={styles.modelDropdown}>
                    {availableModels.map(m => (
                      <button
                        key={m.value}
                        className={`${styles.modelOption} ${m.value === currentModel ? styles.modelOptionActive : ''}`}
                        onClick={() => { onModelChange?.(m.value); setShowModelDropdown(false); }}
                      >{m.label}</button>
                    ))}
                  </div>
                )}
              </div>
            )}
            <div ref={optionsRef} className="relative">
              <button 
                className={styles.optionsButton}
                onClick={() => setShowOptions(!showOptions)}
                title="Opciones del chat"
              >
                <MdMoreHoriz size={20} />
              </button>
              
              {showOptions && (
                <div 
                  className="absolute right-0 top-full mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-100 z-50 overflow-hidden"
                  style={{ minWidth: '150px' }}
                >
                  <button
                    className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors"
                    onClick={() => {
                      if (onResetChat) onResetChat();
                      setShowOptions(false);
                    }}
                  >
                    <MdDeleteOutline size={16} />
                    Reiniciar Chat
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Historial de mensajes (Arriba) */}
        <div className={styles.chatHistory}>
          {chatHistory.length === 0 ? (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>💬</div>
              <p className={styles.emptyText}>Hi! I can help you summarize key points.</p>
              <p className={styles.emptySubtext}>Ask anything about this recording...</p>
            </div>
          ) : (
            chatHistory.map((message) => (
              <div key={message.id} className={`${styles.message} ${styles[message.tipo]} group relative`}>
                {onDeleteMessage && (
                  <button
                    onClick={() => onDeleteMessage(message.id)}
                    className="absolute top-2 right-2 p-1 text-gray-400 opacity-0 group-hover:opacity-100 hover:text-red-500 transition-all"
                    title="Eliminar mensaje"
                  >
                    <MdDeleteOutline size={14} />
                  </button>
                )}
                
                {/* Avatar (solo para asistente según CSS) */}
                <div className={styles.messageAvatar}>
                  {message.tipo === 'asistente' ? <MdSmartToy size={16} /> : <MdPerson size={16} />}
                </div>

                <div className={styles.messageContent}>
                  <div className={styles.messageText}>
                    <ReactMarkdown 
                      components={markdownComponents}
                      remarkPlugins={[remarkGfm]}
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
          {isLoading && !(chatHistory.length > 0 && chatHistory[chatHistory.length - 1]?.id === 'streaming') && (
            <div className={`${styles.message} ${styles.asistente}`}>
              <div className={styles.messageAvatar}>
                <MdSmartToy size={16} />
              </div>
              <div className={styles.messageContent}>
                <div className={`${styles.messageText} flex items-center gap-2`}>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-100"></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-200"></div>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Sugerencias */}
        {chatHistory.length === 0 && (
          <div className={styles.suggestions}>
            <button className={styles.suggestionChip} onClick={() => handleSuggestionClick("Summarize Action Items")}>
              Summarize Action Items
            </button>
            <button className={styles.suggestionChip} onClick={() => handleSuggestionClick("Most important decisions")}>
              Most important decisions
            </button>
          </div>
        )}

        {/* Input (Abajo) */}
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
            <button
              type="submit"
              disabled={!newMessage.trim() || isLoading}
              className={styles.sendButton}
            >
              <MdSend size={18} />
            </button>
          </div>
          <div className="text-center mt-2 text-[10px] text-gray-400">
            AI can make mistakes. Please verify important details.
          </div>
        </form>
      </div>
    </div>
  );
}
