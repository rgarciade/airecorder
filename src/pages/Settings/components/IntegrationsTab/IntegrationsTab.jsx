import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { MdLink, MdLinkOff, MdRefresh, MdCheck, MdClose, MdOpenInNew } from 'react-icons/md';
import { getSettings } from '../../../../services/settingsService';
import styles from '../../Settings.module.css';
import ownStyles from './IntegrationsTab.module.css';

const PLATFORMS = ['google-chat', 'teams'];

export default function IntegrationsTab() {
  const { t } = useTranslation();

  const [connections, setConnections] = useState([]);
  const [credentials, setCredentials] = useState({
    'google-chat': { clientId: '', clientSecret: '' },
    teams: { clientId: '' }
  });
  const [connecting, setConnecting] = useState(null);   // platform en proceso
  const [disconnecting, setDisconnecting] = useState(null);
  const [statusMsg, setStatusMsg] = useState({});       // platform → { ok, text }

  useEffect(() => {
    loadConnections();
    loadStoredCredentials();
  }, []);

  async function loadConnections() {
    try {
      const list = await window.electronAPI.getPlatformConnections();
      setConnections(list || []);
    } catch { /* ignore */ }
  }

  async function loadStoredCredentials() {
    try {
      const s = await getSettings();
      setCredentials({
        'google-chat': {
          clientId: s.googleChatClientId || '',
          clientSecret: s.googleChatClientSecret || ''
        },
        teams: { clientId: s.teamsClientId || '' }
      });
    } catch { /* ignore */ }
  }

  function getConnection(platform) {
    return connections.find(c => c.platform === platform) || null;
  }

  function setMsg(platform, ok, text) {
    setStatusMsg(prev => ({ ...prev, [platform]: { ok, text } }));
  }

  async function handleConnect(platform) {
    const creds = credentials[platform];
    if (!creds?.clientId || (platform === 'google-chat' && !creds?.clientSecret)) {
      setMsg(platform, false, t('settings.integrations.errors.missingCredentials'));
      return;
    }
    setConnecting(platform);
    setStatusMsg(prev => ({ ...prev, [platform]: null }));
    try {
      // Guardar credenciales en settings antes de lanzar OAuth
      const currentSettings = await getSettings();
      const updatedSettings = { ...currentSettings };
      if (platform === 'google-chat') {
        updatedSettings.googleChatClientId = creds.clientId;
        updatedSettings.googleChatClientSecret = creds.clientSecret;
      } else if (platform === 'teams') {
        updatedSettings.teamsClientId = creds.clientId;
      }
      await window.electronAPI.saveSettings(updatedSettings);

      const result = await window.electronAPI.startOAuthFlow({
        platform,
        settings: {
          googleChatClientId: updatedSettings.googleChatClientId,
          googleChatClientSecret: updatedSettings.googleChatClientSecret,
          teamsClientId: updatedSettings.teamsClientId
        }
      });

      if (!result.success) {
        setMsg(platform, false, t('settings.integrations.errors.oauthFailed', { error: result.error }));
      } else {
        setMsg(platform, true, t('settings.integrations.connectedAs', { name: result.connection.accountName }));
        await loadConnections();
      }
    } catch (err) {
      setMsg(platform, false, t('settings.integrations.errors.connectionFailed'));
    } finally {
      setConnecting(null);
    }
  }

  async function handleDisconnect(connectionId, platform) {
    if (!window.confirm(t('settings.integrations.disconnectConfirm'))) return;
    setDisconnecting(connectionId);
    try {
      await window.electronAPI.disconnectPlatform(connectionId);
      await loadConnections();
      setMsg(platform, null, null);
    } finally {
      setDisconnecting(null);
    }
  }

  function updateCredential(platform, field, value) {
    setCredentials(prev => ({
      ...prev,
      [platform]: { ...prev[platform], [field]: value }
    }));
  }

  return (
    <div>
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>{t('settings.integrations.title')}</h3>
        <p className={styles.providerDesc}>{t('settings.integrations.description')}</p>

        <div className={ownStyles.platformList}>
          {PLATFORMS.map(platform => {
            const conn = getConnection(platform);
            const creds = credentials[platform];
            const isConnecting = connecting === platform;
            const msg = statusMsg[platform];
            const platformT = t(`settings.integrations.platforms.${platform}`);

            return (
              <div key={platform} className={ownStyles.platformCard}>
                <div className={ownStyles.platformHeader}>
                  <div className={ownStyles.platformInfo}>
                    <span className={ownStyles.platformName}>
                      {t(`settings.integrations.platforms.${platform}.name`)}
                    </span>
                    <span className={ownStyles.platformDesc}>
                      {t(`settings.integrations.platforms.${platform}.description`)}
                    </span>
                  </div>
                  <span className={conn ? ownStyles.badgeConnected : ownStyles.badgeDisconnected}>
                    {conn ? t('settings.integrations.connected') : t('settings.integrations.notConnected')}
                  </span>
                </div>

                {conn ? (
                  /* ── Cuenta conectada ── */
                  <div className={ownStyles.connectedRow}>
                    <MdCheck size={16} style={{ color: 'var(--color-success)', flexShrink: 0 }} />
                    <span className={ownStyles.connectedName}>
                      {t('settings.integrations.connectedAs', { name: conn.accountName })}
                    </span>
                    <button
                      className={styles.checkBtn}
                      onClick={() => handleDisconnect(conn.id, platform)}
                      disabled={disconnecting === conn.id}
                    >
                      {disconnecting === conn.id
                        ? <MdRefresh size={16} className={styles.spinner} />
                        : <MdLinkOff size={16} />}
                      {t('settings.integrations.disconnect')}
                    </button>
                  </div>
                ) : (
                  /* ── Formulario de credenciales ── */
                  <div className={ownStyles.credentialsForm}>
                    <p className={styles.helpText}>
                      {t(`settings.integrations.platforms.${platform}.help`)}
                    </p>

                    <div className={styles.formGroup}>
                      <label className={styles.label}>{t('settings.integrations.clientId')}</label>
                      <input
                        type="text"
                        className={styles.input}
                        value={creds.clientId}
                        onChange={e => updateCredential(platform, 'clientId', e.target.value)}
                        placeholder={t('settings.integrations.clientIdPlaceholder')}
                        autoComplete="off"
                      />
                    </div>

                    {platform === 'google-chat' && (
                      <div className={styles.formGroup}>
                        <label className={styles.label}>{t('settings.integrations.clientSecret')}</label>
                        <input
                          type="password"
                          className={styles.input}
                          value={creds.clientSecret}
                          onChange={e => updateCredential(platform, 'clientSecret', e.target.value)}
                          placeholder={t('settings.integrations.clientSecretPlaceholder')}
                          autoComplete="off"
                        />
                      </div>
                    )}

                    <button
                      className={styles.checkBtn}
                      onClick={() => handleConnect(platform)}
                      disabled={isConnecting}
                    >
                      {isConnecting
                        ? <MdRefresh size={16} className={styles.spinner} />
                        : <MdLink size={16} />}
                      {isConnecting ? t('settings.misc.loading') : t('settings.integrations.connect')}
                    </button>
                  </div>
                )}

                {msg?.text && (
                  <p className={msg.ok ? styles.helpText : styles.errorText}
                     style={msg.ok ? { color: 'var(--color-success)' } : undefined}>
                    {msg.text}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
