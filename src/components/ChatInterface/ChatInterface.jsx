import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import styles from './ChatInterface.module.css';
import {
  MdSend, MdPerson, MdSmartToy, MdDeleteOutline, MdMoreHoriz,
  MdAdd, MdAttachFile, MdClose, MdImage, MdPictureAsPdf, MdDescription, MdInsertDriveFile, MdTableChart,
  MdVisibility, MdVisibilityOff
} from 'react-icons/md';

function AttachmentTypeIcon({ type, size = 14 }) {
  if (type === 'image') return <MdImage size={size} />;
  if (type === 'pdf') return <MdPictureAsPdf size={size} />;
  if (type === 'text') return <MdDescription size={size} />;
  if (type === 'excel') return <MdTableChart size={size} />;
  return <MdInsertDriveFile size={size} />;
}

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
  modelSupportsVision = false, // <- NUEVA PROP
  // Adjuntos
  recordAttachments = [],
  onPickNewAttachment,
  activeAttachments = [],
  onActiveAttachmentsChange,
  allowNewAttachments = true,
}) {
  const [newMessage, setNewMessage] = useState('');
  const [showOptions, setShowOptions] = useState(false);
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const [showPlusMenu, setShowPlusMenu] = useState(false);
  const [showAttachmentPicker, setShowAttachmentPicker] = useState(false);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [attachmentSearch, setAttachmentSearch] = useState('');

  const messagesEndRef = useRef(null);
  const optionsRef = useRef(null);
  const modelDropdownRef = useRef(null);
  const plusMenuRef = useRef(null);
  const attachmentPickerRef = useRef(null);

  // Cerrar menús al hacer click fuera
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (optionsRef.current && !optionsRef.current.contains(event.target)) {
        setShowOptions(false);
      }
      if (modelDropdownRef.current && !modelDropdownRef.current.contains(event.target)) {
        setShowModelDropdown(false);
      }
      if (plusMenuRef.current && !plusMenuRef.current.contains(event.target)) {
        setShowPlusMenu(false);
      }
      if (attachmentPickerRef.current && !attachmentPickerRef.current.contains(event.target)) {
        setShowAttachmentPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Auto-scroll al fondo durante el streaming
  useEffect(() => {
    if (isLoading) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'auto', block: 'end' });
    }
  }, [chatHistory, isLoading]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || isLoading) return;

    const message = newMessage.trim();
    setNewMessage('');
    
    // Guardamos los adjuntos actuales para esta petición
    const currentAttachments = [...activeAttachments];
    
    // Limpiamos la barra de input para que no sigan seleccionados visualmente
    if (onActiveAttachmentsChange) {
      onActiveAttachmentsChange([]);
    }
    
    await onSendMessage(message, currentAttachments);
  };

  const handleSuggestionClick = (text) => {
    // Al igual que con handleSubmit, limpiamos tras enviar
    const currentAttachments = [...activeAttachments];
    if (onActiveAttachmentsChange) {
      onActiveAttachmentsChange([]);
    }
    onSendMessage(text, currentAttachments);
  };

  // Botón + → "Subir archivo"
  const handlePickNewFile = async () => {
    setShowPlusMenu(false);
    if (!onPickNewAttachment) return;
    setUploadingAttachment(true);
    await onPickNewAttachment();
    setUploadingAttachment(false);
  };

  // Toggle de adjunto en el picker (activa/desactiva del contexto)
  const handleToggleAttachment = (attachment) => {
    // Validar si es imagen y el modelo no soporta visión
    if (attachment.type === 'image' && !modelSupportsVision) {
      alert("El modelo actual no es compatible con el análisis de imágenes.");
      return;
    }

    const isActive = activeAttachments.some(a => a.filename === attachment.filename && a.recordingId === attachment.recordingId);
    const updated = isActive
      ? activeAttachments.filter(a => !(a.filename === attachment.filename && a.recordingId === attachment.recordingId))
      : [...activeAttachments, attachment];
    onActiveAttachmentsChange?.(updated);
  };

  // Quitar adjunto activo de la barra
  const handleRemoveActiveAttachment = (attachmentToRemove) => {
    const updated = activeAttachments.filter(a => {
      // Si estamos en un contexto de proyecto, usar recordingId para no quitar adjuntos con mismo nombre de otra grabación
      if (a.recordingId && attachmentToRemove.recordingId) {
        return !(a.filename === attachmentToRemove.filename && a.recordingId === attachmentToRemove.recordingId);
      }
      return a.filename !== attachmentToRemove.filename;
    });
    onActiveAttachmentsChange?.(updated);
  };

  const formatMessageTime = (dateString) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const processMessageContent = (content) => {
    if (!content) return '';
    let processed = content;
    const codeBlockRegex = /^\s*```(?:markdown)?\s*([\s\S]*?)\s*```\s*$/i;
    const match = processed.match(codeBlockRegex);
    if (match) {
      processed = match[1];
    }
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
        {/* Header */}
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
                  {/* ICONO DE VISIÓN */}
                  <span className={styles.visionIcon} title={modelSupportsVision ? "Este modelo soporta análisis de imágenes" : "Este modelo no soporta imágenes"}>
                    {modelSupportsVision ? <MdVisibility size={14} className="text-green-600" /> : <MdVisibilityOff size={14} className="text-gray-400" />}
                  </span>
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

        {/* Historial de mensajes */}
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

                <div className={styles.messageAvatar}>
                  {message.tipo === 'asistente' ? <MdSmartToy size={16} /> : <MdPerson size={16} />}
                </div>

                <div className={styles.messageContent}>
                  <div className={styles.messageText}>
                    {/* Previews de adjuntos para mensajes del usuario */}
                    {message.tipo === 'usuario' && message.adjuntos && message.adjuntos.length > 0 && (
                      <div className={styles.messageAttachments}>
                        {message.adjuntos.map((att, idx) => (
                          <div key={idx} className={styles.messageAttachmentChip}>
                            <AttachmentTypeIcon type={att.type} size={13} />
                            <span className={styles.messageAttachmentName} title={att.filename}>
                              {att.filename}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
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

        {/* Área de input */}
        <form onSubmit={handleSubmit} className={styles.messageForm}>

          {/* Preview de adjuntos activos (persisten entre mensajes) */}
          {activeAttachments.length > 0 && (
            <div className={styles.activeAttachmentsBar}>
              {activeAttachments.map(att => (
                <div key={att.filename} className={styles.activeAttachmentChip}>
                  <AttachmentTypeIcon type={att.type} size={13} />
                  <span className={styles.activeAttachmentName} title={att.filename}>
                    {att.filename}
                  </span>
                  <button
                    type="button"
                    className={styles.removeAttachmentBtn}
                    onClick={() => handleRemoveActiveAttachment(att)}
                    title="Quitar del contexto"
                  >
                    <MdClose size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className={styles.messageInputContainer}>

            {/* Botón + (subir archivo nuevo) - Solo si hay onPickNewAttachment */}
            {onPickNewAttachment && (
              <div className={styles.attachBtnGroup} ref={plusMenuRef}>
                <button
                  type="button"
                  className={styles.attachBtn}
                  onClick={() => setShowPlusMenu(v => !v)}
                  disabled={isLoading || uploadingAttachment}
                  title="Añadir archivo"
                >
                  {uploadingAttachment
                    ? <span className={styles.attachSpinner} />
                    : <MdAdd size={18} />
                  }
                </button>
                {showPlusMenu && (
                  <div className={styles.plusMenu}>
                    <button
                      type="button"
                      className={styles.plusMenuItem}
                      onClick={handlePickNewFile}
                    >
                      <MdAttachFile size={15} />
                      Subir archivo
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Botón adjuntar (seleccionar de los adjuntos del record) */}
            {recordAttachments.length > 0 && (
              <div className={styles.attachBtnGroup} ref={attachmentPickerRef}>
                <button
                  type="button"
                  className={`${styles.attachBtn} ${activeAttachments.length > 0 ? styles.attachBtnActive : ''}`}
                  onClick={() => setShowAttachmentPicker(v => !v)}
                  disabled={isLoading}
                  title="Adjuntar al contexto"
                >
                  <MdAttachFile size={17} />
                  {activeAttachments.length > 0 && (
                    <span className={styles.attachBadge}>{activeAttachments.length}</span>
                  )}
                </button>

                {showAttachmentPicker && (
                  <div className={styles.attachmentPicker}>
                    <div className={styles.pickerHeader}>
                      Adjuntar al contexto del chat
                    </div>
                    <div className="px-2 pb-2">
                      <input 
                        type="text" 
                        placeholder="Buscar archivo..." 
                        value={attachmentSearch}
                        onChange={(e) => setAttachmentSearch(e.target.value)}
                        className={styles.attachmentSearchInput}
                      />
                    </div>
                    <div className={styles.pickerList}>
                      {(() => {
                        const filteredAttachments = recordAttachments.filter(att => 
                          att.filename.toLowerCase().includes(attachmentSearch.toLowerCase())
                        );

                        if (filteredAttachments.length === 0) {
                          return <div className="text-xs text-gray-500 text-center py-2">No se encontraron archivos</div>;
                        }

                        const hasGroups = filteredAttachments.some(att => att.recordingTitle);

                        if (!hasGroups) {
                          return filteredAttachments.map(att => {
                            const isActive = activeAttachments.some(a => a.filename === att.filename);
                            return (
                              <label key={att.filename} className={`${styles.pickerItem} ${isActive ? styles.pickerItemActive : ''}`}>
                                <input
                                  type="checkbox"
                                  checked={isActive}
                                  onChange={() => handleToggleAttachment(att)}
                                  className={styles.pickerCheckbox}
                                  disabled={att.type === 'image' && !modelSupportsVision}
                                />
                                <AttachmentTypeIcon type={att.type} size={15} />
                                <span className={styles.pickerFilename} title={att.filename}>
                                  {att.filename}
                                </span>
                                {att.type === 'image' && !modelSupportsVision && (
                                   <span className="ml-auto text-red-400" title="Modelo no compatible"><MdVisibilityOff size={12}/></span>
                                )}
                              </label>
                            );
                          });
                        }

                        const groupedAttachments = filteredAttachments.reduce((acc, att) => {
                          const group = att.recordingTitle || 'Otros';
                          if (!acc[group]) acc[group] = [];
                          acc[group].push(att);
                          return acc;
                        }, {});

                        return Object.entries(groupedAttachments).map(([group, atts]) => (
                          <div key={group} className={styles.pickerGroup}>
                            <div className={styles.pickerGroupTitle}>{group}</div>
                            {atts.map(att => {
                              // Cuando hay grupos, unimos el recordingId o title para no cruzar IDs, 
                              // pero como el toggle usa filename vamos a asegurar que el toggle compare recordingId si está en un proyecto
                              const isActive = activeAttachments.some(a => a.filename === att.filename && a.recordingId === att.recordingId);
                              return (
                                <label key={`${att.recordingId}-${att.filename}`} className={`${styles.pickerItem} ${isActive ? styles.pickerItemActive : ''}`}>
                                  <input
                                    type="checkbox"
                                    checked={isActive}
                                    onChange={() => handleToggleAttachment(att)}
                                    className={styles.pickerCheckbox}
                                    disabled={att.type === 'image' && !modelSupportsVision}
                                  />
                                  <AttachmentTypeIcon type={att.type} size={15} />
                                  <span className={styles.pickerFilename} title={att.filename}>
                                    {att.filename}
                                  </span>
                                  {att.type === 'image' && !modelSupportsVision && (
                                     <span className="ml-auto text-red-400" title="Modelo no compatible"><MdVisibilityOff size={12}/></span>
                                  )}
                                </label>
                              );
                            })}
                          </div>
                        ));
                      })()}
                    </div>
                  </div>
                )}
              </div>
            )}

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
