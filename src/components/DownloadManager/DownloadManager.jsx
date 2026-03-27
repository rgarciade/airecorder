import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { removeDownload } from '../../store/downloadsSlice';
import { MdDownload, MdExpandLess, MdExpandMore, MdClose, MdCheckCircle, MdError } from 'react-icons/md';

const PHASE_LABELS = {
  searching_python: 'Buscando Python...',
  creating_env:     'Creando entorno...',
  updating_pip:     'Preparando instalador...',
  downloading_torch:    'Descargando PyTorch...',
  downloading_pyannote: 'Descargando pyannote...',
  progress: '',
  done:  'Completado',
  error: 'Error',
};

function ProgressBar({ percent, status }) {
  const color =
    status === 'done'  ? 'bg-emerald-500' :
    status === 'error' ? 'bg-red-500' :
    'bg-blue-500';
  return (
    <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5 mt-1.5">
      <div
        className={`${color} h-1.5 rounded-full transition-all duration-300`}
        style={{ width: `${Math.min(100, percent || 0)}%` }}
      />
    </div>
  );
}

function DownloadItem({ item, onCancel, onDismiss }) {
  const isDone  = item.status === 'done';
  const isError = item.status === 'error';
  const phaseLabel = PHASE_LABELS[item.phase] ?? item.phase;

  return (
    <div className="flex flex-col gap-1 py-2.5 px-3 border-b border-slate-100 dark:border-slate-700 last:border-b-0">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {isDone  && <MdCheckCircle size={16} className="text-emerald-500 flex-shrink-0" />}
          {isError && <MdError       size={16} className="text-red-500 flex-shrink-0" />}
          {!isDone && !isError && (
            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
          )}
          <span className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">
            {item.name}
          </span>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {!isDone && !isError && item.cancellable && (
            <button
              onClick={onCancel}
              className="text-xs text-slate-400 hover:text-red-500 transition-colors"
              title="Cancelar"
            >
              Cancelar
            </button>
          )}
          {(isDone || isError) && (
            <button
              onClick={onDismiss}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
            >
              <MdClose size={16} />
            </button>
          )}
        </div>
      </div>

      <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
        {isError ? item.detail : (phaseLabel || item.detail || '')}
        {!isDone && !isError && item.percent > 0 && (
          <span className="ml-1 font-mono">{item.percent}%</span>
        )}
      </div>

      {!isDone && !isError && (
        <ProgressBar percent={item.percent} status={item.status} />
      )}
    </div>
  );
}

export default function DownloadManager() {
  const dispatch = useDispatch();
  const items = useSelector(state => state.downloads.items);
  const [expanded, setExpanded] = useState(false);

  // Auto-dismiss completados tras 4 segundos
  useEffect(() => {
    const doneItems = items.filter(i => i.status === 'done' || i.status === 'error');
    if (doneItems.length === 0) return;
    const timer = setTimeout(() => {
      doneItems.forEach(i => dispatch(removeDownload(i.id)));
    }, 4000);
    return () => clearTimeout(timer);
  }, [items, dispatch]);

  // Auto-expandir cuando llega un nuevo ítem activo
  useEffect(() => {
    if (items.some(i => i.status === 'downloading')) {
      setExpanded(true);
    }
  }, [items.length]);

  if (items.length === 0) return null;

  const activeCount = items.filter(i => i.status === 'downloading').length;
  const avgPercent = activeCount > 0
    ? Math.round(items.filter(i => i.status === 'downloading').reduce((s, i) => s + i.percent, 0) / activeCount)
    : 100;

  const handleCancel = (item) => {
    if (item.id === 'diarization-env') {
      window.electronAPI?.cancelDiarizationInstall?.();
    }
    dispatch(removeDownload(item.id));
  };

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        zIndex: 9000,
        width: expanded ? 320 : 'auto',
        minWidth: expanded ? 320 : 0,
      }}
    >
      {/* Panel expandido */}
      {expanded && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 mb-2 overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-slate-100 dark:border-slate-700">
            <span className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wide">
              Descargas activas
            </span>
            <button
              onClick={() => setExpanded(false)}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
            >
              <MdExpandMore size={18} />
            </button>
          </div>
          {items.map(item => (
            <DownloadItem
              key={item.id}
              item={item}
              onCancel={() => handleCancel(item)}
              onDismiss={() => dispatch(removeDownload(item.id))}
            />
          ))}
        </div>
      )}

      {/* Pastilla colapsada */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="flex items-center gap-2.5 px-4 py-2.5 bg-slate-900 dark:bg-slate-700 text-white rounded-2xl shadow-lg hover:bg-slate-800 dark:hover:bg-slate-600 transition-all"
      >
        <div className="relative">
          <MdDownload size={18} />
          {activeCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 bg-blue-500 rounded-full text-[8px] font-bold flex items-center justify-center">
              {activeCount}
            </span>
          )}
        </div>
        {activeCount > 0 ? (
          <>
            <div className="w-24 bg-slate-700 dark:bg-slate-600 rounded-full h-1.5">
              <div
                className="bg-blue-400 h-1.5 rounded-full transition-all duration-500"
                style={{ width: `${avgPercent}%` }}
              />
            </div>
            <span className="text-xs font-mono text-slate-300">{avgPercent}%</span>
          </>
        ) : (
          <span className="text-xs text-slate-300">Completado</span>
        )}
        {expanded ? <MdExpandMore size={16} /> : <MdExpandLess size={16} />}
      </button>
    </div>
  );
}
