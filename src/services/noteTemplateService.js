/**
 * Servicio de generación de notas estructuradas desde templates.
 *
 * Este servicio coordina la generación de notas usando plantillas predefinidas:
 * 1. Obtiene el template y sus secciones
 * 2. Obtiene la transcripción y resumen AI de la grabación
 * 3. Resuelve el prompt de especialidad según el experto del template
 * 4. Construye los prompts (system + user) usando templatePrompts
 * 5. Llama al proveedor de IA configurado
 * 6. Guarda la nota generada en la base de datos
 */

import { callProvider } from './ai/providerRouter.js';
import { buildTemplateSystemPrompt, buildTemplateUserContent } from '../prompts/common/templatePrompts.js';
import { getSpecialtyPrompt as getGeneralSpecialty } from '../prompts/experts/general.js';
import { getSpecialtyPrompt as getDeveloperSpecialty } from '../prompts/experts/developer.js';
import { getSpecialtyPrompt as getPsychologistSpecialty } from '../prompts/experts/psychologist.js';

/**
 * Mapeo deexpert_id a función resolutora de specialty prompt.
 * @readonly
 * @type {Object<string, Function>}
 */
const expertResolvers = {
  general: getGeneralSpecialty,
  developer: getDeveloperSpecialty,
  psychologist: getPsychologistSpecialty
};

/**
 * Obtiene el prompt de especialidad para un experto dado.
 * @param {string} expertId - ID del experto (general, developer, psychologist)
 * @param {string} lang - Código de idioma
 * @returns {string} Prompt de especialidad
 */
function getExpertPrompt(expertId, lang) {
  const resolver = expertResolvers[expertId] || expertResolvers.general;
  return resolver(lang);
}

/**
 * Genera notas estructuradas a partir de un template aplicado a una grabación.
 *
 * @async
 * @param {Object} params - Parámetros de generación
 * @param {number} params.recordingId - ID de la grabación en la base de datos
 * @param {string} params.templateSlug - Slug del template a usar
 * @param {string} [params.lang='es'] - Código de idioma para el prompt
 * @returns {Promise<{noteId: number, contentMd: string}>}
 * @throws {Error} Si el template no existe o falla la generación
 */
export async function generateFromTemplate({ recordingId, templateSlug, lang = 'es' }) {
  // 1. Obtener template por slug
  const template = await window.electronAPI.templates.getBySlug(templateSlug);
  if (!template) {
    throw new Error(`Template not found: ${templateSlug}`);
  }

  // 2. Parsear secciones del template
  const sections = typeof template.sections_json === 'string'
    ? JSON.parse(template.sections_json)
    : template.sections_json;

  const templateWithSections = {
    ...template,
    sections
  };

  // 3. Obtener transcripción de la grabación
  const transcriptResult = await window.electronAPI.getTranscriptionTxt(recordingId);
  if (!transcriptResult || !transcriptResult.success || !transcriptResult.text) {
    throw new Error(`No transcription found for recording: ${recordingId}`);
  }
  const transcript = transcriptResult.text;

  // 4. Obtener resumen AI existente (opcional)
  let existingSummary = '';
  try {
    const summaryResult = await window.electronAPI.getAiSummary(recordingId);
    if (summaryResult && summaryResult.success && summaryResult.summary) {
      // summaryResult.summary is the parsed JSON object
      existingSummary = summaryResult.summary.detailedSummary || '';
    }
  } catch (e) {
    // Si falla, continuamos sin summary previo
    console.warn('[noteTemplateService] Could not load AI summary:', e.message);
  }

  // 5. Resolver prompt de especialidad según expert_id del template
  const expertId = template.expert_id || 'general';
  const specialtyPrompt = getExpertPrompt(expertId, lang);

  // 6. Construir prompts
  const systemPrompt = buildTemplateSystemPrompt(templateWithSections, lang, specialtyPrompt);
  const userContent = buildTemplateUserContent(transcript, existingSummary);

  // 7. Llamar al proveedor de IA
  const result = await callProvider(userContent, {
    systemPrompt,
    queueMeta: {
      name: `Generar notas: ${template.name}`,
      type: 'template-generation'
    }
  });

  const contentMd = result.text;

  // 8. Guardar nota en la base de datos
  const saveResult = await window.electronAPI.templates.saveNote({
    recordingId,
    templateSlug,
    contentMd
  });

  if (!saveResult || !saveResult.success) {
    throw new Error(saveResult?.error || 'Failed to save note');
  }

  return {
    noteId: saveResult.id,
    contentMd
  };
}

/**
 * Obtiene todas las notas generadas para una grabación.
 *
 * @async
 * @param {number} recordingId - ID de la grabación
 * @returns {Promise<Array>} Array de notas
 */
export async function getNotesForRecording(recordingId) {
  return window.electronAPI.templates.getNotesForRecording(recordingId);
}

/**
 * Actualiza el contenido de una nota existente.
 *
 * @async
 * @param {number} noteId - ID de la nota
 * @param {string} contentMd - Nuevo contenido en markdown
 * @returns {Promise<{success: boolean}>}
 */
export async function updateNote(noteId, contentMd) {
  return window.electronAPI.templates.updateNote(noteId, contentMd);
}

/**
 * Elimina una nota.
 *
 * @async
 * @param {number} noteId - ID de la nota a eliminar
 * @returns {Promise<{success: boolean}>}
 */
export async function deleteNote(noteId) {
  return window.electronAPI.templates.deleteNote(noteId);
}