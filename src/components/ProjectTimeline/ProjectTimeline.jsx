import React, { useState } from 'react';
import styles from './ProjectTimeline.module.css';
import { MdEdit, MdDelete, MdSave, MdClose } from 'react-icons/md';

export default function ProjectTimeline({ highlights = [], onUpdateHighlights }) {
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(null);

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

  const handleEditClick = (highlight) => {
    setEditingId(highlight.id);
    setEditForm({ ...highlight });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditForm(null);
  };

  const handleSaveEdit = () => {
    const newHighlights = highlights.map(h => 
      h.id === editingId ? editForm : h
    );
    onUpdateHighlights(newHighlights);
    setEditingId(null);
    setEditForm(null);
  };

  const handleDeleteClick = (id) => {
    if (window.confirm('¿Estás seguro de que quieres eliminar este hito?')) {
      const newHighlights = highlights.filter(h => h.id !== id);
      onUpdateHighlights(newHighlights);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setEditForm(prev => ({ ...prev, [name]: value }));
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
                {editingId === highlight.id ? (
                  <div className={styles.editForm}>
                    <div className={styles.editRow}>
                      <input 
                        name="semana"
                        value={editForm.semana}
                        onChange={handleChange}
                        className={styles.editInput}
                        placeholder="Semana (ej: Semana 1)"
                      />
                      <select 
                        name="estado"
                        value={editForm.estado}
                        onChange={handleChange}
                        className={styles.editSelect}
                      >
                        <option value="pendiente">Pendiente</option>
                        <option value="en_progreso">En Progreso</option>
                        <option value="completado">Completado</option>
                      </select>
                    </div>
                    <input 
                      name="titulo"
                      value={editForm.titulo}
                      onChange={handleChange}
                      className={styles.editInput}
                      placeholder="Título"
                    />
                    <textarea 
                      name="descripcion"
                      value={editForm.descripcion}
                      onChange={handleChange}
                      className={styles.editTextArea}
                      placeholder="Descripción"
                    />
                    <input 
                      name="fecha"
                      type="date"
                      value={editForm.fecha ? editForm.fecha.split('T')[0] : ''}
                      onChange={handleChange}
                      className={styles.editInput}
                    />
                    <div className={styles.editFooter}>
                      <button onClick={handleCancelEdit} className={styles.cancelButton}>
                        <MdClose size={16} /> Cancelar
                      </button>
                      <button onClick={handleSaveEdit} className={styles.saveButton}>
                        <MdSave size={16} /> Guardar
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className={styles.timelineHeader}>
                      <div className={styles.timelineTitle}>
                        <span className={styles.semana}>{highlight.semana}</span>
                        <span className={styles.titulo}>{highlight.titulo}</span>
                      </div>
                      <div className={styles.headerActions}>
                        <div 
                          className={styles.statusBadge}
                          style={{ backgroundColor: getStatusColor(highlight.estado) }}
                        >
                          {getStatusText(highlight.estado)}
                        </div>
                        <div className={styles.itemActions}>
                          <button onClick={() => handleEditClick(highlight)} className={styles.actionBtn} title="Editar">
                            <MdEdit size={14} />
                          </button>
                          <button onClick={() => handleDeleteClick(highlight.id)} className={`${styles.actionBtn} ${styles.deleteBtn}`} title="Eliminar">
                            <MdDelete size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                    
                    <div className={styles.timelineDescription}>
                      {highlight.descripcion}
                    </div>
                    
                    <div className={styles.timelineDate}>
                      {highlight.fecha ? new Date(highlight.fecha).toLocaleDateString('es-ES', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric'
                      }) : 'Fecha no especificada'}
                    </div>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
