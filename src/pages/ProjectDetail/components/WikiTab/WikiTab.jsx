import React, { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import WikiPageList from './WikiPageList';
import WikiPageViewer from './WikiPageViewer';

const WikiPageEditor = lazy(() => import('./WikiPageEditor'));
import {
  clearError,
  clearCurrentPage,
  createPage,
  deletePage,
  generateStarterPage,
  loadPages,
  selectCurrentPage,
  selectError,
  selectIsGenerating,
  selectIsLoading,
  selectIsSaving,
  selectPagesByProject,
  setCurrentPage,
  updatePage,
} from '../../../../store/slices/wikiSlice';

export default function WikiTab({ projectId }) {
  const { t, i18n } = useTranslation();
  const dispatch = useDispatch();

  const pages = useSelector(selectPagesByProject(projectId));
  const currentPage = useSelector(selectCurrentPage);
  const isLoading = useSelector(selectIsLoading);
  const isGenerating = useSelector(selectIsGenerating);
  const error = useSelector(selectError);
  const isSaving = useSelector(selectIsSaving);
  const [theme, setTheme] = useState(
    document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'
  );
  useEffect(() => {
    const observer = new MutationObserver(() => {
      setTheme(document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  const [starterAttempted, setStarterAttempted] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [pagesLoaded, setPagesLoaded] = useState(false);

  useEffect(() => {
    if (!projectId) return;
    dispatch(loadPages(projectId)).finally(() => setPagesLoaded(true));
  }, [dispatch, projectId]);

  useEffect(() => {
    if (!projectId || !pagesLoaded || isGenerating) return;
    if (pages.length > 0 || starterAttempted) return;

    setStarterAttempted(true);
    dispatch(generateStarterPage({ projectId, options: { language: i18n.language } }))
      .unwrap()
      .then((result) => {
        if (result?.result?.page) {
          dispatch(loadPages(projectId));
        }
      })
      .catch(() => {
        // handled by slice error state
      });
  }, [dispatch, i18n.language, isGenerating, pagesLoaded, pages.length, projectId, starterAttempted]);

  const pageCount = useMemo(() => pages.length, [pages.length]);

  useEffect(() => {
    if (!currentPage && pageCount > 0) {
      dispatch(setCurrentPage(pages[0]));
    }
  }, [currentPage, dispatch, pageCount, pages]);

  // Reset edit mode when switching to a different page
  useEffect(() => {
    setIsEditing(false);
  }, [currentPage?.id]);

  const handleCreate = async () => {
    const title = t('projects.wiki.generation.defaultTitle');
    const result = await dispatch(createPage({
      project_id: projectId,
      title,
    }));
    if (createPage.fulfilled.match(result) && result.payload) {
      dispatch(setCurrentPage(result.payload));
      setIsEditing(true);
    }
  };

  const handleSave = async (pageData) => {
    const result = await dispatch(updatePage({
      id: pageData.id,
      data: {
        title: pageData.title,
        content_md: pageData.content_md || '',
      },
    }));
    if (updatePage.rejected.match(result)) {
      throw new Error(result.error?.message || 'Save failed');
    }
  };

  const handleDelete = async (page) => {
    if (!window.confirm(t('projects.wiki.list.deleteConfirm'))) return;
    await dispatch(deletePage({ id: page.id, projectId }));
  };

  if (isLoading) {
    return (
      <div className="p-4 text-sm text-[var(--color-text-tertiary)]">
        {t('common.loading')}
      </div>
    );
  }

  if (isGenerating) {
    return (
      <div className="p-4 text-sm text-[var(--color-text-tertiary)]">
        {t('projects.wiki.generation.title')}
      </div>
    );
  }

  if (pages.length === 0) {
    return (
      <div className="p-6 border border-[var(--color-border-secondary)] rounded-lg bg-[var(--color-bg-secondary)]">
        <h3 className="text-base font-semibold text-[var(--color-text-primary)]">{t('projects.wiki.emptyState.title')}</h3>
        <p className="mt-1 text-sm text-[var(--color-text-tertiary)]">{t('projects.wiki.emptyState.description')}</p>

        {error ? (
          <div className="mt-3 p-3 rounded border border-[var(--color-border-secondary)] bg-[var(--color-bg-primary)] text-sm text-[var(--color-text-secondary)]">
            <p>{t('projects.wiki.generation.error')}</p>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                className="px-2 py-1 text-xs rounded border border-[var(--color-border-secondary)]"
                onClick={() => {
                  dispatch(clearError());
                  setStarterAttempted(false);
                }}
              >
                {t('projects.wiki.generation.retry')}
              </button>
              <button
                type="button"
                className="px-2 py-1 text-xs rounded border border-[var(--color-border-secondary)]"
                onClick={handleCreate}
              >
                {t('projects.wiki.generation.createManually')}
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            className="mt-3 px-3 py-2 text-sm rounded text-white bg-[var(--color-primary)]"
            onClick={handleCreate}
          >
            {t('projects.wiki.emptyState.createFirst')}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-260px)] min-h-[520px]">
      {error ? (
        <div
          data-testid="wiki-error-banner"
          className="mb-3 px-3 py-2 rounded border border-[var(--color-border-secondary)] bg-[var(--color-bg-primary)] text-sm text-[var(--color-text-secondary)] flex items-center justify-between gap-3"
        >
          <span>{t('projects.wiki.editor.errorBanner')}: {error}</span>
          <button
            type="button"
            data-testid="wiki-error-dismiss"
            className="text-xs px-2 py-1 rounded border border-[var(--color-border-secondary)]"
            onClick={() => dispatch(clearError())}
          >
            {t('projects.wiki.editor.dismiss')}
          </button>
        </div>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-3 h-full">
      <WikiPageList
        pages={pages}
        currentPageId={currentPage?.id || null}
        onSelect={(page) => dispatch(setCurrentPage(page))}
        onDelete={handleDelete}
        onNewPage={handleCreate}
      />

      <Suspense
        fallback={
          <div className="h-full flex items-center justify-center text-sm text-[var(--color-text-tertiary)]">
            {t('common.loading')}
          </div>
        }
      >
        {isEditing ? (
          <WikiPageEditor
            page={currentPage}
            onSave={handleSave}
            onCancel={() => setIsEditing(false)}
            onClose={() => setIsEditing(false)}
            theme={theme}
            isSaving={isSaving}
          />
        ) : (
          <WikiPageViewer
            page={currentPage}
            onEdit={() => setIsEditing(true)}
          />
        )}
      </Suspense>
      </div>
    </div>
  );
}
