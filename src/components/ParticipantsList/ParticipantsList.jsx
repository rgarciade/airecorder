import React, { useState } from 'react';
import styles from './ParticipantsList.module.css';
import { 
  MdAdd, 
  MdCheck, 
  MdClose, 
  MdEdit, 
  MdDeleteOutline 
} from 'react-icons/md';

export default function ParticipantsList({ 
  participants = [],
  onAddParticipant,
  onRemoveParticipant,
  onUpdateParticipant,
  title = "Participantes"
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

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3 className={styles.title}>{title}</h3>
        {!isAdding && (
          <button 
            onClick={() => setIsAdding(true)}
            className={styles.addBtn}
            title="Añadir"
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
            placeholder="Nombre" 
            className={styles.input}
            value={newName}
            onChange={e => setNewName(e.target.value)}
            autoFocus
          />
          <input 
            type="text" 
            placeholder="Rol" 
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

      <div className={styles.list}>
        {participants && participants.length > 0 ? (
          participants.map((p, idx) => (
            <div key={p.id || idx} className={styles.item}>
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
                  <div className={styles.info}>
                    <div className={styles.avatar} style={{ backgroundColor: p.avatar_color }}>
                      {p.name.charAt(0).toUpperCase()}
                    </div>
                    <div className={styles.details}>
                      <div className={styles.nameRow}>
                        <h4>{p.name}</h4>
                        {(p.isAiSuggestion || p.createdByAi) && (
                          <span className={styles.aiBadge} title="Sugerido por IA">IA</span>
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
          !isAdding && <p className={styles.emptyText}>No se detectaron participantes.</p>
        )}
      </div>
    </div>
  );
}
