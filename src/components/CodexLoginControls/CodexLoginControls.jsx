import React, { useEffect, useRef, useState } from 'react';
import styles from './CodexLoginControls.module.css';

/** Shared renderer-side device-auth flow. Progress remains public/structured IPC data. */
export default function CodexLoginControls({ t, onStatus, className = '', disabled = false, connected = false }) {
  const [busy, setBusy] = useState(false);
  const [requestId, setRequestId] = useState(null);
  const [progress, setProgress] = useState(null);
  const mounted = useRef(true);
  const activeRequestId = useRef(null);
  const unsubscribe = useRef(null);

  const cleanup = () => {
    unsubscribe.current?.();
    unsubscribe.current = null;
  };

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (activeRequestId.current) window.electronAPI?.cancelCodexLogin?.(activeRequestId.current);
      cleanup();
    };
  }, []);

  const connect = async () => {
    if (connected || disabled || activeRequestId.current) return;
    const id = `codex-login-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    activeRequestId.current = id;
    setRequestId(id);
    setBusy(true);
    setProgress({ text: t('settings.providers.codexLoginInstructions') });
    unsubscribe.current = window.electronAPI?.onCodexLoginProgress?.((event) => {
      if (mounted.current && event?.requestId === id) {
        setProgress(current => ({
          text: event.phase === 'device-auth' ? t('settings.providers.codexDeviceAuthInstructions') : current?.text,
          code: event.code || current?.code,
          url: event.url || current?.url,
        }));
      }
    });
    try {
      const result = await window.electronAPI?.startCodexLogin?.(id);
      if (mounted.current) {
        onStatus?.(result);
        setProgress(result?.success ? { text: t('settings.providers.codexConnected') } : { text: result?.error || result?.message || t('settings.providers.codexLoginFailed') });
      }
    } catch (error) {
      if (mounted.current) setProgress({ text: error.message || t('settings.providers.codexLoginFailed') });
    } finally {
      cleanup();
      if (mounted.current) { activeRequestId.current = null; setBusy(false); setRequestId(null); }
    }
  };

  const cancel = async () => {
    if (!requestId) return;
    await window.electronAPI?.cancelCodexLogin?.(requestId);
    if (mounted.current) setProgress({ text: t('settings.providers.codexLoginFailed') });
  };

  return <div className={`${styles.container} ${className}`.trim()}>
    {progress && <div className={styles.progress} role="status" aria-live="polite">
      {progress.text && <p className={styles.statusText}>{progress.text}</p>}
      {progress.code && <div className={styles.codeGroup}>
        <span className={styles.label}>{t('settings.providers.codexCodeLabel')}</span>
        <code className={styles.code} tabIndex="0" aria-label={t('settings.providers.codexCodeLabel')} data-testid="codex-login-code">{progress.code}</code>
      </div>}
      {progress.url && <a className={styles.link} href={progress.url} target="_blank" rel="noopener noreferrer" aria-label={t('settings.providers.codexOfficialLink')} data-testid="codex-login-url">
        <span>{t('settings.providers.codexOfficialLink')}</span>
        <span className={styles.linkUrl}>{progress.url}</span>
      </a>}
    </div>}
    <div className={styles.actions}>
      <button className={styles.primaryButton} type="button" onClick={connect} disabled={busy || disabled || connected} aria-busy={busy}>{busy ? t('settings.providers.codexConnecting') : connected ? t('settings.providers.codexConnected') : t('settings.providers.codexConnect')}</button>
      {busy && <button className={styles.secondaryButton} type="button" onClick={cancel}>{t('settings.providers.codexCancel')}</button>}
    </div>
  </div>;
}
