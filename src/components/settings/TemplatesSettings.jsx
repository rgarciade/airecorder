import React, { useState, useEffect, useCallback } from 'react';
import { MdAdd, MdEdit, MdDelete, MdContentCopy, MdCheck, MdClose } from 'react-icons/md';
import ConfirmModal from '../ConfirmModal/ConfirmModal';
import TemplateEditor from '../templates/TemplateEditor';
import styles from './TemplatesSettings.module.css';

export default function TemplatesSettings() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showEditor, setShowEditor] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [duplicateTemplate, setDuplicateTemplate] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [togglingId, setTogglingId] = useState(null);
  const [savedFeedback, setSavedFeedback] = useState(null);

  const loadTemplates = useCallback(async () => {
    try {
      const list = await window.electronAPI.templates.list();
      setTemplates(list || []);
    } catch (err) {
      console.error('Failed to load templates:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  const handleToggleEnabled = async (template) => {
    const newEnabled = template.enabled !== 1;
    setTogglingId(template.slug);
    try {
      await window.electronAPI.templates.toggleEnabled(template.slug, newEnabled);
      await loadTemplates();
      setSavedFeedback(template.slug);
      setTimeout(() => setSavedFeedback(null), 2000);
    } catch (err) {
      console.error('Failed to toggle template:', err);
    } finally {
      setTogglingId(null);
    }
  };

  const handleNewTemplate = () => {
    setEditingTemplate(null);
    setDuplicateTemplate(null);
    setShowEditor(true);
  };

  const handleEditTemplate = (template) => {
    setEditingTemplate(template);
    setDuplicateTemplate(null);
    setShowEditor(true);
  };

  const handleDuplicateTemplate = (template) => {
    const duplicated = {
      ...template,
      id: null,
      is_builtin: 0,
      name: template.name + ' (copia)',
    };
    setDuplicateTemplate(duplicated);
    setEditingTemplate(null);
    setShowEditor(true);
  };

  const handleDeleteTemplate = async () => {
    if (!deleteConfirm) return;
    try {
      await window.electronAPI.templates.delete(deleteConfirm.slug);
      await loadTemplates();
      setDeleteConfirm(null);
    } catch (err) {
      console.error('Failed to delete template:', err);
    }
  };

  const handleSaveTemplate = async (data) => {
    try {
      if (editingTemplate) {
        await window.electronAPI.templates.update(editingTemplate.slug, data);
      } else {
        await window.electronAPI.templates.create(data);
      }
      await loadTemplates();
      setShowEditor(false);
      setEditingTemplate(null);
      setDuplicateTemplate(null);
    } catch (err) {
      console.error('Failed to save template:', err);
    }
  };

  const handleCloseEditor = () => {
    setShowEditor(false);
    setEditingTemplate(null);
    setDuplicateTemplate(null);
  };

  const handleEditorSave = (data) => {
    handleSaveTemplate(data);
  };

  // Group templates
  const builtinTemplates = templates.filter((t) => t.is_builtin === 1);
  const customTemplates = templates.filter((t) => t.is_builtin === 0);

  if (loading) {
    return <div className={styles.loading}>Cargando plantillas...</div>;
  }

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <button type="button" className={styles.btnPrimary} onClick={handleNewTemplate}>
          <MdAdd size={16} />
          Nueva plantilla
        </button>
      </div>

      {/* Built-in Templates */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Plantillas predefinidas</h3>
        <p className={styles.sectionDescription}>
          Plantillas incluidas en AIRecorder. No se pueden editar ni eliminar, pero puedes duplicarlas para crear versiones personalizadas.
        </p>
        <div className={styles.templatesList}>
          {builtinTemplates.map((template) => (
            <TemplateCard
              key={template.slug}
              template={template}
              isBuiltin
              isToggling={togglingId === template.slug}
              isSaved={savedFeedback === template.slug}
              onToggle={() => handleToggleEnabled(template)}
              onEdit={() => handleEditTemplate(template)}
              onDuplicate={() => handleDuplicateTemplate(template)}
              onDelete={() => setDeleteConfirm(template)}
            />
          ))}
        </div>
      </div>

      {/* Custom Templates */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Mis plantillas</h3>
        <p className={styles.sectionDescription}>
          Plantillas personalizadas creadas por ti.
        </p>
        {customTemplates.length === 0 ? (
          <div className={styles.emptyState}>
            <p>No tienes plantillas personalizadas.</p>
            <p>Crea una nueva para comenzar.</p>
          </div>
        ) : (
          <div className={styles.templatesList}>
            {customTemplates.map((template) => (
              <TemplateCard
                key={template.slug}
                template={template}
                isBuiltin={false}
                isToggling={togglingId === template.slug}
                isSaved={savedFeedback === template.slug}
                onToggle={() => handleToggleEnabled(template)}
                onEdit={() => handleEditTemplate(template)}
                onDuplicate={() => handleDuplicateTemplate(template)}
                onDelete={() => setDeleteConfirm(template)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Template Editor Modal */}
      {showEditor && (
        <TemplateEditor
          template={editingTemplate || duplicateTemplate}
          onSave={handleEditorSave}
          onCancel={handleCloseEditor}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <ConfirmModal
          isOpen={true}
          title="Eliminar plantilla"
          message={'Esta seguro de que quiere eliminar "' + deleteConfirm.name + '"? Esta accion no se puede deshacer.'}
          confirmText="Eliminar"
          cancelText="Cancelar"
          onConfirm={handleDeleteTemplate}
          onCancel={() => setDeleteConfirm(null)}
          isDanger={true}
        />
      )}
    </div>
  );
}

// Template Card Component
function TemplateCard({
  template,
  isBuiltin,
  isToggling,
  isSaved,
  onToggle,
  onEdit,
  onDuplicate,
  onDelete,
}) {
  const enabled = template.enabled === 1;

  return (
    <div className={`${styles.templateCard} ${!enabled ? styles.templateCardDisabled : ''}`}>
      <div className={styles.templateIcon}>{template.icon || '📝'}</div>
      <div className={styles.templateInfo}>
        <div className={styles.templateName}>{template.name}</div>
        <div className={styles.templateDescription}>{template.description}</div>
        <div className={styles.templateExpert}>
          Experto: {getExpertLabel(template.expert_id)}
        </div>
      </div>
      <div className={styles.templateActions}>
        {isSaved && (
          <span className={styles.savedFeedback}>
            <MdCheck size={14} />
            Guardado
          </span>
        )}
        <label className={styles.toggle}>
          <input
            type="checkbox"
            checked={enabled}
            onChange={onToggle}
            disabled={isToggling}
          />
          <span className={styles.toggleSlider} />
        </label>
        {isBuiltin ? (
          <button
            type="button"
            className={styles.btnAction}
            onClick={onDuplicate}
            title="Duplicar y personalizar"
          >
            <MdContentCopy size={16} />
          </button>
        ) : (
          <>
            <button type="button" className={styles.btnAction} onClick={onEdit} title="Editar">
              <MdEdit size={16} />
            </button>
            <button
              type="button"
              className={`${styles.btnAction} ${styles.btnActionDanger}`}
              onClick={onDelete}
              title="Eliminar"
            >
              <MdDelete size={16} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function getExpertLabel(expertId) {
  const labels = {
    general: 'General',
    developer: 'Desarrollador',
    psychologist: 'Psicologo',
  };
  return labels[expertId] || expertId;
}