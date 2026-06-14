import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import MDEditor from '@uiw/react-md-editor';

export default function WikiPageEditor({ page, onSave, onCancel, onClose, theme = 'light', isSaving = false }) {
  const { t } = useTranslation();

  const [title, setTitle] = useState(page?.title || '');
  const [content, setContent] = useState(page?.content_md || '');
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);

  useEffect(() => {
    setTitle(page?.title || '');
    setContent(page?.content_md || '');
    setShowCloseConfirm(false);
  }, [page?.id]);

  const editorTheme = useMemo(() => (theme === 'dark' ? 'dark' : 'light'), [theme]);

  const isDirty =
    (title || '') !== (page?.title || '') ||
    (content || '') !== (page?.content_md || '');

  const handleClose = () => {
    if (isDirty) {
      setShowCloseConfirm(true);
    } else if (onClose) {
      onClose();
    }
  };

  const handleConfirmDiscard = () => {
    setShowCloseConfirm(false);
    if (onClose) onClose();
  };

  const handleKeepEditing = () => {
    setShowCloseConfirm(false);
  };

  if (!page) {
    return (
      <div className="h-full border border-[var(--color-border-secondary)] rounded-lg bg-[var(--color-bg-secondary)] p-4 text-sm text-[var(--color-text-tertiary)]">
        {t('projects.wiki.emptyState.description')}
      </div>
    );
  }

  return (
    <div className="relative h-full">
      <div
        data-testid="wiki-page-editor"
        data-page-title={page.title || ''}
        data-is-dirty={isDirty ? 'true' : 'false'}
        className="h-full border border-[var(--color-border-secondary)] rounded-lg bg-[var(--color-bg-secondary)] p-3 flex flex-col gap-3"
        data-color-mode={editorTheme}
      >
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder={t('projects.wiki.editor.titlePlaceholder')}
            className="flex-1 rounded border border-[var(--color-border-secondary)] bg-[var(--color-bg-input)] px-3 py-2 text-sm text-[var(--color-text-primary)]"
          />
          {onClose ? (
            <button
              type="button"
              data-testid="editor-close"
              onClick={handleClose}
              className="px-3 py-2 rounded border border-[var(--color-border-secondary)] text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-border-subtle)]"
              title={t('projects.wiki.editor.close')}
            >
              {t('projects.wiki.editor.close')}
            </button>
          ) : null}
        </div>

        <div className="flex-1 min-h-0 overflow-auto">
          <MDEditor value={content} onChange={(value) => setContent(value || '')} preview="live" height={420} />
        </div>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            className="px-3 py-1.5 rounded border border-[var(--color-border-secondary)] text-sm text-[var(--color-text-secondary)]"
            onClick={onCancel}
          >
            {t('projects.wiki.editor.cancel')}
          </button>
          <button
            type="button"
            className="px-3 py-1.5 rounded text-sm text-white bg-[var(--color-primary)] disabled:opacity-50"
            disabled={isSaving}
            onClick={async () => {
              try {
                await onSave({ ...page, title, content_md: content });
                if (onClose) onClose();
              } catch (_err) {
                // error surfaced via Redux state; do not close editor
              }
            }}
          >
            {t('projects.wiki.editor.save')}
          </button>
        </div>
      </div>

      {showCloseConfirm ? (
        <div
          data-testid="editor-close-confirm"
          className="absolute inset-0 z-10 flex items-center justify-center bg-black/40 rounded-lg"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-[var(--color-bg-primary)] border border-[var(--color-border-secondary)] rounded-lg p-4 w-full max-w-sm flex flex-col gap-3 shadow-lg">
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
              {t('projects.wiki.editor.closeConfirmTitle')}
            </h3>
            <p className="text-sm text-[var(--color-text-secondary)]">
              {t('projects.wiki.editor.closeConfirmMessage')}
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                data-testid="editor-close-keep"
                onClick={handleKeepEditing}
                className="px-3 py-1.5 rounded border border-[var(--color-border-secondary)] text-sm text-[var(--color-text-secondary)]"
              >
                {t('projects.wiki.editor.closeConfirmKeep')}
              </button>
              <button
                type="button"
                data-testid="editor-close-discard"
                onClick={handleConfirmDiscard}
                className="px-3 py-1.5 rounded text-sm text-white bg-[var(--color-danger)] hover:opacity-90"
              >
                {t('projects.wiki.editor.closeConfirmDiscard')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
