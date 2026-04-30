import React, { useState, useEffect } from 'react';
import { MdClose, MdAdd, MdRemove, MdVisibility, MdSave, MdCancel } from 'react-icons/md';
import styles from './TemplateEditor.module.css';

const SECTION_TYPES = [
  { value: 'summary', label: 'Resumen' },
  { value: 'bullets', label: 'Viñetas' },
  { value: 'qa', label: 'Q&A' },
  { value: 'table', label: 'Tabla' },
  { value: 'timeline', label: 'Línea de tiempo' },
  { value: 'actions', label: 'Acciones' },
  { value: 'quote_highlights', label: 'Citas destacadas' },
  { value: 'freeform', label: 'Texto libre' },
];

const EXPERT_OPTIONS = [
  { value: 'general', label: 'General' },
  { value: 'developer', label: 'Desarrollador' },
  { value: 'psychologist', label: 'Psicólogo' },
];

function generateSlug(name) {
  return name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function generateSectionId() {
  return 'section-' + Math.random().toString(36).substr(2, 9);
}

export default function TemplateEditor({ template, onSave, onCancel }) {
  const isEditing = !!template;
  const [name, setName] = useState(template?.name || '');
  const [icon, setIcon] = useState(template?.icon || '📝');
  const [description, setDescription] = useState(template?.description || '');
  const [expertId, setExpertId] = useState(template?.expert_id || 'general');
  const [sections, setSections] = useState(() => {
    if (template?.sections_json) {
      try {
        return typeof template.sections_json === 'string'
          ? JSON.parse(template.sections_json)
          : template.sections_json;
      } catch (e) {
        return [];
      }
    }
    return [];
  });
  const [showPreview, setShowPreview] = useState(false);
  const [errors, setErrors] = useState({});

  const validate = () => {
    const newErrors = {};
    if (!name.trim()) {
      newErrors.name = 'El nombre es requerido';
    }
    if (sections.length === 0) {
      newErrors.sections = 'Debe tener al menos una sección';
    }
    sections.forEach((section, idx) => {
      if (!section.title?.trim()) {
        newErrors[`section-${idx}-title`] = 'El título es requerido';
      }
      if (!section.type) {
        newErrors[`section-${idx}-type`] = 'El tipo es requerido';
      }
    });
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;

    const slug = isEditing ? template.slug : generateSlug(name);
    const data = {
      slug,
      name: name.trim(),
      icon: icon.trim() || '📝',
      description: description.trim(),
      expert_id: expertId,
      sections_json: JSON.stringify(sections),
    };

    onSave(data);
  };

  const handleAddSection = () => {
    setSections([
      ...sections,
      {
        id: generateSectionId(),
        title: '',
        type: 'summary',
        instructions: '',
        required: false,
      },
    ]);
  };

  const handleRemoveSection = (index) => {
    setSections(sections.filter((_, idx) => idx !== index));
  };

  const handleSectionChange = (index, field, value) => {
    const newSections = [...sections];
    newSections[index] = { ...newSections[index], [field]: value };
    setSections(newSections);
  };

  const generatePreviewPrompt = () => {
    const sectionsPrompt = sections
      .map((section) => {
        const typeLabel = SECTION_TYPES.find((t) => t.value === section.type)?.label || section.type;
        return `## ${section.title} (${typeLabel})${section.required ? ' *requerido*' : ''}\n${section.instructions}`;
      })
      .join('\n\n');

    return `# Generador de notas para grabación de audio

## Configuración
- Plantilla: ${name}
- Experto: ${expertId}
- Descripción: ${description || 'Sin descripción'}

## Secciones a generar
${sectionsPrompt}

## Instrucciones generales
生成会根据上面的配置和 secciones 部分，生成对应格式的笔记内容。`;
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2 className={styles.title}>
            {isEditing ? 'Editar plantilla' : 'Nueva plantilla'}
          </h2>
          <button type="button" className={styles.closeButton} onClick={onCancel}>
            <MdClose size={20} />
          </button>
        </div>

        <div className={styles.content}>
          {/* Basic Info */}
          <div className={styles.field}>
            <label className={styles.label}>Nombre</label>
            <input
              type="text"
              className={`${styles.input} ${errors.name ? styles.inputError : ''}`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nombre de la plantilla"
            />
            {errors.name && <span className={styles.errorText}>{errors.name}</span>}
          </div>

          <div className={styles.row}>
            <div className={styles.field} style={{ flex: '0 0 80px' }}>
              <label className={styles.label}>Icono</label>
              <input
                type="text"
                className={styles.input}
                value={icon}
                onChange={(e) => setIcon(e.target.value)}
                placeholder="📝"
                maxLength={2}
              />
            </div>

            <div className={styles.field} style={{ flex: 1 }}>
              <label className={styles.label}>Experto</label>
              <select
                className={styles.select}
                value={expertId}
                onChange={(e) => setExpertId(e.target.value)}
              >
                {EXPERT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Descripción</label>
            <textarea
              className={styles.textarea}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descripción breve de la plantilla"
              rows={2}
            />
          </div>

          <hr className={styles.divider} />

          {/* Sections */}
          <div className={styles.sectionsHeader}>
            <h3 className={styles.sectionsTitle}>Secciones</h3>
            <button type="button" className={styles.btnAddSection} onClick={handleAddSection}>
              <MdAdd size={16} />
              Añadir sección
            </button>
          </div>

          {errors.sections && <span className={styles.errorText}>{errors.sections}</span>}

          <div className={styles.sectionsList}>
            {sections.map((section, index) => (
              <div key={section.id} className={styles.sectionCard}>
                <div className={styles.sectionHeader}>
                  <span className={styles.sectionNumber}>Sección {index + 1}</span>
                  <button
                    type="button"
                    className={styles.btnRemoveSection}
                    onClick={() => handleRemoveSection(index)}
                  >
                    <MdRemove size={16} />
                  </button>
                </div>

                <div className={styles.field}>
                  <label className={styles.label}>Título</label>
                  <input
                    type="text"
                    className={`${styles.input} ${errors[`section-${index}-title`] ? styles.inputError : ''}`}
                    value={section.title}
                    onChange={(e) => handleSectionChange(index, 'title', e.target.value)}
                    placeholder="Título de la sección"
                  />
                </div>

                <div className={styles.row}>
                  <div className={styles.field} style={{ flex: 1 }}>
                    <label className={styles.label}>Tipo</label>
                    <select
                      className={styles.select}
                      value={section.type}
                      onChange={(e) => handleSectionChange(index, 'type', e.target.value)}
                    >
                      {SECTION_TYPES.map((type) => (
                        <option key={type.value} value={type.value}>
                          {type.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className={styles.checkboxField}>
                    <label className={styles.checkboxLabel}>
                      <input
                        type="checkbox"
                        checked={section.required}
                        onChange={(e) => handleSectionChange(index, 'required', e.target.checked)}
                      />
                      <span>Requerida</span>
                    </label>
                  </div>
                </div>

                <div className={styles.field}>
                  <label className={styles.label}>Instrucciones</label>
                  <textarea
                    className={styles.textarea}
                    value={section.instructions}
                    onChange={(e) => handleSectionChange(index, 'instructions', e.target.value)}
                    placeholder="Instrucciones para generar esta sección"
                    rows={3}
                  />
                </div>
              </div>
            ))}

            {sections.length === 0 && (
              <div className={styles.emptySections}>
                <p>No hay secciones. Añade al menos una sección.</p>
              </div>
            )}
          </div>

          {/* Preview */}
          {showPreview && (
            <div className={styles.previewCard}>
              <h4 className={styles.previewTitle}>Vista previa del prompt</h4>
              <pre className={styles.previewContent}>{generatePreviewPrompt()}</pre>
            </div>
          )}
        </div>

        <div className={styles.footer}>
          <button type="button" className={styles.btnSecondary} onClick={() => setShowPreview(!showPreview)}>
            <MdVisibility size={16} />
            {showPreview ? 'Ocultar' : 'Vista previa'}
          </button>
          <div className={styles.footerRight}>
            <button type="button" className={styles.btnSecondary} onClick={onCancel}>
              <MdCancel size={16} />
              Cancelar
            </button>
            <button type="button" className={styles.btnPrimary} onClick={handleSave}>
              <MdSave size={16} />
              {isEditing ? 'Guardar cambios' : 'Crear plantilla'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}