import React, { useState, useEffect } from 'react';
import recordingsService from '../../services/recordingsService';
import projectsService from '../../services/projectsService';
import { getSettings, updateSettings } from '../../services/settingsService';
import { getAvailableModels } from '../../services/ai/ollamaProvider';
import { generateWithContext } from '../../services/aiService';
import { chatQuestionPrompt } from '../../prompts/aiPrompts';
import recordingAiService from '../../services/recordingAiService';

import styles from './RecordingDetail.module.css';
import OverviewTab from './components/OverviewTab/OverviewTab';
import TranscriptionChatTab from './components/TranscriptionChatTab/TranscriptionChatTab';
import EpicsTab from './components/EpicsTab/EpicsTab';

// Icons
import { 
  MdArrowBack, 
  MdEdit, 
  MdDeleteOutline,
  MdCheck, 
  MdClose, 
  MdAutorenew, 
  MdShare, 
  MdFileDownload,
  MdCalendarToday,
  MdAccessTime,
  MdFolderOpen,
  MdTranslate
} from 'react-icons/md';

const whisperModels = [
  { value: 'tiny', label: 'Tiny (Fastest)' },
  { value: 'base', label: 'Base' },
  { value: 'small', label: 'Small (Recommended)' },
  { value: 'medium', label: 'Medium' },
  { value: 'large', label: 'Large (Precise)' },
];

