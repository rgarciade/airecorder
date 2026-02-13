import React, { useState, useEffect } from 'react';
import projectsService from '../../services/projectsService';
import recordingsService from '../../services/recordingsService';
import styles from './Projects.module.css';

import ProjectCard from './components/ProjectCard';
import CreateProjectCard from './components/CreateProjectCard';
import RecentUploadsTable from './components/RecentUploadsTable';

export default function Projects({ onBack, onRecordingSelect, onProjectDetail, initialProjectId = null }) {
  const [projects, setProjects] = useState([]);
  const [recordings, setRecordings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modals state
  const [showNewProjectForm, setShowNewProjectForm] = useState(false);
  const [showEditProjectForm, setShowEditProjectForm] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDescription, setNewProjectDescription] = useState('');
  const [editingProject, setEditingProject] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [projectsList, recordingsList] = await Promise.all([
        projectsService.getProjects(),
        recordingsService.getRecordings()
      ]);
      setProjects(projectsList);
      setRecordings(recordingsList);
    } catch (error) {
      console.error('Error cargando datos:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) return;
    
    try {
      const project = await projectsService.createProject({
        name: newProjectName.trim(),
        description: newProjectDescription.trim()
      });
      
      setProjects([...projects, project]);
      setNewProjectName('');
      setNewProjectDescription('');
      setShowNewProjectForm(false);
    } catch (error) {
      console.error('Error creando proyecto:', error);
    }
  };

  const handleUpdateProject = async () => {
    if (!editingProject || !editingProject.name.trim()) return;
    
    try {
      const updatedProject = await projectsService.updateProject(editingProject.id, {
        name: editingProject.name,
        description: editingProject.description
      });
      
      setProjects(projects.map(p => p.id === updatedProject.id ? updatedProject : p));
      setEditingProject(null);
      setShowEditProjectForm(false);
    } catch (error) {
      console.error('Error actualizando proyecto:', error);
    }
  };

  const handleEditClick = (project) => {
    setEditingProject(project);
    setShowEditProjectForm(true);
  };

  const handleDeleteProject = async (projectId) => {
    if (!confirm('Are you sure you want to delete this project? Recordings will not be deleted.')) {
      return;
    }
    
    try {
      await projectsService.deleteProject(projectId);
      setProjects(projects.filter(p => p.id !== projectId));
    } catch (error) {
      console.error('Error eliminando proyecto:', error);
    }
  };

  // Filtrado de proyectos
  const filteredProjects = projects.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Grabaciones recientes (últimas 5)
  const recentRecordings = [...recordings]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 5);

  return (
    <div className={styles.container}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.titleGroup}>
          <h1>Projects Library</h1>
          <p>Manage and organize your audio sessions.</p>
        </div>
        
        <div className={styles.controls}>
          <div className={styles.searchWrapper}>
            <svg className={styles.searchIcon} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input 
              type="text" 
              className={styles.searchInput} 
              placeholder="Search projects..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <button className={styles.filterBtn}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="21" y1="10" x2="3" y2="10"></line>
              <line x1="21" y1="6" x2="3" y2="6"></line>
              <line x1="21" y1="14" x2="3" y2="14"></line>
              <line x1="21" y1="18" x2="3" y2="18"></line>
            </svg>
            Sort by Date
          </button>
          
          <button className={styles.createBtn} onClick={() => setShowNewProjectForm(true)}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            Create Project
          </button>
        </div>
      </header>

      {/* Projects Grid */}
      <div className={styles.projectsGrid}>
        {filteredProjects.map((project) => (
          <ProjectCard 
            key={project.id}
            project={project}
            onClick={onProjectDetail}
            onEdit={() => handleEditClick(project)}
            onDelete={() => handleDeleteProject(project.id)}
            // TODO: count real recordings
            recordingCount={Math.floor(Math.random() * 10)} 
          />
        ))}
        <CreateProjectCard onClick={() => setShowNewProjectForm(true)} />
      </div>

      {/* Recent Uploads Section */}
      <div className={styles.recentSection}>
        <div className={styles.recentHeader}>
          <h2 className={styles.sectionTitle}>Recent Uploads</h2>
          <a href="#" className={styles.viewAllLink} onClick={(e) => e.preventDefault()}>View All</a>
        </div>
        <RecentUploadsTable recordings={recentRecordings} />
      </div>

      {/* Modal Nuevo Proyecto */}
      {showNewProjectForm && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <h3 className={styles.modalTitle}>New Project</h3>
            <div className={styles.formGroup}>
              <label className={styles.label}>Name</label>
              <input 
                type="text" 
                className={styles.input} 
                value={newProjectName} 
                onChange={(e) => setNewProjectName(e.target.value)} 
                placeholder="Project name"
                autoFocus
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.label}>Description</label>
              <textarea 
                className={styles.textarea} 
                rows={3} 
                value={newProjectDescription} 
                onChange={(e) => setNewProjectDescription(e.target.value)}
                placeholder="Brief description of the project"
              />
            </div>
            <div className={styles.buttonGroup}>
              <button className={styles.cancelBtn} onClick={() => setShowNewProjectForm(false)}>
                Cancel
              </button>
              <button 
                className={styles.confirmBtn} 
                onClick={handleCreateProject}
                disabled={!newProjectName.trim()}
              >
                Create Project
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Editar Proyecto */}
      {showEditProjectForm && editingProject && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <h3 className={styles.modalTitle}>Edit Project</h3>
            <div className={styles.formGroup}>
              <label className={styles.label}>Name</label>
              <input 
                type="text" 
                className={styles.input} 
                value={editingProject.name} 
                onChange={(e) => setEditingProject({ ...editingProject, name: e.target.value })} 
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.label}>Description</label>
              <textarea 
                className={styles.textarea} 
                rows={3} 
                value={editingProject.description} 
                onChange={(e) => setEditingProject({ ...editingProject, description: e.target.value })}
              />
            </div>
            <div className={styles.buttonGroup}>
              <button className={styles.cancelBtn} onClick={() => setShowEditProjectForm(false)}>
                Cancel
              </button>
              <button 
                className={styles.confirmBtn} 
                onClick={handleUpdateProject}
                disabled={!editingProject.name.trim()}
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
