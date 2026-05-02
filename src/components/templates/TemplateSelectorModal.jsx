import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { MdClose, MdAdd } from 'react-icons/md';

export default function TemplateSelectorModal({
  isOpen,
  onClose,
  onSelectTemplate,
  onCreateCustom
}) {
  const { i18n } = useTranslation();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const isSpanish = i18n.language === 'es';

  useEffect(() => {
    if (!isOpen) return;

    const loadTemplates = async () => {
      setLoading(true);
      setError(null);
      try {
        // Use listEnabled to only show enabled templates for note creation
        const list = await window.electronAPI.templates.listEnabled();
        setTemplates(list || []);
      } catch (err) {
        console.error('Error loading templates:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadTemplates();
  }, [isOpen]);

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const getSectionCount = (template) => {
    try {
      const sections = typeof template.sections_json === 'string'
        ? JSON.parse(template.sections_json)
        : template.sections_json;
      return Array.isArray(sections) ? sections.length : 0;
    } catch {
      return 0;
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100]"
      onClick={handleBackdropClick}
    >
      <div 
        className="bg-[var(--color-bg-secondary)] rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border-secondary)]">
          <h2 className="text-xl font-bold text-[var(--color-text-primary)]">
            {isSpanish ? 'Seleccionar Plantilla' : 'Select Template'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-tertiary)] transition-colors"
          >
            <MdClose size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--color-primary)]"></div>
            </div>
          ) : error ? (
            <div className="text-center py-8 text-[var(--color-danger)]">
              {error}
            </div>
          ) : templates.length === 0 ? (
            <div className="text-center py-8 text-[var(--color-text-tertiary)]">
              {isSpanish ? 'No hay plantillas disponibles' : 'No templates available'}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {templates.map((template) => (
                <button
                  key={template.slug}
                  onClick={() => onSelectTemplate(template)}
                  className="p-4 rounded-xl border border-[var(--color-border-secondary)] hover:border-[var(--color-primary)] hover:bg-[var(--color-primary-bg)] transition-all text-left group"
                >
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">{template.icon || '📝'}</span>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-[var(--color-text-primary)] truncate">
                        {template.name}
                      </h3>
                      <p className="text-sm text-[var(--color-text-secondary)] line-clamp-2 mt-1">
                        {template.description}
                      </p>
                      <p className="text-xs text-[var(--color-text-tertiary)] mt-2">
                        {getSectionCount(template)} {isSpanish ? 'secciones' : 'sections'}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[var(--color-border-secondary)]">
          <button
            onClick={onCreateCustom}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-[var(--color-border-secondary)] hover:border-[var(--color-primary)] hover:bg-[var(--color-primary-bg)] text-[var(--color-text-secondary)] font-medium transition-all"
          >
            <MdAdd size={20} />
            {isSpanish ? 'Crear Plantilla Personalizada' : 'Create Custom Template'}
          </button>
        </div>
      </div>
    </div>
  );
}