import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import * as wikiService from '../../services/wikiService';

const initialState = {
  pagesByProject: {},
  currentPage: null,
  isLoading: false,
  isSaving: false,
  isGenerating: false,
  error: null,
};

export const loadPages = createAsyncThunk('wiki/loadPages', async (projectId) => {
  const pages = await wikiService.listPages(projectId);
  return { projectId, pages };
});

export const createPage = createAsyncThunk('wiki/createPage', async (data) => {
  const result = await wikiService.createPage(data);
  if (result?.success === false) {
    throw new Error(result.error || 'Error creating wiki page');
  }
  return result?.success ? result.page : result;
});

export const updatePage = createAsyncThunk('wiki/updatePage', async ({ id, data }) => {
  const result = await wikiService.updatePage(id, data);
  if (result?.success === false) {
    throw new Error(result.error || 'Error updating wiki page');
  }
  return result?.success ? result.page : result;
});

export const deletePage = createAsyncThunk('wiki/deletePage', async ({ id, projectId }) => {
  const result = await wikiService.deletePage(id);
  if (result?.success === false) {
    throw new Error(result.error || 'Error deleting wiki page');
  }
  return { id, projectId };
});

export const generateStarterPage = createAsyncThunk('wiki/generateStarterPage', async (payload) => {
  const projectId = typeof payload === 'object' ? payload.projectId : payload;
  const options = typeof payload === 'object' ? (payload.options || {}) : {};
  const result = await wikiService.generateStarterPage(projectId, options);
  return { projectId, result };
});

const wikiSlice = createSlice({
  name: 'wiki',
  initialState,
  reducers: {
    setCurrentPage(state, action) {
      state.currentPage = action.payload;
    },
    clearCurrentPage(state) {
      state.currentPage = null;
    },
    clearError(state) {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadPages.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(loadPages.fulfilled, (state, action) => {
        state.isLoading = false;
        state.pagesByProject[action.payload.projectId] = action.payload.pages;
      })
      .addCase(loadPages.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error?.message || 'Error loading wiki pages';
      })
      .addCase(createPage.pending, (state) => {
        state.isSaving = true;
        state.error = null;
      })
      .addCase(createPage.fulfilled, (state, action) => {
        state.isSaving = false;
        const page = action.payload;
        if (!state.pagesByProject[page.project_id]) {
          state.pagesByProject[page.project_id] = [];
        }
        state.pagesByProject[page.project_id].unshift(page);
      })
      .addCase(createPage.rejected, (state, action) => {
        state.isSaving = false;
        state.error = action.payload?.error || action.error?.message || 'Error creating wiki page';
      })
      .addCase(updatePage.pending, (state) => {
        state.isSaving = true;
        state.error = null;
      })
      .addCase(updatePage.fulfilled, (state, action) => {
        state.isSaving = false;
        const page = action.payload;
        const pages = state.pagesByProject[page.project_id] || [];
        const idx = pages.findIndex((p) => p.id === page.id);
        if (idx !== -1) {
          pages[idx] = page;
        }
        if (state.currentPage?.id === page.id) {
          state.currentPage = page;
        }
      })
      .addCase(updatePage.rejected, (state, action) => {
        state.isSaving = false;
        state.error = action.payload?.error || action.error?.message || 'Error updating wiki page';
      })
      .addCase(deletePage.pending, (state) => {
        state.error = null;
      })
      .addCase(deletePage.fulfilled, (state, action) => {
        const { id, projectId } = action.payload;
        const pages = state.pagesByProject[projectId] || [];
        state.pagesByProject[projectId] = pages.filter((p) => p.id !== id);
        if (state.currentPage?.id === id) {
          state.currentPage = null;
        }
      })
      .addCase(deletePage.rejected, (state, action) => {
        state.error = action.payload?.error || action.error?.message || 'Error deleting wiki page';
      })
      .addCase(generateStarterPage.pending, (state) => {
        state.isGenerating = true;
        state.error = null;
      })
      .addCase(generateStarterPage.fulfilled, (state) => {
        state.isGenerating = false;
      })
      .addCase(generateStarterPage.rejected, (state, action) => {
        state.isGenerating = false;
        state.error = action.error?.message || 'Error generating starter page';
      });
  },
});

export const { setCurrentPage, clearCurrentPage, clearError } = wikiSlice.actions;

export const selectPagesByProject = (projectId) => (state) => state.wiki.pagesByProject[projectId] || [];
export const selectCurrentPage = (state) => state.wiki.currentPage;
export const selectIsLoading = (state) => state.wiki.isLoading;
export const selectError = (state) => state.wiki.error;
export const selectIsGenerating = (state) => state.wiki.isGenerating;
export const selectIsSaving = (state) => state.wiki.isSaving;

export default wikiSlice.reducer;
