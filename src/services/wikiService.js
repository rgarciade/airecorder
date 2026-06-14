function ensureWikiAPI() {
  if (!window?.electronAPI?.wiki) {
    throw new Error('Wiki API no disponible');
  }
}

export async function listPages(projectId) {
  ensureWikiAPI();
  const result = await window.electronAPI.wiki.listPages(projectId);
  if (!result?.success) {
    throw new Error(result?.error || 'Error listando páginas wiki');
  }
  return result.pages || [];
}

export async function createPage(data) {
  ensureWikiAPI();
  const result = await window.electronAPI.wiki.createPage(data);
  if (!result?.success) {
    throw new Error(result?.error || 'Error creando página wiki');
  }
  return result.page;
}

export async function updatePage(id, data) {
  ensureWikiAPI();
  const result = await window.electronAPI.wiki.updatePage(id, data);
  if (!result?.success) {
    throw new Error(result?.error || 'Error actualizando página wiki');
  }
  return result.page;
}

export async function deletePage(id) {
  ensureWikiAPI();
  const result = await window.electronAPI.wiki.deletePage(id);
  if (!result?.success) {
    throw new Error(result?.error || 'Error eliminando página wiki');
  }
  return true;
}

export async function generateStarterPage(projectId, options = {}) {
  ensureWikiAPI();
  const result = await window.electronAPI.wiki.generateStarterPage(projectId, options);
  if (!result?.success && result?.error !== 'no_analysis') {
    throw new Error(result?.error || 'Error generando página inicial wiki');
  }
  return result;
}

export default {
  listPages,
  createPage,
  updatePage,
  deletePage,
  generateStarterPage,
};
