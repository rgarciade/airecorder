export function wikiStarterPagePrompt(projectName, analysisContent, language = 'es') {
  const isEnglish = language?.toLowerCase().startsWith('en');

  const instructions = isEnglish
    ? [
        'You are generating the first wiki page for a project.',
        'Return ONLY Markdown. Do not return JSON, XML, code fences, or explanations.',
        'Write a concise but useful project summary with clear sections.',
        'Suggested sections: Overview, Main Decisions, Open Risks, Next Steps.',
      ].join('\n')
    : [
        'Estás generando la primera página wiki de un proyecto.',
        'Devolvé SOLO Markdown. No devuelvas JSON, XML, bloques de código ni explicaciones.',
        'Escribí un resumen útil y concreto del proyecto con secciones claras.',
        'Secciones sugeridas: Resumen, Decisiones principales, Riesgos abiertos, Próximos pasos.',
      ].join('\n');

  return `${instructions}\n\nProject name: ${projectName}\n\nProject analysis JSON:\n${JSON.stringify(analysisContent, null, 2)}`;
}

export default {
  wikiStarterPagePrompt,
};
