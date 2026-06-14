const path = require('path');
const fs = require('fs');
let wikiQueries = require('../database/wiki/queries');
let projectsPathOverride = null;

function normalizeSlug(input = '') {
  return input
    .toString()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'pagina';
}

function resolveUniqueSlug(projectId, desiredSlug, excludeId = null) {
  const MAX_SUFFIX = 200;
  const base = normalizeSlug(desiredSlug);
  let candidate = base;
  let suffix = 2;

  while (true) {
    const existingPage = wikiQueries.getPageBySlug(projectId, candidate);
    if (!existingPage || existingPage.id === excludeId) {
      break;
    }

    if (suffix > MAX_SUFFIX) {
      throw new Error(`resolveUniqueSlug: could not find a unique slug after ${MAX_SUFFIX} attempts for base "${base}"`);
    }

    candidate = `${base}-${suffix}`;
    suffix += 1;
  }

  return candidate;
}

async function callStarterPageAI(projectName, analysisContent, language) {
  const moduleUrl = pathToFileURL(path.resolve(__dirname, '../../src/services/ai/providerRouter.js')).href;
  const promptModuleUrl = pathToFileURL(path.resolve(__dirname, '../../src/prompts/common/wikiPrompts.js')).href;

  const [{ callProvider }, { wikiStarterPagePrompt }] = await Promise.all([
    import(moduleUrl),
    import(promptModuleUrl),
  ]);

  const prompt = wikiStarterPagePrompt(projectName, analysisContent, language);
  const response = await callProvider(prompt, {
    queueMeta: {
      name: 'Wiki starter page',
      type: 'project_analysis',
    },
  });

  return response?.text || '';
}

let starterGenerator = callStarterPageAI;

function pathToFileURL(filePath) {
  const { pathToFileURL: toUrl } = require('url');
  return toUrl(filePath);
}

function registerWikiHandlers(ipcMain) {
  ipcMain.handle('wiki:list-pages', async (_event, projectId) => {
    try {
      const pages = wikiQueries.listPagesByProject(projectId);
      return { success: true, pages };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('wiki:create-page', async (_event, data) => {
    try {
      if (!data.project_id || !data.title?.trim()) {
        return { success: false, error: 'missing_required_fields' };
      }
      const slugInput = data.slug || data.title;
      const slug = resolveUniqueSlug(data.project_id, slugInput);
      const page = wikiQueries.createPage({
        project_id: data.project_id,
        slug,
        title: data.title,
      });
      return { success: true, page };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('wiki:update-page', async (_event, id, payload) => {
    try {
      const hasExplicitSlug = Object.prototype.hasOwnProperty.call(payload, 'slug');
      const hasTitleChange = Object.prototype.hasOwnProperty.call(payload, 'title');
      let finalPayload = payload;

      if (hasExplicitSlug || hasTitleChange) {
        const currentPage = wikiQueries.getPageById(id);
        if (!currentPage) {
          return { success: false, error: 'page_not_found' };
        }

        const slugInput = hasExplicitSlug ? payload.slug : payload.title;
        const desiredSlug = normalizeSlug(slugInput || currentPage.slug);

        if (desiredSlug !== currentPage.slug) {
          finalPayload = { ...payload, slug: resolveUniqueSlug(currentPage.project_id, desiredSlug, currentPage.id) };
        } else {
          // Always include slug to avoid setting it to NULL when only content_md changes
          finalPayload = { ...payload, slug: currentPage.slug };
        }
      } else {
        // If neither title nor slug changed, keep the current slug
        const currentPage = wikiQueries.getPageById(id);
        if (currentPage) {
          finalPayload = { ...payload, slug: currentPage.slug };
        }
      }

      const page = wikiQueries.updatePage(id, finalPayload);
      if (!page) {
        return { success: false, error: 'page_not_found' };
      }
      return { success: true, page };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('wiki:delete-page', async (_event, id) => {
    try {
      wikiQueries.deletePage(id);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('wiki:generate-starter-page', async (_event, projectId, options = {}) => {
    try {
      const projectsPath = projectsPathOverride || require('../utils/paths').PROJECTS_PATH;
      const pageCount = wikiQueries.countPagesByProject(projectId);
      if (pageCount > 0) {
        return { success: true, skipped: true };
      }

      const analysisPath = path.join(projectsPath, 'projects_analysis', `${projectId}.json`);
      if (!fs.existsSync(analysisPath)) {
        return { success: true, error: 'no_analysis' };
      }

      const rawAnalysis = await fs.promises.readFile(analysisPath, 'utf8');
      const analysisJson = JSON.parse(rawAnalysis);
      const language = options.language || 'es';
      const projectName = options.projectName || analysisJson?.projectName || `Proyecto ${projectId}`;

      const markdown = await starterGenerator(projectName, analysisJson, language);
      if (!markdown || typeof markdown !== 'string') {
        return { success: false, error: 'generation_failed' };
      }

      const starterTitle = language === 'en' ? 'Project summary' : 'Resumen del proyecto';
      const starterSlug = resolveUniqueSlug(projectId, starterTitle);
      const page = wikiQueries.createPage({ project_id: projectId, slug: starterSlug, title: starterTitle });

      let finalPage = page;
      if (markdown.trim()) {
        try {
          finalPage = wikiQueries.updatePage(page.id, {
            title: starterTitle,
            slug: starterSlug,
            content_md: markdown,
          }) || page;
        } catch (updateError) {
          try { wikiQueries.deletePage(page.id); } catch (_) {}
          return { success: false, error: updateError.message };
        }
      }

      return { success: true, page: finalPage };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
}

function __setWikiQueries(mockQueries) {
  wikiQueries = mockQueries;
}

function __setStarterGenerator(generator) {
  starterGenerator = generator || callStarterPageAI;
}

function __setProjectsPath(projectsPath) {
  projectsPathOverride = projectsPath;
}

module.exports = {
  registerWikiHandlers,
  normalizeSlug,
  resolveUniqueSlug,
  __setWikiQueries,
  __setStarterGenerator,
  __setProjectsPath,
};
