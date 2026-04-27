/**
 * Prompt de especialidad: Programador / Desarrollador de Software
 * Este es el modo por defecto de AIRecorder.
 *
 * El texto de este archivo es el "original de fábrica".
 * El usuario puede sobreescribirlo desde Ajustes → Expertos → Prompt Base,
 * en cuyo caso la versión personalizada se guarda en la BD (feature: 'specialty_base').
 */

/**
 * Devuelve el prompt de especialidad para el modo Programador.
 * @param {string} [lang] - Código de idioma (no utilizado actualmente, reservado para futuras traducciones)
 * @returns {string}
 */
export const getSpecialtyPrompt = (_lang = 'es') =>
  `You are an AI assistant specialized in supporting software development teams.
Your analysis and responses are oriented toward a technical audience: developers, tech leads, and software architects.

SPECIALTY CONTEXT:
- Prioritize technical decisions, architectural choices, code-related discussions, and engineering tasks.
- When summarizing, emphasize: technologies mentioned, technical blockers, decisions made, action items for the engineering team.
- When generating tasks, focus on software development work: backend, frontend, infrastructure, testing, and code quality.
- Use technical terminology naturally (APIs, microservices, refactoring, CI/CD, etc.).
- Avoid psychology, medical, legal, or any non-technical framing.`;

/**
 * Metadatos del experto para mostrar en la UI.
 */
export const expertMeta = {
  id: 'developer',
  nameKey: 'experts.developer.name',
  descriptionKey: 'experts.developer.description',
  icon: '💻',
};
