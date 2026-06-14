import React from 'react';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const markdownComponents = {
  h1: ({ children }) => <h1 className="text-2xl font-bold text-[var(--color-text-primary)] mt-6 mb-3 pb-1 border-b border-[var(--color-border-secondary)]">{children}</h1>,
  h2: ({ children }) => <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mt-5 mb-2">{children}</h2>,
  h3: ({ children }) => <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mt-4 mb-2">{children}</h3>,
  h4: ({ children }) => <h4 className="text-base font-semibold text-[var(--color-text-primary)] mt-3 mb-1">{children}</h4>,
  p: ({ children }) => <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed mb-3">{children}</p>,
  ul: ({ children }) => <ul className="list-disc list-inside text-sm text-[var(--color-text-secondary)] mb-3 space-y-1">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal list-inside text-sm text-[var(--color-text-secondary)] mb-3 space-y-1">{children}</ol>,
  li: ({ children }) => <li className="text-sm leading-relaxed">{children}</li>,
  blockquote: ({ children }) => <blockquote className="border-l-4 border-[var(--color-primary)] pl-4 py-1 my-3 text-sm italic text-[var(--color-text-secondary)] bg-[var(--color-bg-primary)] rounded-r">{children}</blockquote>,
  code: ({ children, className: codeClassName }) => {
    const isInline = !codeClassName;
    return isInline ? (
      <code className="px-1.5 py-0.5 rounded text-xs font-mono bg-[var(--color-bg-input)] text-[var(--color-text-primary)]">{children}</code>
    ) : (
      <code className={`block p-4 rounded text-sm font-mono bg-[var(--color-bg-input)] text-[var(--color-text-primary)] overflow-x-auto my-3 ${codeClassName || ''}`}>{children}</code>
    );
  },
  pre: ({ children }) => <pre className="mb-3 last:mb-0">{children}</pre>,
  a: ({ children, href }) => <a href={href} className="text-[var(--color-primary)] underline hover:opacity-80" target="_blank" rel="noopener noreferrer">{children}</a>,
  strong: ({ children }) => <strong className="font-semibold text-[var(--color-text-primary)]">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  table: ({ children }) => <div className="overflow-x-auto my-3"><table className="min-w-full border-collapse border border-[var(--color-border-secondary)] text-sm">{children}</table></div>,
  thead: ({ children }) => <thead className="bg-[var(--color-bg-primary)]">{children}</thead>,
  th: ({ children }) => <th className="border border-[var(--color-border-secondary)] px-3 py-2 text-left font-semibold text-[var(--color-text-primary)]">{children}</th>,
  td: ({ children }) => <td className="border border-[var(--color-border-secondary)] px-3 py-2 text-[var(--color-text-secondary)]">{children}</td>,
  hr: () => <hr className="my-4 border-t border-[var(--color-border-secondary)]" />,
};

export default function WikiPageViewer({ page, onEdit }) {
  const { t } = useTranslation();

  if (!page) {
    return (
      <div className="h-full border border-[var(--color-border-secondary)] rounded-lg bg-[var(--color-bg-secondary)] p-4 text-sm text-[var(--color-text-tertiary)]">
        {t('projects.wiki.emptyState.description')}
      </div>
    );
  }

  const verifiedBadge = page.is_verified
    ? t('projects.wiki.viewer.verified')
    : t('projects.wiki.viewer.unverified');

  return (
    <div
      data-testid="wiki-page-viewer"
      className="h-full border border-[var(--color-border-secondary)] rounded-lg bg-[var(--color-bg-secondary)] p-4 flex flex-col gap-3 overflow-auto"
    >
      <div className="flex items-center justify-between gap-3 border-b border-[var(--color-border-secondary)] pb-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">{page.title}</h2>
          <span
            className={`text-xs px-2 py-0.5 rounded inline-block w-fit ${
              page.is_verified
                ? 'bg-[var(--color-success-bg)] text-[var(--color-success-text)]'
                : 'bg-[var(--color-warning-bg)] text-[var(--color-warning-text)]'
            }`}
          >
            {verifiedBadge}
          </span>
        </div>
        <button
          type="button"
          data-testid="viewer-edit"
          onClick={onEdit}
          className="px-3 py-1.5 rounded text-sm text-white bg-[var(--color-primary)] hover:opacity-90"
        >
          {t('projects.wiki.viewer.edit')}
        </button>
      </div>

      <div className="flex-1">
        {page.content_md ? (
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
            {page.content_md}
          </ReactMarkdown>
        ) : (
          <p className="italic text-sm text-[var(--color-text-tertiary)]">
            {t('projects.wiki.emptyState.description')}
          </p>
        )}
      </div>
    </div>
  );
}
