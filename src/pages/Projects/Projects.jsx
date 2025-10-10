import React, { useState, useEffect } from 'react';
import projectsService from '../../services/projectsService';
import recordingsService from '../../services/recordingsService';

export default function Projects({ onBack, onRecordingSelect, initialProjectId = null }) {
  const [projects, setProjects] = useState([]);
  const [recordings, setRecordings] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [projectRecordings, setProjectRecordings] = useState([]);
  const [showNewProjectForm, setShowNewProjectForm] = useState(false);
  const [showEditProjectForm, setShowEditProjectForm] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDescription, setNewProjectDescription] = useState('');
  const [editingProject, setEditingProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddRecordingModal, setShowAddRecordingModal] = useState(false);
  const [reassignConfirm, setReassignConfirm] = useState(null); // { recording, previousProject }

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (selectedProject) {
      loadProjectRecordings(selectedProject.id);
    }
  }, [selectedProject]);

  useEffect(() => {
    if (initialProjectId && projects.length > 0) {
      const project = projects.find(p => p.id === initialProjectId);
      if (project) {
        setSelectedProject(project);
      }
    }
  }, [initialProjectId, projects]);

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

  const loadProjectRecordings = async (projectId) => {
    try {
      const recordingIds = await projectsService.getProjectRecordings(projectId);
      const projectRecsList = recordings.filter(r => recordingIds.includes(r.id));
      setProjectRecordings(projectRecsList);
    } catch (error) {
      console.error('Error cargando grabaciones del proyecto:', error);
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
      if (selectedProject?.id === updatedProject.id) {
        setSelectedProject(updatedProject);
      }
      setEditingProject(null);
      setShowEditProjectForm(false);
    } catch (error) {
      console.error('Error actualizando proyecto:', error);
    }
  };

  const handleDeleteProject = async (projectId) => {
    if (!confirm('¿Estás seguro de que quieres eliminar este proyecto? Las grabaciones no se eliminarán.')) {
      return;
    }
    
    try {
      await projectsService.deleteProject(projectId);
      setProjects(projects.filter(p => p.id !== projectId));
      if (selectedProject?.id === projectId) {
        setSelectedProject(null);
        setProjectRecordings([]);
      }
    } catch (error) {
      console.error('Error eliminando proyecto:', error);
    }
  };

  const handleAddRecordingToProject = async (recordingId, skipConfirmation = false) => {
    if (!selectedProject) return;
    
    try {
      // Si ya tenemos confirmación, proceder directamente
      if (skipConfirmation && reassignConfirm) {
        await projectsService.addRecordingToProject(selectedProject.id, recordingId);
        loadProjectRecordings(selectedProject.id);
        setShowAddRecordingModal(false);
        setReassignConfirm(null);
        return;
      }
      
      const result = await projectsService.addRecordingToProject(selectedProject.id, recordingId);
      
      // Si fue reasignado, mostrar confirmación
      if (result.wasReassigned && result.previousProject) {
        const recording = recordings.find(r => r.id === recordingId);
        setReassignConfirm({
          recording,
          previousProject: result.previousProject,
          recordingId
        });
        return;
      }
      
      loadProjectRecordings(selectedProject.id);
      setShowAddRecordingModal(false);
    } catch (error) {
      console.error('Error agregando grabación al proyecto:', error);
    }
  };
  
  const handleConfirmReassign = async () => {
    if (reassignConfirm) {
      await handleAddRecordingToProject(reassignConfirm.recordingId, true);
    }
  };
  
  const handleCancelReassign = () => {
    setReassignConfirm(null);
  };

  const handleRemoveRecordingFromProject = async (recordingId) => {
    if (!selectedProject) return;
    
    try {
      await projectsService.removeRecordingFromProject(selectedProject.id, recordingId);
      setProjectRecordings(projectRecordings.filter(r => r.id !== recordingId));
    } catch (error) {
      console.error('Error eliminando grabación del proyecto:', error);
    }
  };

  const filteredRecordings = recordings.filter(r => {
    const matchesSearch = r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         r.id.toLowerCase().includes(searchTerm.toLowerCase());
    const notInProject = !projectRecordings.find(pr => pr.id === r.id);
    return matchesSearch && notInProject;
  });

  return (
    <div className="flex min-h-screen flex-col bg-[#221112]" style={{ fontFamily: '"Plus Jakarta Sans", "Noto Sans", sans-serif' }}>
      {/* Header */}
      <header className="flex items-center justify-between whitespace-nowrap border-b border-solid border-b-[#472426] px-10 py-3">
        <div className="flex items-center gap-4 text-white">
          <div className="size-4">
            <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M42.4379 44C42.4379 44 36.0744 33.9038 41.1692 24C46.8624 12.9336 42.2078 4 42.2078 4L7.01134 4C7.01134 4 11.6577 12.932 5.96912 23.9969C0.876273 33.9029 7.27094 44 7.27094 44L42.4379 44Z" fill="currentColor"></path>
            </svg>
          </div>
          <h2 className="text-white text-lg font-bold leading-tight tracking-[-0.015em]">Gestión de Proyectos</h2>
        </div>
        <button onClick={onBack} className="flex cursor-pointer items-center justify-center overflow-hidden rounded-full h-10 bg-[#472426] text-white gap-2 text-sm font-bold leading-normal tracking-[0.015em] px-2.5">
          <span>Volver</span>
        </button>
      </header>

      {/* Main Content */}
      <div className="flex flex-1 gap-4 p-6">
        {/* Lista de Proyectos */}
        <div className="w-1/3 bg-[#221112] border border-[#472426] rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white text-xl font-bold">Proyectos</h3>
            <button onClick={() => setShowNewProjectForm(true)} className="px-3 py-2 bg-[#e92932] text-white rounded-lg hover:bg-[#d41f27] transition-colors">
              + Nuevo
            </button>
          </div>

          {loading ? (
            <div className="text-white text-center py-8">Cargando...</div>
          ) : (
            <div className="space-y-2 max-h-[calc(100vh-200px)] overflow-y-auto">
              {projects.map((project) => (
                <div key={project.id} onClick={() => setSelectedProject(project)} className={`cursor-pointer p-3 rounded-lg border transition-colors ${selectedProject?.id === project.id ? 'border-[#e92932] bg-[#331a1b]' : 'border-[#472426] hover:bg-[#331a1b]'}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="text-white font-medium">{project.name}</div>
                      {project.description && <div className="text-[#c89295] text-sm mt-1">{project.description}</div>}
                    </div>
                    <div className="flex gap-2">
                      <button onClick={(e) => { e.stopPropagation(); setEditingProject(project); setShowEditProjectForm(true); }} className="text-[#c89295] hover:text-white p-1">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 256 256">
                          <path d="M227.31,73.37,182.63,28.68a16,16,0,0,0-22.63,0L36.69,152A15.86,15.86,0,0,0,32,163.31V208a16,16,0,0,0,16,16H92.69A15.86,15.86,0,0,0,104,219.31L227.31,96a16,16,0,0,0,0-22.63ZM92.69,208H48V163.31l88-88L180.69,120ZM192,108.68,147.31,64l24-24L216,84.68Z"></path>
                        </svg>
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); handleDeleteProject(project.id); }} className="text-[#c89295] hover:text-[#e92932] p-1">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 256 256">
                          <path d="M216,48H176V40a24,24,0,0,0-24-24H104A24,24,0,0,0,80,40v8H40a8,8,0,0,0,0,16h8V208a16,16,0,0,0,16,16H192a16,16,0,0,0,16-16V64h8a8,8,0,0,0,0-16ZM96,40a8,8,0,0,1,8-8h48a8,8,0,0,1,8,8v8H96Zm96,168H64V64H192ZM112,104v64a8,8,0,0,1-16,0V104a8,8,0,0,1,16,0Zm48,0v64a8,8,0,0,1-16,0V104a8,8,0,0,1,16,0Z"></path>
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {projects.length === 0 && <div className="text-[#c89295] text-center py-8">No hay proyectos. Crea uno nuevo.</div>}
            </div>
          )}
        </div>

        {/* Detalles del Proyecto y Grabaciones */}
        <div className="flex-1 bg-[#221112] border border-[#472426] rounded-xl p-4">
          {selectedProject ? (
            <>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-white text-2xl font-bold">{selectedProject.name}</h3>
                  {selectedProject.description && <p className="text-[#c89295] mt-1">{selectedProject.description}</p>}
                </div>
                <button onClick={() => setShowAddRecordingModal(true)} className="px-3 py-2 bg-[#e92932] text-white rounded-lg hover:bg-[#d41f27] transition-colors">
                  + Agregar Grabación
                </button>
              </div>

              <h4 className="text-white text-lg font-bold mb-3">Grabaciones del Proyecto</h4>
              <div className="space-y-2 max-h-[calc(100vh-280px)] overflow-y-auto">
                {projectRecordings.map((recording) => (
                  <div key={recording.id} className="flex items-center justify-between p-3 bg-[#331a1b] border border-[#472426] rounded-lg hover:bg-[#3d2122] transition-colors">
                    <div className="flex-1">
                      <div className="text-white font-medium">{recording.name}</div>
                      <div className="text-[#c89295] text-sm">{recording.date}</div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => onRecordingSelect && onRecordingSelect(recording)} className="px-3 py-1 bg-[#472426] text-white rounded hover:bg-[#663336] transition-colors">
                        Ver
                      </button>
                      <button onClick={() => handleRemoveRecordingFromProject(recording.id)} className="text-[#c89295] hover:text-[#e92932] p-1">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 256 256">
                          <path d="M205.66,194.34a8,8,0,0,1-11.32,11.32L128,139.31,61.66,205.66a8,8,0,0,1-11.32-11.32L116.69,128,50.34,61.66A8,8,0,0,1,61.66,50.34L128,116.69l66.34-66.35a8,8,0,0,1,11.32,11.32L139.31,128Z"></path>
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
                {projectRecordings.length === 0 && <div className="text-[#c89295] text-center py-8">No hay grabaciones en este proyecto.</div>}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-[#c89295] text-center">
                <svg className="mx-auto mb-4" xmlns="http://www.w3.org/2000/svg" width="64" height="64" fill="currentColor" viewBox="0 0 256 256">
                  <path d="M216,40H40A16,16,0,0,0,24,56V200a16,16,0,0,0,16,16H216a16,16,0,0,0,16-16V56A16,16,0,0,0,216,40Zm0,16V88H40V56Zm0,144H40V104H216v96Z"></path>
                </svg>
                <p className="text-lg">Selecciona un proyecto para ver sus detalles</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal Nuevo Proyecto */}
      {showNewProjectForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-[#221112] border border-[#472426] rounded-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-white text-xl font-bold mb-4">Nuevo Proyecto</h3>
            <div className="space-y-3 mb-4">
              <div>
                <label className="block text-[#c89295] text-sm mb-1">Nombre*</label>
                <input type="text" value={newProjectName} onChange={(e) => setNewProjectName(e.target.value)} placeholder="Nombre del proyecto" className="w-full px-3 py-2 text-white bg-[#331a1b] border border-[#472426] rounded-lg focus:outline-none focus:border-[#663336]" />
              </div>
              <div>
                <label className="block text-[#c89295] text-sm mb-1">Descripción</label>
                <textarea value={newProjectDescription} onChange={(e) => setNewProjectDescription(e.target.value)} placeholder="Descripción del proyecto" rows={3} className="w-full px-3 py-2 text-white bg-[#331a1b] border border-[#472426] rounded-lg focus:outline-none focus:border-[#663336]" />
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={handleCreateProject} disabled={!newProjectName.trim()} className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${newProjectName.trim() ? 'bg-[#e92932] text-white hover:bg-[#d41f27]' : 'bg-[#472426] text-[#c89295] cursor-not-allowed'}`}>
                Crear
              </button>
              <button onClick={() => { setShowNewProjectForm(false); setNewProjectName(''); setNewProjectDescription(''); }} className="flex-1 px-4 py-2 bg-[#472426] text-white rounded-lg hover:bg-[#663336] transition-colors">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Editar Proyecto */}
      {showEditProjectForm && editingProject && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-[#221112] border border-[#472426] rounded-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-white text-xl font-bold mb-4">Editar Proyecto</h3>
            <div className="space-y-3 mb-4">
              <div>
                <label className="block text-[#c89295] text-sm mb-1">Nombre*</label>
                <input type="text" value={editingProject.name} onChange={(e) => setEditingProject({ ...editingProject, name: e.target.value })} className="w-full px-3 py-2 text-white bg-[#331a1b] border border-[#472426] rounded-lg focus:outline-none focus:border-[#663336]" />
              </div>
              <div>
                <label className="block text-[#c89295] text-sm mb-1">Descripción</label>
                <textarea value={editingProject.description} onChange={(e) => setEditingProject({ ...editingProject, description: e.target.value })} rows={3} className="w-full px-3 py-2 text-white bg-[#331a1b] border border-[#472426] rounded-lg focus:outline-none focus:border-[#663336]" />
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={handleUpdateProject} disabled={!editingProject.name.trim()} className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${editingProject.name.trim() ? 'bg-[#e92932] text-white hover:bg-[#d41f27]' : 'bg-[#472426] text-[#c89295] cursor-not-allowed'}`}>
                Guardar
              </button>
              <button onClick={() => { setShowEditProjectForm(false); setEditingProject(null); }} className="flex-1 px-4 py-2 bg-[#472426] text-white rounded-lg hover:bg-[#663336] transition-colors">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Agregar Grabación */}
      {showAddRecordingModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-[#221112] border border-[#472426] rounded-xl p-6 max-w-2xl w-full mx-4">
            <h3 className="text-white text-xl font-bold mb-4">Agregar Grabación al Proyecto</h3>
            <div className="mb-4">
              <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Buscar grabaciones..." className="w-full px-3 py-2 text-white bg-[#331a1b] border border-[#472426] rounded-lg focus:outline-none focus:border-[#663336]" />
            </div>
            <div className="space-y-2 max-h-96 overflow-y-auto mb-4">
              {filteredRecordings.map((recording) => (
                <div key={recording.id} onClick={() => handleAddRecordingToProject(recording.id)} className="cursor-pointer flex items-center justify-between p-3 bg-[#331a1b] border border-[#472426] rounded-lg hover:bg-[#3d2122] transition-colors">
                  <div>
                    <div className="text-white font-medium">{recording.name}</div>
                    <div className="text-[#c89295] text-sm">{recording.date}</div>
                  </div>
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 256 256" className="text-[#e92932]">
                    <path d="M224,128a8,8,0,0,1-8,8H136v80a8,8,0,0,1-16,0V136H40a8,8,0,0,1,0-16h80V40a8,8,0,0,1,16,0v80h80A8,8,0,0,1,224,128Z"></path>
                  </svg>
                </div>
              ))}
              {filteredRecordings.length === 0 && <div className="text-[#c89295] text-center py-8">No hay grabaciones disponibles</div>}
            </div>
            <button onClick={() => { setShowAddRecordingModal(false); setSearchTerm(''); }} className="w-full px-4 py-2 bg-[#472426] text-white rounded-lg hover:bg-[#663336] transition-colors">
              Cerrar
            </button>
          </div>
        </div>
      )}

      {/* Modal de Confirmación de Reasignación */}
      {reassignConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-[#221112] border border-[#472426] rounded-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-white text-xl font-bold mb-4">⚠️ Reasignar Grabación</h3>
            <p className="text-white mb-4">
              La grabación <span className="font-bold text-[#e92932]">"{reassignConfirm.recording?.name}"</span> ya pertenece al proyecto:
            </p>
            <div className="bg-[#331a1b] border border-[#472426] rounded-lg p-3 mb-4">
              <div className="text-[#8b5cf6] font-bold">{reassignConfirm.previousProject.name}</div>
              {reassignConfirm.previousProject.description && (
                <div className="text-[#c89295] text-sm mt-1">{reassignConfirm.previousProject.description}</div>
              )}
            </div>
            <p className="text-[#c89295] mb-6">
              ¿Deseas moverla al proyecto actual <span className="font-bold text-white">"{selectedProject?.name}"</span>?
            </p>
            <div className="flex gap-3">
              <button onClick={handleCancelReassign} className="flex-1 px-4 py-2 bg-[#472426] text-white rounded-lg hover:bg-[#663336] transition-colors">
                Cancelar
              </button>
              <button onClick={handleConfirmReassign} className="flex-1 px-4 py-2 bg-[#e92932] text-white rounded-lg hover:bg-[#d41f27] transition-colors">
                Mover a "{selectedProject?.name}"
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

