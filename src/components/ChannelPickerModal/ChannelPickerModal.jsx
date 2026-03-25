import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { MdClose, MdRefresh, MdExpandMore, MdExpandLess } from 'react-icons/md';
import styles from './ChannelPickerModal.module.css';

/**
 * Modal para vincular canales de plataformas externas (Google Chat, Teams) a un chat.
 *
 * Props:
 *   onClose()                — cerrar sin vincular
 *   onLink(channels)         — channels: [{ connectionId, channelId, channelName, dateFrom, dateTo }]
 *   settings                 — { googleChatClientId, ... } para refrescar tokens
 */
export default function ChannelPickerModal({ onClose, onLink, settings = {} }) {
  const { t } = useTranslation();

  const [connections, setConnections] = useState([]);
  // expanded: Set de connectionId expandidos
  const [expanded, setExpanded] = useState(new Set());
  // channels por connectionId: { [id]: { status: 'idle'|'loading'|'error'|'ok', list: [] } }
  const [channelMap, setChannelMap] = useState({});
  // selección: { [channelKey]: { connectionId, channelId, channelName, dateFrom, dateTo } }
  const [selected, setSelected] = useState({});
  const [linking, setLinking] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    window.electronAPI.getPlatformConnections().then(list => setConnections(list || [])).catch(() => {});
  }, []);

  function channelKey(connectionId, channelId) {
    return `${connectionId}::${channelId}`;
  }

  async function toggleExpand(conn) {
    const id = conn.id;
    const next = new Set(expanded);
    if (next.has(id)) {
      next.delete(id);
      setExpanded(next);
      return;
    }
    next.add(id);
    setExpanded(next);

    if (channelMap[id]) return; // ya cargados

    setChannelMap(prev => ({ ...prev, [id]: { status: 'loading', list: [] } }));
    try {
      const res = await window.electronAPI.getAvailableChannels({ connectionId: id, settings });
      if (res.success) {
        setChannelMap(prev => ({ ...prev, [id]: { status: 'ok', list: res.channels } }));
      } else {
        setChannelMap(prev => ({ ...prev, [id]: { status: 'error', list: [] } }));
      }
    } catch {
      setChannelMap(prev => ({ ...prev, [id]: { status: 'error', list: [] } }));
    }
  }

  function toggleChannel(connectionId, channel) {
    const key = channelKey(connectionId, channel.id);
    setSelected(prev => {
      const next = { ...prev };
      if (next[key]) {
        delete next[key];
      } else {
        next[key] = { connectionId, channelId: channel.id, channelName: channel.name, dateFrom: '', dateTo: '' };
      }
      return next;
    });
  }

  function updateDate(connectionId, channelId, field, value) {
    const key = channelKey(connectionId, channelId);
    setSelected(prev => ({
      ...prev,
      [key]: { ...prev[key], [field]: value }
    }));
  }

  async function handleLink() {
    const channels = Object.values(selected);
    if (!channels.length) {
      setError(t('settings.integrations.channelPicker.selectAtLeastOne'));
      return;
    }
    setLinking(true);
    setError('');
    try {
      await onLink(channels.map(c => ({
        connectionId: c.connectionId,
        channelId: c.channelId,
        channelName: c.channelName,
        dateFrom: c.dateFrom || null,
        dateTo: c.dateTo || null
      })));
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLinking(false);
    }
  }

  const selectedCount = Object.keys(selected).length;

  return (
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <span className={styles.title}>{t('settings.integrations.channelPicker.title')}</span>
          <button className={styles.closeBtn} onClick={onClose}><MdClose size={18} /></button>
        </div>

        <div className={styles.body}>
          {connections.length === 0 ? (
            <p className={styles.empty}>{t('settings.integrations.channelPicker.noConnections')}</p>
          ) : (
            connections.map(conn => {
              const isExpanded = expanded.has(conn.id);
              const entry = channelMap[conn.id];
              return (
                <div key={conn.id} className={styles.connectionBlock}>
                  <button className={styles.connHeader} onClick={() => toggleExpand(conn)}>
                    <span className={styles.connName}>
                      {conn.platform === 'google-chat' ? 'Google Chat' : 'Microsoft Teams'}
                      <span className={styles.connAccount}> · {conn.accountName}</span>
                    </span>
                    {isExpanded ? <MdExpandLess size={16} /> : <MdExpandMore size={16} />}
                  </button>

                  {isExpanded && (
                    <div className={styles.channelList}>
                      {!entry || entry.status === 'loading' ? (
                        <p className={styles.loadingText}>{t('settings.integrations.channelPicker.loadingChannels')}</p>
                      ) : entry.status === 'error' ? (
                        <p className={styles.errorText}>{t('settings.integrations.channelPicker.loadError')}</p>
                      ) : entry.list.length === 0 ? (
                        <p className={styles.loadingText}>{t('settings.integrations.channelPicker.noChannels')}</p>
                      ) : (
                        entry.list.map(channel => {
                          const key = channelKey(conn.id, channel.id);
                          const isSelected = !!selected[key];
                          return (
                            <div key={channel.id} className={styles.channelRow}>
                              <label className={styles.channelLabel}>
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => toggleChannel(conn.id, channel)}
                                  className={styles.checkbox}
                                />
                                <span className={styles.channelName}>{channel.name}</span>
                              </label>
                              {isSelected && (
                                <div className={styles.dateRange}>
                                  <div className={styles.dateField}>
                                    <span className={styles.dateLabel}>{t('settings.integrations.channelPicker.dateFrom')}</span>
                                    <input
                                      type="date"
                                      className={styles.dateInput}
                                      value={selected[key].dateFrom}
                                      onChange={e => updateDate(conn.id, channel.id, 'dateFrom', e.target.value)}
                                    />
                                  </div>
                                  <div className={styles.dateField}>
                                    <span className={styles.dateLabel}>{t('settings.integrations.channelPicker.dateTo')}</span>
                                    <input
                                      type="date"
                                      className={styles.dateInput}
                                      value={selected[key].dateTo}
                                      onChange={e => updateDate(conn.id, channel.id, 'dateTo', e.target.value)}
                                    />
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {error && <p className={styles.error}>{error}</p>}

        <div className={styles.footer}>
          <button className={styles.cancelBtn} onClick={onClose} disabled={linking}>
            {t('common.cancel')}
          </button>
          <button
            className={styles.linkBtn}
            onClick={handleLink}
            disabled={linking || selectedCount === 0}
          >
            {linking
              ? <><MdRefresh size={14} className={styles.spinner} /> {t('settings.integrations.channelPicker.linking')}</>
              : `${t('settings.integrations.channelPicker.linkBtn')}${selectedCount > 0 ? ` (${selectedCount})` : ''}`
            }
          </button>
        </div>
      </div>
    </div>
  );
}
