import React, { useState, useEffect } from 'react';
import projectsService from '../../services/projectsService';
import styles from './ProjectSelector.module.css';
import { MdAdd, MdCheck } from 'react-icons/md';

export default function ProjectSelector({ onSelect, onCancel, selectedProjectId = null, embedded = false }) {
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(selectedProjectId);
  const [showNewProjectForm, setShowNewProjectForm] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDescription, setNewProjectDescription] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    setLoading(true);
    setError(null);
    try {
      const projectsList = await projectsService.getProjects();
      setProjects(projectsList);
    } catch (err) {
      setError('Error al cargar los proyectos');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) {
      setError('El nombre del proyecto es obligatorio');
      return;
    }

    try {
      const project = await projectsService.createProject({
        name: newProjectName.trim(),
        description: newProjectDescription.trim()
      });
      
      setProjects([...projects, project]);
      setSelectedProject(project.id);
      setNewProjectName('');
      setNewProjectDescription('');
      setShowNewProjectForm(false);
    } catch (err) {
      setError('Error al crear el proyecto');
      console.error(err);
    }
  };

  const handleSelectProject = () => {
    if (onSelect) {
      const project = projects.find(p => p.id === selectedProject);
      onSelect(project);
    }
  };

  const handleNoProject = () => {
    if (onSelect) {
      onSelect(null);
    }
  };

  const content = (
    <div className={embedded ? styles.embeddedContainer : styles.modal}>
      <h3 className={styles.title}>Seleccionar Proyecto</h3>
      
      {error && (
        <div className={styles.error}>
          {error}
        </div>
      )}

      {loading ? (
        <div className={styles.loading}>Cargando proyectos...</div>
      ) : (
        <>
          {!showNewProjectForm ? (
            <>
              <div className={styles.listContainer}>
                <div className={styles.listSpace}>
                  {projects.map((project) => (
                    <div
                      key={project.id}
                      onClick={() => setSelectedProject(project.id)}
                      className={`${styles.projectItem} ${selectedProject === project.id ? styles.projectItemSelected : ''}`}
                    >
                      <div className={styles.projectName}>{project.name}</div>
                      {project.description && (
                        <div className={styles.projectDescription}>{project.description}</div>
                      )}
                    </div>
                  ))}
                  {projects.length === 0 && (
                    <div className={styles.emptyState}>
                      No hay proyectos. Crea uno nuevo.
                    </div>
                  )}
                </div>
              </div>

              <button
                onClick={() => setShowNewProjectForm(true)}
                className={styles.btnNewProject}
              >
                <MdAdd size={18} />
                <span>Nuevo Proyecto</span>
              </button>

              <div className={styles.buttonGroup}>
                <button
                  onClick={handleSelectProject}
                  disabled={!selectedProject}
                  className={styles.btnSelect}
                >
                  Seleccionar
                </button>
                <button
                  onClick={handleNoProject}
                  className={styles.btnNoProject}
                >
                  Sin Proyecto
                </button>
                <button
                  onClick={onCancel}
                  className={styles.btnCancel}
                >
                  Cancelar
                </button>
              </div>
            </>
          ) : (
            <>
              <div className={styles.formGroup}>
                <label className={styles.label}>Nombre del proyecto*</label>
                <input
                  type="text"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  placeholder="Ej: Proyecto Cliente ABC"
                  className={styles.input}
                  onKeyPress={(e) => e.key === 'Enter' && handleCreateProject()}
                  autoFocus
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>Descripción (opcional)</label>
                <textarea
                  value={newProjectDescription}
                  onChange={(e) => setNewProjectDescription(e.target.value)}
                  placeholder="Descripción del proyecto..."
                  rows={3}
                  className={styles.textarea}
                />
              </div>

              <div className={styles.buttonGroup}>
                <button
                  onClick={handleCreateProject}
                  disabled={!newProjectName.trim()}
                  className={styles.btnSelect}
                >
                  Crear Proyecto
                </button>
                <button
                  onClick={() => {
                    setShowNewProjectForm(false);
                    setNewProjectName('');
                    setNewProjectDescription('');
                    setError(null);
                  }}
                  className={styles.btnCancel}
                >
                  Volver
                </button>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );

  if (embedded) {
    return content;
  }

  return (
    <div className={styles.overlay}>
      {content}
    </div>
  );
}


