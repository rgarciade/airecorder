import React, { useState } from 'react';
import styles from './MembersList.module.css';

export default function MembersList({ members = [], onUpdateMembers }) {
  const [isEditing, setIsEditing] = useState(false);
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberRole, setNewMemberRole] = useState('');

  const getInitials = (name) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const formatLastActivity = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 1) return 'Ayer';
    if (diffDays < 7) return `${diffDays} días`;
    if (diffDays < 30) return `${Math.ceil(diffDays / 7)} sem`;
    return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  };

  const handleAddMember = () => {
    if (!newMemberName.trim()) return;

    const newMember = {
      id: Date.now(),
      name: newMemberName.trim(),
      role: newMemberRole.trim() || 'Miembro',
      initials: getInitials(newMemberName.trim()),
      participaciones: 0,
      ultima_participacion: new Date().toISOString(),
      avatar_color: '#e92932'
    };

    onUpdateMembers([...members, newMember]);
    setNewMemberName('');
    setNewMemberRole('');
    setIsEditing(false);
  };

  const handleDeleteMember = (memberId) => {
    if (window.confirm('¿Estás seguro de eliminar este miembro?')) {
      onUpdateMembers(members.filter(m => m.id !== memberId));
    }
  };

  const handleUpdateMemberRole = (memberId, newRole) => {
    const updatedMembers = members.map(m =>
      m.id === memberId ? { ...m, role: newRole } : m
    );
    onUpdateMembers(updatedMembers);
  };

  return (
    <div className={styles.container}>
      <div className="flex justify-between items-center mb-4">
        <h3 className={styles.title}>Miembros del Equipo</h3>
        <button
          onClick={() => setIsEditing(!isEditing)}
          className="text-xs text-[#c89295] hover:text-white transition-colors"
        >
          {isEditing ? 'Cancelar' : '+ Añadir'}
        </button>
      </div>

      {isEditing && (
        <div className="bg-[#2a1a1b] p-3 rounded-lg mb-4 border border-[#472426]">
          <input
            type="text"
            placeholder="Nombre"
            value={newMemberName}
            onChange={(e) => setNewMemberName(e.target.value)}
            className="w-full bg-[#1a0f0f] text-white text-sm p-2 rounded mb-2 border border-[#472426] focus:border-[#e92932] outline-none"
          />
          <input
            type="text"
            placeholder="Rol (opcional)"
            value={newMemberRole}
            onChange={(e) => setNewMemberRole(e.target.value)}
            className="w-full bg-[#1a0f0f] text-white text-sm p-2 rounded mb-2 border border-[#472426] focus:border-[#e92932] outline-none"
          />
          <button
            onClick={handleAddMember}
            disabled={!newMemberName.trim()}
            className="w-full bg-[#e92932] text-white text-sm py-1 rounded hover:bg-[#d6252e] disabled:opacity-50"
          >
            Guardar
          </button>
        </div>
      )}

      {members.length === 0 ? (
        <div className={styles.emptyState}>
          <p className={styles.emptyText}>No hay miembros registrados</p>
        </div>
      ) : (
        <div className={styles.membersGrid}>
          {members.map((member) => (
            <div key={member.id} className={styles.memberCard}>
              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => handleDeleteMember(member.id)}
                  className="text-[#c89295] hover:text-red-500"
                  title="Eliminar miembro"
                >
                  ×
                </button>
              </div>

              <div className={styles.memberAvatar}>
                <div
                  className={styles.avatarCircle}
                  style={{ backgroundColor: member.avatar_color || '#e92932' }}
                >
                  <span className={styles.avatarInitials}>
                    {member.initials || getInitials(member.name)}
                  </span>
                </div>
                {member.isAiSuggestion && (
                  <div className="absolute -bottom-1 -right-1 bg-blue-500 text-[8px] px-1 rounded-full text-white" title="Sugerido por IA">
                    IA
                  </div>
                )}
              </div>

              <div className={styles.memberInfo}>
                <div className={styles.memberName}>{member.name}</div>
                <input
                  className="bg-transparent text-[#c89295] text-xs w-full text-center border-b border-transparent hover:border-[#472426] focus:border-[#e92932] outline-none"
                  value={member.role}
                  onChange={(e) => handleUpdateMemberRole(member.id, e.target.value)}
                />
                <div className={styles.memberStats}>
                  <span className={styles.participations}>
                    {member.participaciones || 0} participaciones
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