export default function RecordingDetailWithTranscription({ recording, onBack, onNavigateToProject }) {
  // --- STATE MANAGEMENT ---
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'transcription' | 'tasks'
  
  // Data State
  const [localRecording, setLocalRecording] = useState(recording);
  const [participants, setParticipants] = useState(recording?.participants || []);
  const [transcription, setTranscription] = useState(null);
  const [transcriptionLoading, setTranscriptionLoading] = useState(false);
  const [transcriptionError, setTranscriptionError] = useState(null);
  
  // AI Summary State
  const [geminiData, setGeminiData] = useState({ resumen_breve: '', ideas: [] });
  const [detailedSummary, setDetailedSummary] = useState('');
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);

  // Tasks State
  const [tasks, setTasks] = useState([]);
  const [isGeneratingTasks, setIsGeneratingTasks] = useState(false);
  const [improvingTaskId, setImprovingTaskId] = useState(null);
  const [newTaskIds, setNewTaskIds] = useState(new Set());

  // Chat State
  const [qaHistory, setQaHistory] = useState([]);
  const [questionLoading, setQuestionLoading] = useState(false);
  const [aiProvider, setAiProvider] = useState('gemini');
  const [ollamaModels, setOllamaModels] = useState([]);
  const [selectedOllamaModel, setSelectedOllamaModel] = useState('');

  // Editing Title
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState(recording?.name || '');
  const [localName, setLocalName] = useState(recording?.name || '');

  // Delete Modal
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Regenerate Modal
  const [showRegenerateConfirm, setShowRegenerateConfirm] = useState(false);
  const [regenerateOptions, setRegenerateOptions] = useState({
    summaries: false,
    keyTopics: false,
    detailedSummary: false,
    participants: false
  });

  // Re-transcribe Modal
  const [showTranscribeModal, setShowTranscribeModal] = useState(false);
  const [selectedWhisperModel, setSelectedWhisperModel] = useState('small');

  // --- EFFECTS ---

  // 1. Load Initial Data (Transcription, AI Config, Project)
  useEffect(() => {
    if (!recording?.id) return;

    // Load Fresh Recording Data
    const loadRecordingData = async () => {
      try {
        const { default: recordingsService } = await import('../../services/recordingsService');
        const all = await recordingsService.getRecordings();
        const fresh = all.find(r => r.dbId === recording.dbId || r.id === recording.id);
        if (fresh) setLocalRecording(fresh);
      } catch (e) {
        console.error("Error fetching fresh recording data:", e);
      }
    };
    loadRecordingData();

    setLocalName(recording?.name || '');
    setEditedTitle(recording?.name || '');

    // Load Transcription
    setTranscriptionLoading(true);
    recordingsService.getTranscription(recording.id)
      .then(setTranscription)
      .catch(() => setTranscriptionError('Transcription not available'))
      .finally(() => setTranscriptionLoading(false));

    // Load Chat History
    recordingsService.getQuestionHistory(recording.id).then(setQaHistory);

    // Load AI Config
    getSettings().then(settings => {
      setAiProvider(settings.aiProvider || 'gemini');
      setSelectedWhisperModel(settings.whisperModel || 'small');
      if (settings.aiProvider === 'ollama') {
        getAvailableModels().then(models => setOllamaModels(models.map(m => m.name || m)));
        setSelectedOllamaModel(settings.ollamaModel || '');
      }
    });
  }, [recording]);

  // 2. Fetch Ollama models when provider changes to ollama
  useEffect(() => {
    if (aiProvider === 'ollama') {
      getAvailableModels()
        .then(models => {
          setOllamaModels(models.map(m => m.name || m));
          // If no model selected, select the first one
          if (!selectedOllamaModel && models.length > 0) {
            setSelectedOllamaModel(models[0].name || models[0]);
          }
        })
        .catch(err => console.error("Error fetching ollama models:", err));
    }
  }, [aiProvider]);

  // 3. Load or Generate Summaries & Participants
  useEffect(() => {
    const loadOrGenerate = async () => {
      if (!recording?.id) return;

      try {
        // Load Participants
        const savedParticipants = await recordingsService.getParticipants(recording.id);
        if (savedParticipants && savedParticipants.length > 0) {
          setParticipants(savedParticipants);
        }

        // Load Task Suggestions
        if (recording.dbId) {
          const savedTasks = await recordingsService.getTaskSuggestions(recording.dbId);
          if (savedTasks && savedTasks.length > 0) {
            setTasks(savedTasks);
          }
        }

        // Load Summary
        const existing = await recordingAiService.getRecordingSummary(recording.id);
        const hasSummary = existing && existing.resumen_breve;
        
        if (existing) {
          setGeminiData(existing);
          setDetailedSummary(existing.resumen_detallado || '');
        }

        // Trigger Auto-generation if missing and we have transcription
        // Check if transcription exists first to avoid errors
        let hasTranscription = false;
        try {
           // Quick check or rely on the previous load. 
           // We can check localRecording.status or fetch transcription check
           const tCheck = await recordingsService.getTranscription(recording.id);
           hasTranscription = !!tCheck;
        } catch (e) {
           hasTranscription = false;
        }

        if (hasTranscription && !hasSummary && !isGeneratingAi) {
           console.log("Auto-starting AI analysis...");
           setIsGeneratingAi(true);
           try {
             // Generate both summary and extract participants
             const summary = await recordingAiService.generateRecordingSummary(recording.id);
             if (summary) {
               setGeminiData(summary);
               setDetailedSummary(summary.resumen_detallado || '');
             }
             
             // Also try to extract participants if none exist
             if (!savedParticipants || savedParticipants.length === 0) {
                const newParticipants = await recordingAiService.extractParticipants(recording.id);
                if (newParticipants && newParticipants.length > 0) {
                    await recordingsService.saveParticipants(recording.id, newParticipants);
                    setParticipants(newParticipants);
                }
             }
           } catch (err) {
             console.error("Auto-generation failed:", err);
           } finally {
             setIsGeneratingAi(false);
           }
        }
      } catch (err) {
        console.error("Error loading recording details:", err);
      }
    };
    loadOrGenerate();
  }, [recording]);


  // --- HANDLERS ---

  const handleAskQuestion = async (questionText) => {
    setQuestionLoading(true);
    try {
      let context = detailedSummary;
      if (!context) {
        context = await recordingsService.getTranscriptionTxt(recording.id);
      }
      
      const prompt = chatQuestionPrompt(questionText);
      const response = await generateWithContext(prompt, context || "No context available.");
      
      const answer = response.text || 'No answer generated.';
      const qa = { pregunta: questionText, respuesta: answer, fecha: new Date().toISOString() };
      
      await recordingsService.saveQuestionHistory(recording.id, qa);
      setQaHistory(prev => [...prev, qa]);
    } catch (err) {
      console.error(err);
    } finally {
      setQuestionLoading(false);
    }
  };

  const convertChatHistory = () => {
    return qaHistory.flatMap((qa, i) => [
      { id: `u_${i}`, tipo: 'usuario', contenido: qa.pregunta, fecha: qa.fecha },
      { id: `a_${i}`, tipo: 'asistente', contenido: qa.respuesta, fecha: qa.fecha }
    ]);
  };

  const handleRegenerateClick = async () => {
    // Reset options
    setRegenerateOptions({
      summaries: true,
      keyTopics: true,
      detailedSummary: true,
      participants: false
    });

    // Refresh config
    try {
      const settings = await getSettings();
      setAiProvider(settings.aiProvider || 'gemini');
      setSelectedOllamaModel(settings.ollamaModel || '');
      
      if (settings.aiProvider === 'ollama' || !settings.aiProvider) {
        const models = await getAvailableModels();
        setOllamaModels(models.map(m => m.name || m));
      }
    } catch (e) {
      console.error("Error loading settings for regenerate modal:", e);
    }

    setShowRegenerateConfirm(true);
  };

  const handleToggleRegenerateOption = (option) => {
    setRegenerateOptions(prev => ({
      ...prev,
      [option]: !prev[option]
    }));
  };

  const handleConfirmRegenerate = async () => {
    const hasSelection = Object.values(regenerateOptions).some(v => v);
    if (!hasSelection) {
      alert('Please select at least one option to regenerate.');
      return;
    }

    setShowRegenerateConfirm(false);
    setIsGeneratingAi(true);
    
    try {
      // Update AI settings
      const currentSettings = await getSettings();
      await updateSettings({
        ...currentSettings,
        aiProvider: aiProvider,
        ollamaModel: aiProvider === 'ollama' ? selectedOllamaModel : currentSettings.ollamaModel
      });

      // Regenerate Summaries
      if (regenerateOptions.summaries || regenerateOptions.keyTopics || regenerateOptions.detailedSummary) {
        await recordingAiService.cancelGeneration(recording.id);
        
        const summary = await recordingAiService.generateRecordingSummary(
          recording.id,
          null, 
          true, // Force regenerate
          {
            summaries: regenerateOptions.summaries,
            keyTopics: regenerateOptions.keyTopics,
            detailedSummary: regenerateOptions.detailedSummary
          }
        );

        if (summary) {
          setGeminiData(summary);
          setDetailedSummary(summary.resumen_detallado || '');
        }
      }
      
      // Regenerate Participants
      if (regenerateOptions.participants) {
        // 1. Obtener nuevos participantes de IA
        const aiParticipants = await recordingAiService.extractParticipants(recording.id);
        
        // 2. Filtrar participantes manuales existentes (no creados por IA)
        const manualParticipants = participants.filter(p => !p.createdByAi);
        
        // 3. Fusión inteligente: Evitar duplicados por nombre
        const mergedParticipants = [...manualParticipants];
        
        aiParticipants.forEach(aiPart => {
          // Verificar si ya existe alguien con ese nombre (case insensitive) en la lista manual
          const exists = mergedParticipants.some(
            p => p.name.toLowerCase() === aiPart.name.toLowerCase()
          );
          
          if (!exists) {
            mergedParticipants.push(aiPart);
          }
        });
        
        await recordingsService.saveParticipants(recording.id, mergedParticipants);
        setParticipants(mergedParticipants);
      }

    } catch (error) {
      console.error("Error regenerando AI:", error);
      alert("Error al regenerar datos de IA: " + error.message);
    } finally {
      setIsGeneratingAi(false);
    }
  };

  // --- PARTICIPANT MANAGEMENT HANDLERS (Direct updates) ---

  const handleAddParticipant = async (newParticipantData) => {
    if (!newParticipantData || !newParticipantData.name) return;
    
    const newParticipant = {
      id: Date.now(),
      name: newParticipantData.name.trim(),
      role: newParticipantData.role.trim() || 'Participante',
      createdByAi: false,
      avatar_color: '#' + Math.floor(Math.random()*16777215).toString(16) // Random color
    };
    
    // Optimistic update
    const updated = [...participants, newParticipant];
    setParticipants(updated);
    
    try {
      const success = await recordingsService.saveParticipants(recording.id, updated);
      if (!success) {
        console.error("Failed to save participants to backend");
        // Revert or show error? For now, we trust optimistic.
      } else {
        // Optional: Reload to be sure
        // const confirmed = await recordingsService.getParticipants(recording.id);
        // setParticipants(confirmed);
      }
    } catch (error) {
      console.error("Error saving participant:", error);
    }
  };

  const handleRemoveParticipant = async (participantId) => {
    const updated = participants.filter(p => p.id !== participantId);
    setParticipants(updated);
    try {
      await recordingsService.saveParticipants(recording.id, updated);
    } catch (error) {
      console.error("Error removing participant:", error);
    }
  };

  const handleUpdateParticipant = async (participantId, updatedData) => {
    const updated = participants.map(p => {
      if (p.id === participantId) {
        return {
          ...p,
          name: updatedData.name.trim(),
          role: updatedData.role.trim(),
          createdByAi: false 
        };
      }
      return p;
    });
    
    setParticipants(updated);
    try {
      await recordingsService.saveParticipants(recording.id, updated);
    } catch (error) {
      console.error("Error updating participant:", error);
    }
  };

  // --- TASK SUGGESTION HANDLERS ---

  const handleGenerateTasks = async () => {
    if (!recording.dbId) return;
    setIsGeneratingTasks(true);
    try {
      const newTasksData = await recordingAiService.generateTaskSuggestions(recording.id);
      const addedTasks = [];
      for (const t of newTasksData) {
        const saved = await recordingsService.addTaskSuggestion(recording.dbId, t.title, t.content, t.layer || 'general', true);
        if (saved) addedTasks.push(saved);
      }
      setTasks(prev => [...prev, ...addedTasks]);
      setNewTaskIds(prev => new Set([...prev, ...addedTasks.map(t => t.id)]));
    } catch (error) {
      console.error('Error generando tareas:', error);
      alert('Error al generar tareas: ' + error.message);
    } finally {
      setIsGeneratingTasks(false);
    }
  };

  const handleCreateTask = async (taskData) => {
    if (!recording.dbId) return;
    const saved = await recordingsService.addTaskSuggestion(recording.dbId, taskData.title, taskData.content, taskData.layer || 'general', false);
    if (saved) {
      setTasks(prev => [...prev, saved]);
      setNewTaskIds(prev => new Set([...prev, saved.id]));
    }
  };

  const handleUpdateTask = async (updatedTask) => {
    const saved = await recordingsService.updateTaskSuggestion(updatedTask.id, updatedTask.title, updatedTask.content, updatedTask.layer || 'general');
    if (saved) setTasks(prev => prev.map(t => t.id === updatedTask.id ? saved : t));
  };

  const handleImproveTask = async (taskId, userInstructions) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    setImprovingTaskId(taskId);
    try {
      const improved = await recordingAiService.improveTaskSuggestion(task, userInstructions);
      const saved = await recordingsService.updateTaskSuggestion(taskId, improved.title, improved.content, task.layer || 'general');
      if (saved) setTasks(prev => prev.map(t => t.id === taskId ? saved : t));
    } catch (error) {
      console.error('Error mejorando tarea:', error);
      alert('Error al mejorar tarea: ' + error.message);
    } finally {
      setImprovingTaskId(null);
    }
  };

  const handleDeleteTask = async (taskId) => {
    await recordingsService.deleteTaskSuggestion(taskId);
    setTasks(prev => prev.filter(t => t.id !== taskId));
  };

  const handleBulkDeleteTasks = async (ids) => {
    for (const id of ids) {
      await recordingsService.deleteTaskSuggestion(id);
    }
    setTasks(prev => prev.filter(t => !ids.includes(t.id)));
  };

  const handleSaveTitle = async () => {
    if (!editedTitle.trim()) return;
    try {
      await recordingsService.renameRecording(recording.id, editedTitle.trim());
      setLocalName(editedTitle.trim()); // Actualizar localmente inmediatamente
      setIsEditingTitle(false);
    } catch (error) {
      console.error("Error saving title", error);
    }
  };

  const handleDeleteClick = () => {
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = async () => {
    try {
      await recordingsService.deleteRecording(recording.id);
      setShowDeleteConfirm(false);
      onBack(); // Return to home/list
    } catch (error) {
      console.error("Error deleting recording:", error);
      alert("Error deleting recording: " + error.message);
    }
  };

  const handleReTranscribeClick = () => {
    setShowTranscribeModal(true);
  };

  const handleConfirmReTranscribe = async () => {
    setShowTranscribeModal(false);
    try {
      const result = await recordingsService.transcribeRecording(recording.dbId || recording.id, selectedWhisperModel);
      if (result.success) {
        alert("Transcription added to queue.");
      } else {
        alert("Error: " + result.error);
      }
    } catch (error) {
      console.error("Error re-transcribing:", error);
    }
  };

  // --- RENDER ---

  if (!recording) return null;

  const duration = recording.duration 
    ? `${Math.floor(recording.duration / 60)}:${Math.floor(recording.duration % 60).toString().padStart(2, '0')}`
    : '--:--';

  const dateStr = new Date(localRecording.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  // Helper to get audio URLs
  const getAudioUrls = () => {
    if (!localRecording || !localRecording.files || !localRecording.path) return { mic: null, sys: null };
    
    // Note: In Electron backend we registered 'media://' protocol to handle local files
    // URL format: media://<absolute_path>
    // We encode the path components just in case, but usually not strictly needed if backend decodes
    const folderPath = localRecording.path;
    
    // Helper to construct URL
    const makeUrl = (filename) => {
      // Encode path parts to handle spaces properly
      const safePath = [folderPath, filename].map(part => part).join('/');
      return `media://${safePath}`;
    };

    const micFile = localRecording.files.find(f => f.includes('microphone') || f.includes('mic'));
    const sysFile = localRecording.files.find(f => f.includes('system') || f.includes('sys'));

    // Fallback if no specific separate files found (e.g. older recordings or single file)
    if (!micFile && !sysFile && localRecording.files.length > 0) {
       return { mic: makeUrl(localRecording.files[0]), sys: null };
    }

    return {
      mic: micFile ? makeUrl(micFile) : null,
      sys: sysFile ? makeUrl(sysFile) : null
    };
  };

  const audioUrls = getAudioUrls();

  // Calculate transcription duration
  const getTranscriptionDuration = () => {
    if (!transcription) return 0;
    // Check metadata first
    if (transcription.metadata && transcription.metadata.total_duration) {
      const val = Number(transcription.metadata.total_duration);
      if (!isNaN(val)) return val;
    }
    // Fallback to last segment end time
    if (transcription.segments && transcription.segments.length > 0) {
      const last = transcription.segments[transcription.segments.length - 1];
      if (last.end) {
        const endVal = Number(last.end);
        if (!isNaN(endVal)) return endVal;
      }
      if (last.start) {
        const startVal = Number(last.start);
        if (!isNaN(startVal)) return startVal + 5;
      }
    }
    return 0;
  };

  const transcriptionDuration = getTranscriptionDuration();

  return (
    <div className={styles.container}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <button onClick={onBack} className={styles.backButton}>
            <MdArrowBack size={24} />
          </button>
          <div className={styles.titleSection}>
            <div className={styles.titleGroup} onDoubleClick={() => setIsEditingTitle(true)}>
              {isEditingTitle ? (
                <input 
                  type="text" 
                  value={editedTitle} 
                  onChange={(e) => setEditedTitle(e.target.value)}
                  onBlur={handleSaveTitle}
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveTitle()}
                  autoFocus
                  className={styles.titleInput}
                />
              ) : (
                <>
                  <h1 className={styles.title}>{localName || 'Untitled Recording'}</h1>
                  <button onClick={() => setIsEditingTitle(true)} className={styles.editTitleBtn} title="Rename">
                    <MdEdit size={16} />
                  </button>
                  <button onClick={handleDeleteClick} className={styles.deleteBtn} title="Delete Recording">
                    <MdDeleteOutline size={18} />
                  </button>
                </>
              )}
              <span className={styles.statusBadge}>Processed</span>
            </div>
            <div className={styles.metaRow}>
              {localRecording.project && (
                <>
                  <button 
                    onClick={() => onNavigateToProject && onNavigateToProject(localRecording.project)}
                    className={styles.metaItem} 
                    style={{ 
                      color: '#3994EF', 
                      fontWeight: 600, 
                      background: 'none', 
                      border: 'none', 
                      padding: 0, 
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                    title="View Project"
                  >
                    <MdFolderOpen size={14} />
                    {localRecording.project.name}
                  </button>
                  <span className={styles.dotSeparator}></span>
                </>
              )}
              <div className={styles.metaItem}>
                <MdCalendarToday size={14} />
                {dateStr}
              </div>
              <span className={styles.dotSeparator}></span>
              <div className={styles.metaItem}>
                <MdAccessTime size={14} />
                {duration}
              </div>
            </div>
          </div>
        </div>
        
        <div className={styles.headerRight}>
          <button 
            className={`${styles.actionButton} ${styles.reTranscribeBtn}`}
            onClick={handleReTranscribeClick}
            title="Re-run Transcription"
          >
            <MdTranslate size={18} />
            Transcribe
          </button>
          <button 
            className={`${styles.actionButton} ${styles.regenerateBtn}`}
            onClick={handleRegenerateClick}
            disabled={isGeneratingAi}
          >
            <MdAutorenew size={18} className={isGeneratingAi ? "animate-spin" : ""} />
            {isGeneratingAi ? 'Generating...' : 'Regenerate AI'}
          </button>
        </div>
      </header>

      {/* Tabs Navigation */}
      <nav className={styles.tabsNav}>
        <button 
          className={`${styles.tabButton} ${activeTab === 'overview' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </button>
        <button
          className={`${styles.tabButton} ${activeTab === 'transcription' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('transcription')}
        >
          Transcription & AI Chat
        </button>
        <button
          className={`${styles.tabButton} ${activeTab === 'tasks' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('tasks')}
        >
          Tareas{tasks.length > 0 ? ` (${tasks.length})` : ''}
        </button>
      </nav>

      {/* Main Content */}
      <div className={styles.mainContent}>
        {activeTab === 'overview' && (
          <OverviewTab
            summary={geminiData.resumen_breve}
            detailedSummary={detailedSummary}
            highlights={geminiData.ideas}
            participants={participants}
            onAddParticipant={handleAddParticipant}
            onRemoveParticipant={handleRemoveParticipant}
            onUpdateParticipant={handleUpdateParticipant}
            isGeneratingAi={isGeneratingAi}
          />
        )}
        {activeTab === 'transcription' && (
          <TranscriptionChatTab
            transcription={transcription}
            transcriptionLoading={transcriptionLoading}
            transcriptionError={transcriptionError}
            transcriptionModel={localRecording.transcriptionModel}
            audioUrls={audioUrls}
            duration={localRecording.duration}
            transcriptionDuration={transcriptionDuration}
            chatProps={{
              chatHistory: convertChatHistory(),
              onSendMessage: handleAskQuestion,
              isLoading: questionLoading,
              title: "AI Assistant",
              aiProvider: aiProvider,
              ollamaModels: ollamaModels,
              selectedOllamaModel: selectedOllamaModel
            }}
          />
        )}
        {activeTab === 'tasks' && (
          <EpicsTab
            tasks={tasks}
            isGenerating={isGeneratingTasks}
            hasTranscription={!!transcription}
            onGenerateMore={handleGenerateTasks}
            onCreateTask={handleCreateTask}
            onUpdateTask={handleUpdateTask}
            onImproveTask={handleImproveTask}
            onDeleteTask={handleDeleteTask}
            onBulkDeleteTasks={handleBulkDeleteTasks}
            improvingTaskId={improvingTaskId}
            newTaskIds={newTaskIds}
          />
        )}
      </div>

      {/* Regenerate Confirm Modal */}
      {showRegenerateConfirm && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <h3 className={styles.modalTitle}>Advanced Regeneration</h3>
            <p className={styles.modalText}>
              Select what you want to regenerate and which AI model to use.
            </p>
            
            <div className={styles.modalForm}>
              {/* AI Model Section */}
              <div className={styles.modalSection}>
                <label className={styles.modalLabel}>AI Provider</label>
                <select 
                  className={styles.select}
                  value={aiProvider}
                  onChange={(e) => setAiProvider(e.target.value)}
                >
                  <option value="gemini">Google Gemini (Cloud)</option>
                  <option value="ollama">Ollama (Local)</option>
                </select>

                {aiProvider === 'ollama' && (
                  <>
                    <label className={styles.modalLabel}>Local Model</label>
                    <select 
                      className={styles.select}
                      value={selectedOllamaModel}
                      onChange={(e) => setSelectedOllamaModel(e.target.value)}
                    >
                      <option value="" disabled>Select a model...</option>
                      {ollamaModels.map(model => (
                        <option key={model} value={model}>{model}</option>
                      ))}
                    </select>
                  </>
                )}
              </div>

              {/* Options Section */}
              <div className={styles.modalSection}>
                <label className={styles.modalLabel}>Regenerate Options</label>
                <div className={styles.checkboxGroup}>
                  <label className={styles.checkboxLabel}>
                    <input 
                      type="checkbox" 
                      checked={regenerateOptions.summaries}
                      onChange={() => handleToggleRegenerateOption('summaries')}
                    />
                    Quick Summary
                  </label>
                  <label className={styles.checkboxLabel}>
                    <input 
                      type="checkbox" 
                      checked={regenerateOptions.detailedSummary}
                      onChange={() => handleToggleRegenerateOption('detailedSummary')}
                    />
                    Detailed Summary
                  </label>
                  <label className={styles.checkboxLabel}>
                    <input 
                      type="checkbox" 
                      checked={regenerateOptions.keyTopics}
                      onChange={() => handleToggleRegenerateOption('keyTopics')}
                    />
                    Key Highlights
                  </label>
                  <label className={styles.checkboxLabel}>
                    <input 
                      type="checkbox" 
                      checked={regenerateOptions.participants}
                      onChange={() => handleToggleRegenerateOption('participants')}
                    />
                    Extract Participants
                  </label>
                </div>
              </div>
            </div>

            <div className={styles.modalButtons}>
              <button 
                className={styles.cancelModalBtn} 
                onClick={() => setShowRegenerateConfirm(false)}
              >
                Cancel
              </button>
              <button 
                className={styles.confirmModalBtn} 
                onClick={handleConfirmRegenerate}
              >
                Regenerate Selected
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <h3 className={styles.modalTitle}>Delete Recording</h3>
            <p className={styles.modalText}>
              Are you sure you want to delete <strong>"{recording.name}"</strong>?
              <br /><br />
              This action cannot be undone. All associated files (audio, transcription, summary) will be permanently removed.
            </p>
            <div className={styles.modalButtons}>
              <button 
                className={styles.cancelModalBtn} 
                onClick={() => setShowDeleteConfirm(false)}
              >
                Cancel
              </button>
              <button 
                className={styles.deleteConfirmBtn} 
                onClick={handleConfirmDelete}
              >
                Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Re-transcribe Modal */}
      {showTranscribeModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <h3 className={styles.modalTitle}>Re-generate Transcription</h3>
            <p className={styles.modalText}>
              Choose the Whisper model size. This will overwrite the current transcription.
            </p>
            
            <div className={styles.modalForm}>
              <div className={styles.modalSection}>
                <label className={styles.modalLabel}>Whisper Model</label>
                <select 
                  className={styles.select}
                  value={selectedWhisperModel}
                  onChange={(e) => setSelectedWhisperModel(e.target.value)}
                >
                  {whisperModels.map(model => (
                    <option key={model.value} value={model.value}>{model.label}</option>
                  ))}
                </select>
                <p className={styles.helpText}>
                  Smaller models are faster, larger models are more precise.
                </p>
              </div>
            </div>

            <div className={styles.modalButtons}>
              <button 
                className={styles.cancelModalBtn} 
                onClick={() => setShowTranscribeModal(false)}
              >
                Cancel
              </button>
              <button 
                className={styles.confirmModalBtn} 
                onClick={handleConfirmReTranscribe}
              >
                Start Transcription
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
