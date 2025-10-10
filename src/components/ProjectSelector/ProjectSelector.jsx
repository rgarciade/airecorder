import React, { useState, useEffect } from 'react';
import projectsService from '../../services/projectsService';
import './ProjectSelector.module.css';

export default function ProjectSelector({ onSelect, onCancel, selectedProjectId = null }) {
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

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-[#221112] border border-[#472426] rounded-xl p-6 max-w-md w-full mx-4">
        <h3 className="text-white text-xl font-bold mb-4">Seleccionar Proyecto</h3>
        
        {error && (
          <div className="bg-red-500 bg-opacity-20 border border-red-500 text-red-400 rounded-lg p-3 mb-4">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-white text-center py-8">Cargando proyectos...</div>
        ) : (
          <>
            {!showNewProjectForm ? (
              <>
                <div className="mb-4 max-h-60 overflow-y-auto">
                  <div className="space-y-2">
                    {projects.map((project) => (
                      <div
                        key={project.id}
                        onClick={() => setSelectedProject(project.id)}
                        className={`cursor-pointer p-3 rounded-lg border transition-colors ${
                          selectedProject === project.id
                            ? 'border-[#e92932] bg-[#331a1b]'
                            : 'border-[#472426] bg-[#221112] hover:bg-[#331a1b]'
                        }`}
                      >
                        <div className="text-white font-medium">{project.name}</div>
                        {project.description && (
                          <div className="text-[#c89295] text-sm mt-1">{project.description}</div>
                        )}
                      </div>
                    ))}
                    {projects.length === 0 && (
                      <div className="text-[#c89295] text-center py-4">
                        No hay proyectos. Crea uno nuevo.
                      </div>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => setShowNewProjectForm(true)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-[#331a1b] text-[#c89295] rounded-lg hover:bg-[#472426] hover:text-white transition-colors mb-4"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 256 256">
                    <path d="M224,128a8,8,0,0,1-8,8H136v80a8,8,0,0,1-16,0V136H40a8,8,0,0,1,0-16h80V40a8,8,0,0,1,16,0v80h80A8,8,0,0,1,224,128Z"></path>
                  </svg>
                  <span>Nuevo Proyecto</span>
                </button>

                <div className="flex gap-3">
                  <button
                    onClick={handleSelectProject}
                    disabled={!selectedProject}
                    className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                      selectedProject
                        ? 'bg-[#e92932] text-white hover:bg-[#d41f27]'
                        : 'bg-[#472426] text-[#c89295] cursor-not-allowed'
                    }`}
                  >
                    Seleccionar
                  </button>
                  <button
                    onClick={handleNoProject}
                    className="flex-1 px-4 py-2 bg-[#331a1b] text-white rounded-lg hover:bg-[#472426] transition-colors"
                  >
                    Sin Proyecto
                  </button>
                  <button
                    onClick={onCancel}
                    className="flex-1 px-4 py-2 bg-[#472426] text-white rounded-lg hover:bg-[#663336] transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="space-y-3 mb-4">
                  <div>
                    <label className="block text-[#c89295] text-sm mb-1">Nombre del proyecto*</label>
                    <input
                      type="text"
                      value={newProjectName}
                      onChange={(e) => setNewProjectName(e.target.value)}
                      placeholder="Ej: Proyecto Cliente ABC"
                      className="w-full px-3 py-2 text-white bg-[#331a1b] border border-[#472426] rounded-lg focus:outline-none focus:border-[#663336]"
                      onKeyPress={(e) => e.key === 'Enter' && handleCreateProject()}
                    />
                  </div>
                  <div>
                    <label className="block text-[#c89295] text-sm mb-1">Descripción (opcional)</label>
                    <textarea
                      value={newProjectDescription}
                      onChange={(e) => setNewProjectDescription(e.target.value)}
                      placeholder="Descripción del proyecto..."
                      rows={3}
                      className="w-full px-3 py-2 text-white bg-[#331a1b] border border-[#472426] rounded-lg focus:outline-none focus:border-[#663336]"
                    />
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={handleCreateProject}
                    disabled={!newProjectName.trim()}
                    className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                      newProjectName.trim()
                        ? 'bg-[#e92932] text-white hover:bg-[#d41f27]'
                        : 'bg-[#472426] text-[#c89295] cursor-not-allowed'
                    }`}
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
                    className="flex-1 px-4 py-2 bg-[#472426] text-white rounded-lg hover:bg-[#663336] transition-colors"
                  >
                    Volver
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

