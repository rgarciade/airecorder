import React from 'react';
import styles from './ProjectTimeline.module.css';

export default function ProjectTimeline({ highlights = [] }) {
  const getStatusColor = (estado) => {
    switch (estado) {
      case 'completado':
        return '#10b981';
      case 'en_progreso':
        return '#f59e0b';
      case 'pendiente':
        return '#6b7280';
      default:
        return '#6b7280';
    }
  };

  const getStatusText = (estado) => {
    switch (estado) {
      case 'completado':
        return 'Completado';
      case 'en_progreso':
        return 'En Progreso';
      case 'pendiente':
        return 'Pendiente';
      default:
        return 'Pendiente';
    }
  };

  return (
    <div className={styles.container}>
      <h3 className={styles.title}>Aspectos Destacados</h3>
      
      {highlights.length === 0 ? (
        <div className={styles.emptyState}>
          <p className={styles.emptyText}>No hay aspectos destacados</p>
        </div>
      ) : (
        <div className={styles.timeline}>
          {highlights.map((highlight, index) => (
            <div key={highlight.id} className={styles.timelineItem}>
              {/* Línea conectora */}
              {index < highlights.length - 1 && (
                <div className={styles.connector}></div>
              )}
              
              {/* Punto de la línea de tiempo */}
              <div 
                className={styles.timelineDot}
                style={{ backgroundColor: getStatusColor(highlight.estado) }}
              >
                <span className={styles.dotIcon}>{highlight.icono}</span>
              </div>
              
              {/* Contenido del hito */}
              <div className={styles.timelineContent}>
                <div className={styles.timelineHeader}>
                  <div className={styles.timelineTitle}>
                    <span className={styles.semana}>{highlight.semana}</span>
                    <span className={styles.titulo}>{highlight.titulo}</span>
                  </div>
                  <div 
                    className={styles.statusBadge}
                    style={{ backgroundColor: getStatusColor(highlight.estado) }}
                  >
                    {getStatusText(highlight.estado)}
                  </div>
                </div>
                
                <div className={styles.timelineDescription}>
                  {highlight.descripcion}
                </div>
                
                <div className={styles.timelineDate}>
                  {new Date(highlight.fecha).toLocaleDateString('es-ES', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
