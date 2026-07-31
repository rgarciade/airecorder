import React from 'react';
import {
  REGENERATION_PROVIDER_OPTIONS,
  canUseRegenerationProvider,
} from '../../../services/ai/regenerationProvider';

export default function RegenerationProviderSelect({
  value,
  onChange,
  codexStatus,
  customConnections = [],
  className = '',
}) {
  return (
    <select
      className={className}
      value={value}
      onChange={onChange}
      data-testid="regeneration-provider-select"
    >
      {REGENERATION_PROVIDER_OPTIONS.map(provider => (
        <option
          key={provider.value}
          value={provider.value}
          disabled={!canUseRegenerationProvider(provider.value, { codexStatus })}
        >
          {provider.label}
        </option>
      ))}
      {customConnections.map(connection => (
        <option key={connection.id} value={`custom:${connection.id}`}>{connection.name}</option>
      ))}
    </select>
  );
}
