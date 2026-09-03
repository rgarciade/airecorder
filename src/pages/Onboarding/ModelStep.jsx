/**
 * ModelStep.jsx — paso de onboarding "Modelo de transcripción" (PR3, Fase 2).
 *
 * Presentacional: todo el estado (catálogo, selección, descarga) vive en
 * `useModelDownloadStep.js` (Fase 1) — este componente solo lo consume y
 * renderiza, sin estado nuevo en `Onboarding.jsx` (regla anti-monolito de
 * `AGENTS.md`). Excepción explícita: el tracking de persistencia ONB4
 * (`useOnboardingModelPersistence.js`) SÍ vive en `Onboarding.jsx` — ver el
 * prop `onDownloadStart` recibido acá y reenviado al hook (fix post-review
 * PR3, BLOCKER — ver JSDoc de `useModelDownloadStep.js`).
 *
 * Reutiliza claves i18n ya existentes de `settings.modelsSection.states.*`
 * (mismo estilo de estados que `ModelsSection.jsx` de PR2), `settings.modelsSection.errors.*`
 * (para el error síncrono de `startDownload`, mismo criterio) y
 * `settings.misc.recommended` en vez de duplicarlas bajo el namespace
 * `onboarding.*` — mismo criterio de reuso cross-namespace ya usado en
 * `ReadyStep.jsx` (`settings.roles.*`).
 *
 * ONB3 — el botón "Siguiente" NUNCA se deshabilita por el estado de la
 * descarga: el paso es no bloqueante por diseño, a diferencia de
 * `PermissionsStep`/`AiConfigStep` que sí condicionan su avance.
 */
import React from 'react';
import { FaArrowRight, FaDownload, FaCheckCircle } from 'react-icons/fa';
import OnboardingFooter from './OnboardingFooter';
import { useModelDownloadStep } from './useModelDownloadStep';
import { formatGb } from '../../utils/formatBytes.js';

const STATE_KEY_MAP = {
  'not-installed': 'notInstalled',
  queued: 'queued',
  downloading: 'downloading',
  installed: 'installed',
  deleting: 'deleting',
  error: 'error',
};

// Códigos síncronos que puede devolver `resources:download` (BLOCKER, fix
// post-review PR3 — ver JSDoc de `useModelDownloadStep.js`). No son los
// mismos códigos que `items[].error.code` (esos vienen de `processQueue()`
// y ya se mapean en `ModelsSection.jsx`); acá alcanza con reusar las claves
// i18n ya existentes (`insufficientSpace`/`unknown`) sin duplicar el mapeo
// completo de PR2.
const START_ERROR_KEY_MAP = {
  'insufficient-space': 'insufficientSpace',
  'unknown-model': 'unknown',
  'already-queued': 'unknown',
  'already-installed': 'unknown',
};

const ModelStep = ({ t, onBack, onNext, StepProgressComponent, onDownloadStart }) => {
  const { items, queue, selectedId, selectModel, startDownload, status, startError } = useModelDownloadStep({ onDownloadStart });

  const queueEntryFor = (id) => (queue || []).find((entry) => entry.id === id);
  const selectedItem = items.find((item) => item.id === selectedId);
  const canDownload = !!selectedItem && selectedItem.state === 'not-installed';

  return (
    <div className="flex flex-col h-screen bg-slate-50 dark:bg-surface-primary overflow-hidden">
      <div className="flex-1 max-w-3xl mx-auto w-full px-8 py-8 flex flex-col overflow-y-auto">
        {StepProgressComponent && (
          <div className="mb-6 w-full">{StepProgressComponent}</div>
        )}

        <div className="mb-8">
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-content-primary mb-2">
            {t('onboarding.model.title')}
          </h1>
          <p className="text-slate-500 dark:text-content-secondary text-base leading-relaxed">
            {t('onboarding.model.subtitle')}
          </p>
        </div>

        {status === 'loading' && (
          <p className="text-slate-500 dark:text-content-secondary text-sm" data-testid="model-step-loading">
            {t('onboarding.model.loading')}
          </p>
        )}

        {status === 'error' && (
          <p className="text-red-500 text-sm" data-testid="model-step-load-error">
            {t('onboarding.model.loadError')}
          </p>
        )}

        <div className="flex flex-col gap-3" data-testid="model-catalog">
          {items.map((item) => {
            const queueEntry = queueEntryFor(item.id);
            const stateKey = STATE_KEY_MAP[item.state] || 'notInstalled';
            const isSelected = item.id === selectedId;

            return (
              <label
                key={item.id}
                data-testid={`model-option-${item.id}`}
                className={`flex items-center gap-4 bg-white dark:bg-surface-secondary border rounded-2xl p-4 cursor-pointer transition-colors ${
                  isSelected
                    ? 'border-blue-500 ring-1 ring-blue-500'
                    : 'border-slate-200 dark:border-edge-primary'
                }`}
              >
                <input
                  type="radio"
                  name="onboarding-model"
                  value={item.id}
                  checked={isSelected}
                  onChange={() => selectModel(item.id)}
                  data-testid={`model-radio-${item.id}`}
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 dark:text-content-primary">
                      {item.id}
                      {item.recommended ? ` ${t('settings.misc.recommended')}` : ''}
                    </span>
                    <span className="text-xs text-slate-400 dark:text-content-secondary">
                      {formatGb(item.estimatedBytes)}
                    </span>
                    {item.state === 'installed' && (
                      <FaCheckCircle className="text-emerald-500" size={12} />
                    )}
                  </div>
                  <span
                    className="text-xs text-slate-500 dark:text-content-secondary"
                    data-testid={`model-state-${item.id}`}
                  >
                    {t(`settings.modelsSection.states.${stateKey}`)}
                  </span>
                  {item.state === 'downloading' && (
                    <span
                      className="ml-2 text-xs text-blue-500 font-semibold"
                      data-testid={`model-progress-${item.id}`}
                    >
                      {queueEntry?.percent ?? 0}%
                    </span>
                  )}
                </div>
              </label>
            );
          })}
        </div>

        {startError && (
          <p className="mt-4 text-red-500 text-sm" data-testid="model-start-error">
            {t(`settings.modelsSection.errors.${START_ERROR_KEY_MAP[startError.code] || 'unknown'}`)}
          </p>
        )}

        {canDownload && (
          <button
            type="button"
            onClick={startDownload}
            data-testid="model-download-btn"
            className="mt-6 self-start flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm transition-colors"
          >
            <FaDownload size={12} /> {t('onboarding.model.downloadBtn')}
          </button>
        )}
      </div>

      <OnboardingFooter onBack={onBack} t={t}>
        <button
          type="button"
          onClick={onNext}
          data-testid="model-step-next"
          className="flex items-center gap-2 px-8 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 hover:shadow-md hover:-translate-y-0.5 transition-all"
        >
          {t('onboarding.model.nextBtn')}
          <FaArrowRight size={14} />
        </button>
      </OnboardingFooter>
    </div>
  );
};

export default ModelStep;
