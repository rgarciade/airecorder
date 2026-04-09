import { useState, useCallback } from 'react';

/**
 * Hook para gestionar la navegación y el estado de las vistas de la aplicación.
 */
export const useNavigation = () => {
  const [currentView, setCurrentView] = useState('loading');
  const [selectedRecording, setSelectedRecording] = useState(null);
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [selectedProject, setSelectedProject] = useState(null);
  const [settingsInitialTab, setSettingsInitialTab] = useState('agents');

  /**
   * Navegación avanzada a una grabación específica, buscando su objeto completo.
   */
  const handleNavigateToRecording = useCallback(async (recordingId, timestamp = null) => {
    try {
      const { default: recordingsService } = await import('../services/recordingsService');
      const recordings = await recordingsService.getRecordings();
      
      const recording = recordings.find(r => 
        r.dbId === recordingId || 
        r.id === recordingId || 
        r.name === recordingId
      );
      
      if (recording) {
        setSelectedRecording({
          ...recording,
          initialTimestamp: timestamp || null,
        });
        setCurrentView('recording-detail');
        setSettingsInitialTab('agents');
      } else {
        console.error('[useNavigation] No se pudo encontrar la grabación con ID:', recordingId);
      }
    } catch (error) {
      console.error('[useNavigation] Error navegando a la grabación:', error);
    }
  }, []);

  const handleNavigateToProject = useCallback((project) => {
    setSelectedProject(project);
    setSelectedProjectId(project.id);
    setCurrentView('project-detail');
    setSettingsInitialTab('agents');
  }, []);

  const handleBack = useCallback(() => {
    if (currentView === 'recording-detail' && selectedProject) {
      setCurrentView('project-detail');
      setSelectedRecording(null);
    } else {
      setCurrentView('home');
      setSelectedRecording(null);
      setSelectedProject(null);
      setSelectedProjectId(null);
      setSettingsInitialTab('agents');
    }
  }, [currentView, selectedProject]);

  const navigateTo = useCallback((view) => {
    setCurrentView(view);
    if (view !== 'settings') {
      setSettingsInitialTab('agents');
    }
    if (view === 'home') {
      setSelectedRecording(null);
      setSelectedProject(null);
      setSelectedProjectId(null);
    }
  }, []);

  const handleOpenSettings = useCallback((tab = 'agents') => {
    setSettingsInitialTab(tab);
    setCurrentView('settings');
  }, []);

  /**
   * Helper simple para seleccionar una grabación y navegar al detalle.
   */
  const handleSelectRecording = useCallback((recording) => {
    setSelectedRecording(recording);
    setCurrentView('recording-detail');
    setSettingsInitialTab('agents');
  }, []);

  return {
    currentView,
    setCurrentView,
    selectedRecording,
    setSelectedRecording,
    selectedProjectId,
    selectedProject,
    settingsInitialTab,
    setSettingsInitialTab,
    handleNavigateToRecording,
    handleNavigateToProject,
    handleBack,
    navigateTo,
    handleOpenSettings,
    handleSelectRecording
  };
};

export default useNavigation;
