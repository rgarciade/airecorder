import React from 'react';
import { useTranslation } from 'react-i18next';

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export default function WikiPageList({ pages, currentPageId, onSelect, onDelete, onNewPage }) {
  const { t } = useTranslation();

  return (
    <div className="h-full border border-[var(--color-border-secondary)] rounded-lg bg-[var(--color-bg-secondary)] flex flex-col">
      <div className="p-3 border-b border-[var(--color-border-secondary)] flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">{t('projects.wiki.tab')}</h3>
        <button
          type="button"
          className="px-2 py-1 text-xs rounded border border-[var(--color-border-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-border-subtle)]"
          onClick={onNewPage}
        >
          {t('projects.wiki.list.newPage')}
        </button>
      </div>

      <ul className="overflow-auto flex-1 p-2 space-y-2">
        {pages.map((page) => (
          <li
            key={page.id}
            className={`p-2 rounded border cursor-pointer ${
              currentPageId === page.id
                ? 'border-[var(--color-primary)] bg-[var(--color-primary-bg)]'
                : 'border-[var(--color-border-secondary)] hover:bg-[var(--color-border-subtle)]'
            }`}
            onClick={() => onSelect(page)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(page); } }}
            role="button"
            tabIndex={0}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium text-[var(--color-text-primary)] truncate">{page.title}</span>
              {page.is_verified ? (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-status-success-bg)] text-[var(--color-status-success-text)]">
                  {t('projects.wiki.page.verified')}
                </span>
              ) : null}
            </div>
            <div className="mt-1 text-[11px] text-[var(--color-text-tertiary)]">
              {t('projects.wiki.page.lastEdited')}: {formatDate(page.updated_at)}
            </div>
            <div className="mt-2 flex justify-end">
              <button
                type="button"
                className="text-xs text-[var(--color-text-tertiary)] hover:text-[var(--color-error)]"
                onClick={(event) => {
                  event.stopPropagation();
                  onDelete(page);
                }}
              >
                {t('common.delete')}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
