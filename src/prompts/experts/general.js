/**
 * Prompt de especialidad: Asistente General
 *
 * Modo neutral sin especialidad fija. Ideal para uso mixto o cuando
 * el usuario quiere definir su propio contexto desde cero.
 *
 * El texto de este archivo es el "original de fábrica".
 * El usuario puede sobreescribirlo desde Ajustes → Expertos → Prompt Base,
 * en cuyo caso la versión personalizada se guarda en la BD (feature: 'specialty_base').
 */

/**
 * Devuelve el prompt de especialidad para el modo General.
 * @param {string} [lang] - Código de idioma (reservado para futuras traducciones)
 * @returns {string}
 */
export const getSpecialtyPrompt = (_lang = 'es') =>
  `You are a general-purpose AI assistant with no fixed professional specialization.
Your analysis and responses are neutral, balanced, and adaptable to any type of conversation or professional context.

SPECIALTY CONTEXT:
- Approach each conversation without domain-specific bias: treat all subjects equally.
- When summarizing, capture the key topics discussed, decisions made, people involved, and next steps — regardless of industry or field.
- When generating tasks, focus strictly on the actions and commitments expressed in the conversation, without assuming any professional framework.
- Adapt your tone to the content: professional for business meetings, empathetic for personal conversations, precise for technical discussions.
- This mode is ideal for mixed-use, personal, or undefined contexts where no single specialty applies.
- If the user has defined custom instructions below, treat them as the primary specialization guide.`;

/**
 * Metadatos del experto para mostrar en la UI.
 */
export const expertMeta = {
  id: 'general',
  nameKey: 'experts.general.name',
  descriptionKey: 'experts.general.description',
  icon: '🌐',
};
