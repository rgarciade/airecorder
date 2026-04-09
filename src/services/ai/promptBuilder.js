/**
 * promptBuilder — Ensamblador de prompts con sistema de expertos
 *
 * Construye el system prompt final en el orden:
 *   A) Prompt de especialidad del experto activo
 *   B) Indicaciones extras del usuario (alta prioridad, si las hay)
 *   C) Prompt base de la acción
 */

import { getSettings } from '../settingsService';
import * as developerExpert from '../../prompts/experts/developer';
import * as psychologistExpert from '../../prompts/experts/psychologist';
import * as generalExpert from '../../prompts/experts/general';

// ── Registro de expertos disponibles ─────────────────────────────────────────

const EXPERTS_MAP = {
  general: generalExpert,
  developer: developerExpert,
  psychologist: psychologistExpert,
};

// ── Constantes de tipos de funcionalidad ─────────────────────────────────────

export const FEATURE_TYPES = {
  SHORT_SUMMARY: 'short_summary',
  LONG_SUMMARY:  'long_summary',
  KEY_POINTS:    'key_points',
  CHAT:          'chat',
  TASKS:         'tasks',
};

// ── Cache de customizaciones en memoria ──────────────────────────────────────
// Se invalida al cambiar de experto o al guardar cambios desde Ajustes.

let _cache = null; // { expertId, customizations: { feature: instructions } }

export function invalidateExpertCache() {
  _cache = null;
}

async function getCustomizations(expertId) {
  if (_cache && _cache.expertId === expertId) {
    return _cache.customizations;
  }

  const customizations = await window.electronAPI.getExpertCustomizations(expertId);
  _cache = { expertId, customizations };
  return customizations;
}

// ── Función principal ─────────────────────────────────────────────────────────

/**
 * Construye el system prompt completo: A + B + C
 *
 * @param {string} featureType  - Constante de FEATURE_TYPES (o null para no inyectar B)
 * @param {string} basePrompt   - El prompt C: la instrucción de la acción actual
 * @param {string} [lang]       - Código de idioma para el prompt de especialidad
 * @returns {Promise<string>}   - System prompt final listo para enviar a la IA
 */
export async function buildSystemPrompt(featureType, basePrompt, lang = 'es') {
  try {
    const settings = await getSettings();
    const expertId = settings.activeExpert || 'developer';
    const expertModule = EXPERTS_MAP[expertId] || EXPERTS_MAP.developer;

    const customizations = await getCustomizations(expertId);

    // A: Prompt de especialidad — usa la versión personalizada si existe, sino el .js
    const specialtyOverride = customizations['specialty_base']?.trim();
    const specialtyPrompt = specialtyOverride || expertModule.getSpecialtyPrompt(lang);

    // B: Indicaciones extras para esta feature (si hay)
    const extraInstructions = featureType
      ? (customizations[featureType]?.trim() || '')
      : '';

    // Ensamblar A + B + C
    let result = specialtyPrompt;

    if (extraInstructions) {
      result += `\n\n### REGLAS ESTRICTAS DE FORMATO Y COMPORTAMIENTO:\n${extraInstructions}\n###`;
    }

    result += `\n\n${basePrompt}`;

    return result;
  } catch (err) {
    // Fallback seguro: si falla por cualquier razón, devolvemos solo el prompt base
    console.error('[promptBuilder] Error construyendo system prompt:', err);
    return basePrompt;
  }
}

/**
 * Devuelve los metadatos de todos los expertos disponibles.
 * Útil para poblar el selector de la UI.
 * @returns {Array<{ id, nameKey, descriptionKey, icon }>}
 */
export function getAvailableExperts() {
  return Object.values(EXPERTS_MAP).map(m => m.expertMeta);
}

/**
 * Devuelve el experto activo según la configuración actual.
 * @returns {Promise<string>} expertId
 */
export async function getActiveExpertId() {
  const settings = await getSettings();
  return settings.activeExpert || 'developer';
}

/**
 * Devuelve el prompt de especialidad original de fábrica para un experto.
 * Útil para el botón "Restaurar predeterminado" en Ajustes.
 * @param {string} expertId
 * @param {string} [lang]
 * @returns {string}
 */
export function getDefaultSpecialtyPrompt(expertId, lang = 'es') {
  const expertModule = EXPERTS_MAP[expertId] || EXPERTS_MAP.developer;
  return expertModule.getSpecialtyPrompt(lang);
}
