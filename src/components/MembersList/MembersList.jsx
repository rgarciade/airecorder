import React from 'react';
import styles from './MembersList.module.css';

export default function MembersList({ members = [] }) {
  const getInitials = (name) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const formatLastActivity = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) return 'Ayer';
    if (diffDays < 7) return `${diffDays} días`;
    if (diffDays < 30) return `${Math.ceil(diffDays / 7)} sem`;
    return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  };

  return (
    <div className={styles.container}>
      <h3 className={styles.title}>Miembros del Equipo</h3>
      
      {members.length === 0 ? (
        <div className={styles.emptyState}>
          <p className={styles.emptyText}>No hay miembros registrados</p>
        </div>
      ) : (
        <div className={styles.membersGrid}>
          {members.map((member) => (
            <div key={member.id} className={styles.memberCard}>
              <div className={styles.memberAvatar}>
                <div 
                  className={styles.avatarCircle}
                  style={{ backgroundColor: member.avatar_color || '#e92932' }}
                >
                  <span className={styles.avatarInitials}>
                    {member.initials || getInitials(member.name)}
                  </span>
                </div>
                <div className={styles.onlineIndicator}></div>
              </div>
              
              <div className={styles.memberInfo}>
                <div className={styles.memberName}>{member.name}</div>
                <div className={styles.memberRole}>{member.role}</div>
                <div className={styles.memberStats}>
                  <span className={styles.participations}>
                    {member.participaciones} participaciones
                  </span>
                  <span className={styles.lastActivity}>
                    Última: {formatLastActivity(member.ultima_participacion)}
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
