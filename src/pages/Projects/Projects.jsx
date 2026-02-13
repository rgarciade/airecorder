import React, { useState, useEffect } from 'react';
import projectsService from '../../services/projectsService';
import recordingsService from '../../services/recordingsService';
import styles from './Projects.module.css';
import { MdChevronLeft, MdChevronRight, MdClose } from 'react-icons/md';

import ProjectCard from './components/ProjectCard';
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

  // Assignment confirmation state
  const [pendingAssignment, setPendingAssignment] = useState(null);
  const [confirmationModal, setConfirmationModal] = useState(null); // { title, message, onConfirm, actionText, isDestructive }

  // View All & Pagination state
  const [showAllRecordings, setShowAllRecordings] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const [currentProjectPage, setCurrentProjectPage] = useState(1);
  const projectsPerPage = 5;

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

  const handleDeleteProject = (project) => {
    setConfirmationModal({
      title: 'Delete Project?',
      message: `Are you sure you want to delete "${project.name}"? Recordings will not be deleted.`,
      actionText: 'Delete Project',
      isDestructive: true,
      onConfirm: async () => {
        try {
          await projectsService.deleteProject(project.id);
          setProjects(projects.filter(p => p.id !== project.id));
          setConfirmationModal(null);
        } catch (error) {
          console.error('Error eliminando proyecto:', error);
        }
      }
    });
  };

  const executeAssignment = async (recordingId, projectId) => {
    try {
      await projectsService.addRecordingToProject(projectId, recordingId);
      // Reload everything to ensure counts and projects are updated
      await loadData();
      setPendingAssignment(null);
    } catch (error) {
      console.error('Error vinculando grabación al proyecto:', error);
    }
  };

  const handleConfirmAssignment = () => {
    if (pendingAssignment) {
      executeAssignment(pendingAssignment.recording.dbId, pendingAssignment.newProject.id);
    }
  };

  const handleCancelAssignment = () => {
    setPendingAssignment(null);
  };

  const handleRemoveFromProject = (recording) => {
    if (!recording.project) return;
    
    setConfirmationModal({
      title: 'Unassign from Project?',
      message: `Are you sure you want to unassign "${recording.name}" from project "${recording.project.name}"?`,
      actionText: 'Unassign',
      isDestructive: true,
      onConfirm: async () => {
        try {
          await projectsService.removeRecordingFromProject(recording.project.id, recording.dbId);
          await loadData();
          setConfirmationModal(null);
        } catch (error) {
          console.error('Error desvinculando grabación del proyecto:', error);
        }
      }
    });
  };

  const handleAddToProject = (recording, project) => {
    // If it's already in THIS project, do nothing
    if (recording.project?.id === project.id) return;

    // If it's in ANOTHER project, ask for confirmation
    if (recording.project) {
      setPendingAssignment({
        recording,
        newProject: project
      });
    } else {
      // Direct assignment
      executeAssignment(recording.dbId, project.id);
    }
  };

  // Filtrado de proyectos
  const filteredProjects = projects.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Grabaciones ordenadas por fecha
  const sortedRecordings = [...recordings].sort((a, b) => 
    new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date)
  );

  // Grabaciones recientes (últimas 5)
  const recentRecordings = sortedRecordings.slice(0, 5);

  // Grabaciones paginadas para "View All"
  const totalPages = Math.ceil(sortedRecordings.length / itemsPerPage);
  const paginatedRecordings = sortedRecordings.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Proyectos paginados
  const totalProjectPages = Math.ceil(filteredProjects.length / projectsPerPage);
  const paginatedProjects = filteredProjects.slice(
    (currentProjectPage - 1) * projectsPerPage,
    currentProjectPage * projectsPerPage
  );

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
      {!showAllRecordings && (
        <>
          <div className={styles.projectsGrid}>
            {paginatedProjects.map((project) => (
              <ProjectCard 
                key={project.id}
                project={project}
                onClick={onProjectDetail}
                onEdit={() => handleEditClick(project)}
                onDelete={() => handleDeleteProject(project)}
                recordingCount={recordings.filter(r => r.project?.id === project.id).length} 
              />
            ))}
          </div>

          {totalProjectPages > 1 && (
            <div className={styles.pagination}>
              <button 
                className={styles.pageBtn} 
                disabled={currentProjectPage === 1}
                onClick={() => setCurrentProjectPage(prev => prev - 1)}
              >
                <MdChevronLeft size={20} />
              </button>
              <span className={styles.pageInfo}>
                Page {currentProjectPage} of {totalProjectPages}
              </span>
              <button 
                className={styles.pageBtn} 
                disabled={currentProjectPage === totalProjectPages}
                onClick={() => setCurrentProjectPage(prev => prev + 1)}
              >
                <MdChevronRight size={20} />
              </button>
            </div>
          )}
        </>
      )}

      {/* Recent Uploads Section / Full Table */}
      <div className={styles.recentSection}>
        <div className={styles.recentHeader}>
          <h2 className={styles.sectionTitle}>
            {showAllRecordings ? 'All Recordings' : 'Recent Uploads'}
          </h2>
          {showAllRecordings ? (
            <button 
              className={styles.closeViewAll} 
              onClick={() => setShowAllRecordings(false)}
            >
              <MdClose size={20} /> Close
            </button>
          ) : (
            <a 
              href="#" 
              className={styles.viewAllLink} 
              onClick={(e) => {
                e.preventDefault();
                setShowAllRecordings(true);
                setCurrentPage(1);
              }}
            >
              View All
            </a>
          )}
        </div>
        
        <RecentUploadsTable 
          recordings={showAllRecordings ? paginatedRecordings : recentRecordings} 
          projects={projects}
          onAddToProject={handleAddToProject}
          onRemoveFromProject={handleRemoveFromProject}
        />

        {showAllRecordings && totalPages > 1 && (
          <div className={styles.pagination}>
            <button 
              className={styles.pageBtn} 
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(prev => prev - 1)}
            >
              <MdChevronLeft size={20} />
            </button>
            <span className={styles.pageInfo}>
              Page {currentPage} of {totalPages}
            </span>
            <button 
              className={styles.pageBtn} 
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(prev => prev + 1)}
            >
              <MdChevronRight size={20} />
            </button>
          </div>
        )}
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

      {/* Modal Confirmación de Cambio de Proyecto */}
      {pendingAssignment && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <h3 className={styles.modalTitle}>Change Project?</h3>
            <p className={styles.modalText}>
              The recording <strong>"{pendingAssignment.recording.name}"</strong> is already assigned to the project 
              <strong> "{pendingAssignment.recording.project.name}"</strong>.
            </p>
            <p className={styles.modalText}>
              Do you want to move it to <strong>"{pendingAssignment.newProject.name}"</strong>?
            </p>
            <div className={styles.buttonGroup}>
              <button className={styles.cancelBtn} onClick={handleCancelAssignment}>
                Cancel
              </button>
              <button 
                className={styles.confirmBtn} 
                onClick={handleConfirmAssignment}
              >
                Change Project
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Modal Confirmación Genérico */}
      {confirmationModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <h3 className={styles.modalTitle}>{confirmationModal.title}</h3>
            <p className={styles.modalText}>{confirmationModal.message}</p>
            <div className={styles.buttonGroup}>
              <button 
                className={styles.cancelBtn} 
                onClick={() => setConfirmationModal(null)}
              >
                Cancel
              </button>
              <button 
                className={confirmationModal.isDestructive ? styles.destructiveBtn : styles.confirmBtn} 
                onClick={confirmationModal.onConfirm}
              >
                {confirmationModal.actionText || 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
