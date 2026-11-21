// Orden del wizard: "model" (modelo de transcripción) va justo después de
// "aiInfo" y antes de "ai", siguiendo el orden real del pipeline
// (audio → transcripción → IA). El estado de cada paso vive en su propio hook.
export const STEPS = [
  { id: 'welcome' },
  { id: 'aiInfo' },
  { id: 'model' },
  { id: 'ai' },
  { id: 'permissions' },
  { id: 'preferences' },
  { id: 'finish' },
];
