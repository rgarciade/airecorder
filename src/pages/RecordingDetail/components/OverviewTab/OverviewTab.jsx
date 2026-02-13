import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import styles from './OverviewTab.module.css';
import { 
  MdAutoAwesome, 
  MdAdd, 
  MdCheck, 
  MdClose, 
  MdEdit, 
  MdDeleteOutline 
} from 'react-icons/md';

export default function OverviewTab({ 
  summary, 
  detailedSummary, 
  highlights, 
  participants,
  onAddParticipant,
  onRemoveParticipant,
  onUpdateParticipant
}) {
  
  // Estado local para agregar participante
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState('');

  // Estado local para editar participante
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState('');

  const handleAddClick = () => {
    if (newName.trim()) {
      onAddParticipant({ name: newName, role: newRole || 'Participante' });
      setNewName('');
      setNewRole('');
      setIsAdding(false);
    }
  };

  const startEditing = (p) => {
    setEditingId(p.id);
    setEditName(p.name);
    setEditRole(p.role);
  };

  const saveEditing = () => {
    if (editName.trim()) {
      onUpdateParticipant(editingId, { name: editName, role: editRole });
      setEditingId(null);
    }
  };

  const cancelEditing = () => {
    setEditingId(null);
  };

  // Custom markdown components
  const markdownComponents = {
    p: ({ children }) => <p>{children}</p>,
    h4: ({ children }) => (
      <div className={styles.highlightBox}>
        <div className={styles.highlightTitle}>{children}</div>
      </div>
    ),
    ul: ({ children }) => <ul className={styles.listDisc}>{children}</ul>,
    li: ({ children }) => <li className={styles.listItem}>{children}</li>,
  };

  return (
    <div className={styles.container}>
      <div className={styles.mainColumn}>
        <div className={styles.grid}>
          {/* Left Column (Content) */}
          <div className={styles.leftPanel}>
            {/* Quick Summary */}
            <section className={`${styles.card} ${styles.quickSummaryCard}`}>
              <div className={styles.cardHeader}>
                <div className={`${styles.cardTitle} ${styles.quickTitle}`}>
                  <MdAutoAwesome size={20} />
                  Quick Summary
                </div>
              </div>
              <p className={styles.summaryText}>
                {summary || "No quick summary available."}
              </p>
            </section>

            {/* Detailed Summary */}
            <section className={styles.card}>
              <div className={styles.cardHeader}>
                <h3 className={styles.cardTitle}>Detailed Summary</h3>
              </div>
              <div className={styles.detailedContent}>
                <ReactMarkdown components={markdownComponents}>
                  {detailedSummary || "No detailed summary available."}
                </ReactMarkdown>
              </div>
            </section>
          </div>

          {/* Right Column (Sidebar info) */}
          <div className={styles.rightPanel}>
            {/* Key Highlights */}
            <section className={styles.card}>
              <div className={styles.cardHeader}>
                <h3 className={styles.cardTitle}>Key Highlights</h3>
              </div>
              <div className={styles.highlightsList}>
                {highlights && highlights.length > 0 ? (
                  highlights.map((highlight, idx) => (
                    <div key={idx} className={styles.highlightItem}>
                      <div className={styles.highlightDot}></div>
                      <div className={styles.highlightContent}>
                        <ReactMarkdown>
                          {highlight}
                        </ReactMarkdown>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className={styles.summaryText}>No highlights available.</p>
                )}
              </div>
            </section>

            {/* Participants */}
            <section className={styles.card}>
              <div className={styles.cardHeader}>
                <h3 className={styles.cardTitle}>Participants</h3>
                {!isAdding && (
                  <button 
                    onClick={() => setIsAdding(true)}
                    className={styles.addBtn}
                    title="Add Participant"
                  >
                    <MdAdd size={16} />
                  </button>
                )}
              </div>
              
              {/* Add Participant Form */}
              {isAdding && (
                <div className={styles.addForm}>
                  <input 
                    type="text" 
                    placeholder="Name" 
                    className={styles.input}
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    autoFocus
                  />
                  <input 
                    type="text" 
                    placeholder="Role" 
                    className={styles.input}
                    value={newRole}
                    onChange={e => setNewRole(e.target.value)}
                  />
                  <div className={styles.formActions}>
                    <button onClick={handleAddClick} className={styles.saveBtn}>
                      <MdCheck size={14} />
                    </button>
                    <button onClick={() => setIsAdding(false)} className={styles.cancelBtn}>
                      <MdClose size={14} />
                    </button>
                  </div>
                </div>
              )}

              <div className={styles.participantsList}>
                {participants && participants.length > 0 ? (
                  participants.map((p, idx) => (
                    <div key={p.id || idx} className={styles.participantItem}>
                      {editingId === p.id ? (
                        <div className={styles.editForm}>
                          <input 
                            type="text" 
                            className={styles.input} 
                            value={editName}
                            onChange={e => setEditName(e.target.value)}
                          />
                          <input 
                            type="text" 
                            className={styles.input} 
                            value={editRole}
                            onChange={e => setEditRole(e.target.value)}
                          />
                          <div className={styles.formActions}>
                            <button onClick={saveEditing} className={styles.saveBtn}>
                              <MdCheck size={14} />
                            </button>
                            <button onClick={cancelEditing} className={styles.cancelBtn}>
                              <MdClose size={14} />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className={styles.participant}>
                            <div className={styles.avatar}>
                              {p.name.charAt(0).toUpperCase()}
                            </div>
                            <div className={styles.participantInfo}>
                              <div className={styles.nameRow}>
                                <h4>{p.name}</h4>
                                {p.createdByAi && (
                                  <span className={styles.aiBadge} title="Extracted by AI">AI</span>
                                )}
                              </div>
                              <p>{p.role || 'Participante'}</p>
                            </div>
                          </div>
                          <div className={styles.actions}>
                            <button onClick={() => startEditing(p)} className={styles.actionIconBtn}>
                              <MdEdit size={14} />
                            </button>
                            <button onClick={() => onRemoveParticipant(p.id)} className={styles.actionIconBtn}>
                              <MdDeleteOutline size={14} />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ))
                ) : (
                  !isAdding && <p className={styles.summaryText}>No participants detected.</p>
                )}
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
