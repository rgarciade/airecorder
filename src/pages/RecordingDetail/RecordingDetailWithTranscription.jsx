import React, { useState, useEffect } from 'react';
import { useAiProcessing } from '../../contexts/AiProcessingContext';
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
  MdFolderOpen
} from 'react-icons/md';

export default function RecordingDetailWithTranscription({ recording, onBack, onNavigateToProject }) {
  // --- STATE MANAGEMENT ---
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'transcription'
  
  // Data State
  const [participants, setParticipants] = useState(recording?.participants || []);
  const [transcription, setTranscription] = useState(null);
  const [transcriptionLoading, setTranscriptionLoading] = useState(false);
  const [transcriptionError, setTranscriptionError] = useState(null);
  
  // AI Summary State
  const [geminiData, setGeminiData] = useState({ resumen_breve: '', ideas: [] });
  const [detailedSummary, setDetailedSummary] = useState('');
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);

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

  // --- EFFECTS ---

  // 1. Load Initial Data (Transcription, AI Config, Project)
  useEffect(() => {
    if (!recording?.id) return;

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

        // Load Summary
        const existing = await recordingAiService.getRecordingSummary(recording.id);
        if (existing) {
          setGeminiData(existing);
          setDetailedSummary(existing.resumen_detallado || '');
        }

        // Trigger Auto-generation if missing
        if ((!existing || !savedParticipants.length) && !isGeneratingAi) {
           // Lógica de auto-generación simplificada
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
    const newParticipant = {
      id: Date.now(),
      name: newParticipantData.name.trim(),
      role: newParticipantData.role.trim() || 'Participante',
      createdByAi: false
    };
    
    const updated = [...participants, newParticipant];
    setParticipants(updated);
    await recordingsService.saveParticipants(recording.id, updated);
  };

  const handleRemoveParticipant = async (participantId) => {
    const updated = participants.filter(p => p.id !== participantId);
    setParticipants(updated);
    await recordingsService.saveParticipants(recording.id, updated);
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
    await recordingsService.saveParticipants(recording.id, updated);
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

  // --- RENDER ---

  if (!recording) return null;

  const duration = recording.duration 
    ? `${Math.floor(recording.duration / 60)}:${Math.floor(recording.duration % 60).toString().padStart(2, '0')}`
    : '--:--';

  const dateStr = new Date(recording.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

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
              {recording.project && (
                <>
                  <button 
                    onClick={() => onNavigateToProject && onNavigateToProject(recording.project)}
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
                    {recording.project.name}
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
      </nav>

      {/* Main Content */}
      <div className={styles.mainContent}>
        {activeTab === 'overview' ? (
          <OverviewTab 
            summary={geminiData.resumen_breve}
            detailedSummary={detailedSummary}
            highlights={geminiData.ideas}
            participants={participants}
            onAddParticipant={handleAddParticipant}
            onRemoveParticipant={handleRemoveParticipant}
            onUpdateParticipant={handleUpdateParticipant}
          />
        ) : (
          <TranscriptionChatTab 
            transcription={transcription}
            transcriptionLoading={transcriptionLoading}
            transcriptionError={transcriptionError}
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
    </div>
  );
}
