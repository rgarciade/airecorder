import React from 'react';
import { MdRefresh } from 'react-icons/md';
import { getCodexModel } from '../../services/ai/codexModelSelection';

export default function CodexModelControls({
  t,
  models,
  loading,
  error,
  model,
  reasoningEffort,
  onModelChange,
  onReasoningEffortChange,
  onRefresh,
  disabled = false,
  classNames = {},
}) {
  const selected = getCodexModel(models, model);
  const hasCatalog = models.length > 0;
  const efforts = selected?.supportedReasoningEfforts || [];

  return <div className={classNames.container || ''}>
    <div className={classNames.labelRow || ''}>
      <label className={classNames.label || ''}>{t('settings.fields.model')}</label>
      <button type="button" className={classNames.refresh || ''} onClick={onRefresh} disabled={disabled || loading}>
        <MdRefresh size={16} className={loading ? (classNames.spinner || '') : ''} />
        {t('settings.buttons.refresh')}
      </button>
    </div>

    {hasCatalog ? <select
      className={classNames.input || ''}
      value={model}
      onChange={event => onModelChange(event.target.value)}
      disabled={disabled || loading}
      data-testid="codex-model-select"
    >
      {models.map(item => <option key={item.id} value={item.model}>{item.displayName}</option>)}
    </select> : <input
      className={classNames.input || ''}
      value={model}
      onChange={event => onModelChange(event.target.value)}
      placeholder={t('settings.providers.codexManualModelPlaceholder')}
      disabled={disabled || loading}
      data-testid="codex-model-fallback"
    />}

    {loading && <p className={classNames.help || ''}>{t('settings.providers.codexModelsLoading')}</p>}
    {!loading && error && <p className={classNames.error || classNames.help || ''}>{t('settings.providers.codexModelsError', { error })}</p>}
    {!loading && !hasCatalog && <p className={classNames.help || ''}>{t('settings.providers.codexManualModelHelp')}</p>}
    {selected?.description && <p className={classNames.help || ''}>{selected.description}</p>}

    {efforts.length > 0 && <div className={classNames.effortGroup || ''}>
      <label className={classNames.label || ''}>{t('settings.providers.codexReasoningEffort')}</label>
      <select
        className={classNames.input || ''}
        value={reasoningEffort}
        onChange={event => onReasoningEffortChange(event.target.value)}
        disabled={disabled || loading}
        data-testid="codex-effort-select"
      >
        {efforts.map(effort => <option key={effort} value={effort}>{t(`settings.providers.codexEfforts.${effort}`)}</option>)}
      </select>
    </div>}
  </div>;
}
