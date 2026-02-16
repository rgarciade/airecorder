import React, { createContext, useContext, useState, useCallback } from 'react';
import recordingsService from '../services/recordingsService';
import projectAiService from '../services/projectAiService';

const AiProcessingContext = createContext();

export const useAiProcessing = () => {
    const context = useContext(AiProcessingContext);
    if (!context) {
        throw new Error('useAiProcessing must be used within an AiProcessingProvider');
    }
    return context;
};

export const AiProcessingProvider = ({ children }) => {
    // Estado de tareas activas: { [id]: { type: 'recording' | 'project', status: 'analyzing' | 'completed' | 'error', error: null } }
    const [tasks, setTasks] = useState({});

    const updateTaskStatus = useCallback((id, status, error = null) => {
        setTasks(prev => ({
            ...prev,
            [id]: { ...prev[id], status, error }
        }));
    }, []);

    const getTaskStatus = useCallback((id) => {
        return tasks[id]?.status || 'idle';
    }, [tasks]);

    /**
     * Inicia el análisis de una grabación en segundo plano
     * @param {string} recordingId 
     * @param {string} transcriptionTxt - Texto de la transcripción (opcional, si no se pasa se busca)
     */
    const startRecordingAnalysis = useCallback(async (recordingId, transcriptionTxt = null) => {
        if (tasks[recordingId]?.status === 'analyzing') return;

        setTasks(prev => ({
            ...prev,
            [recordingId]: { type: 'recording', status: 'analyzing', error: null }
        }));

        try {
            // Delegamos la lógica pesada al servicio, pero gestionamos el estado aquí
            // Nota: recordingsService necesitará un método que haga todo el proceso sin depender de estados de React locales
            // Por ahora, asumiremos que recordingsService.generateFullAnalysis existe o lo crearemos
            await recordingsService.generateFullAnalysis(recordingId, transcriptionTxt);

            updateTaskStatus(recordingId, 'completed');
        } catch (error) {
            console.error(`Error analyzing recording ${recordingId}:`, error);
            updateTaskStatus(recordingId, 'error', error.message);
        }
    }, [tasks, updateTaskStatus]);

    /**
     * Inicia el análisis de un proyecto en segundo plano
     * @param {string} projectId 
     */
    const startProjectAnalysis = useCallback(async (projectId) => {
        if (tasks[projectId]?.status === 'analyzing') return;

        setTasks(prev => ({
            ...prev,
            [projectId]: { type: 'project', status: 'analyzing', error: null }
        }));

        try {
            await projectAiService.generateProjectAnalysis(projectId);
            updateTaskStatus(projectId, 'completed');
        } catch (error) {
            console.error(`Error analyzing project ${projectId}:`, error);
            updateTaskStatus(projectId, 'error', error.message);
        }
    }, [tasks, updateTaskStatus]);

    const value = {
        tasks,
        getTaskStatus,
        startRecordingAnalysis,
        startProjectAnalysis
    };

    return (
        <AiProcessingContext.Provider value={value}>
            {children}
        </AiProcessingContext.Provider>
    );
};
