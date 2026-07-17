import React from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Computes the role badge key and active state for a provider.
 * Returns { label: string | null, isActive: boolean }
 * - label: i18n key suffix ("both" / "chat" / "embeddings") for use with t(`settings.roles.${label}`)
 * - null when inactive in both roles (hide badge)
 */
export function getRoleBadge(aiProvider, embeddingProvider, providerKey) {
  const isChat = aiProvider === providerKey;
  const isEmbed = embeddingProvider === providerKey;

  if (isChat && isEmbed) return { label: 'both', isActive: true };
  if (isChat) return { label: 'chat', isActive: true };
  if (isEmbed) return { label: 'embeddings', isActive: true };
  return { label: null, isActive: false };
}

export default function RoleBadge({ aiProvider, embeddingProvider, providerKey, styles }) {
  const { t } = useTranslation();
  const { label, isActive } = getRoleBadge(aiProvider, embeddingProvider, providerKey);

  if (!label) return null;

  return (
    <span
      className={`${styles.badge} ${isActive ? styles.badgeActive : styles.badgeInactive}`}
      style={{ fontSize: '0.7rem', marginLeft: '4px' }}
    >
      {t(`settings.roles.${label}`)}
    </span>
  );
}
