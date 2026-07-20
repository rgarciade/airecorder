import React from 'react';
import { SiOllama, SiGooglegemini, SiDeepseek } from 'react-icons/si';
import { AiOutlineOpenAI } from 'react-icons/ai';
import { MdAddLink } from 'react-icons/md';

function LmStudioMark({ size, ...props }) {
  const computedSize = size || '1em';
  return (
    <svg viewBox="0 0 36 36" xmlns="http://www.w3.org/2000/svg" width={computedSize} height={computedSize} {...props}>
      <rect width="36" height="36" rx="9" fill="#6D28D9" />
      <rect x="7" y="9" width="22" height="3.5" rx="1.75" fill="rgba(255,255,255,0.95)" />
      <rect x="5" y="16" width="26" height="3.5" rx="1.75" fill="rgba(255,255,255,0.95)" />
      <rect x="9" y="23" width="18" height="3.5" rx="1.75" fill="rgba(255,255,255,0.95)" />
    </svg>
  );
}

function KimiMark({ size, ...props }) {
  const computedSize = size || '1em';
  return (
    <svg fill="currentColor" fillRule="evenodd" viewBox="0 0 24 24" width={computedSize} height={computedSize} xmlns="http://www.w3.org/2000/svg" {...props}>
      <path d="M21.846 0a1.923 1.923 0 110 3.846H20.15a.226.226 0 01-.227-.226V1.923C19.923.861 20.784 0 21.846 0z" />
      <path d="M11.065 11.199l7.257-7.2c.137-.136.06-.41-.116-.41H14.3a.164.164 0 00-.117.051l-7.82 7.756c-.122.12-.302.013-.302-.179V3.82c0-.127-.083-.23-.185-.23H3.186c-.103 0-.186.103-.186.23V19.77c0 .128.083.23.186.23h2.69c.103 0 .186-.102.186-.23v-3.25c0-.069.025-.135.069-.178l2.424-2.406a.158.158 0 01.205-.023l6.484 4.772a7.677 7.677 0 003.453 1.283c.108.012.2-.095.2-.23v-3.06c0-.117-.07-.212-.164-.227a5.028 5.028 0 01-2.027-.807l-5.613-4.064c-.117-.078-.132-.279-.028-.381z" />
    </svg>
  );
}

/**
 * Fuente única de verdad para el logo/ícono de cada proveedor de IA soportado.
 * Agregar un proveedor nuevo acá alcanza para que aparezca correctamente en
 * Onboarding, Settings y cualquier lugar futuro que use <AiProviderIcon />.
 */
export const AI_PROVIDERS = {
  ollama: { label: 'Ollama', Icon: SiOllama },
  lmstudio: { label: 'LM Studio', Icon: LmStudioMark },
  openai: { label: 'OpenAI', Icon: AiOutlineOpenAI },
  gemini: { label: 'Gemini', Icon: SiGooglegemini },
  kimi: { label: 'Kimi', Icon: KimiMark },
  deepseek: { label: 'DeepSeek', Icon: SiDeepseek },
  custom: { label: 'Custom', Icon: MdAddLink },
};

export default function AiProviderIcon({ provider, ...props }) {
  const Icon = AI_PROVIDERS[provider]?.Icon;
  if (!Icon) return null;
  return <Icon {...props} />;
}
