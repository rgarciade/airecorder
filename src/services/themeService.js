let systemThemeMediaQuery = null;
let systemThemeListener = null;

export function applyTheme(theme) {
  // Limpiar listener anterior del sistema
  if (systemThemeMediaQuery && systemThemeListener) {
    systemThemeMediaQuery.removeEventListener('change', systemThemeListener);
    systemThemeListener = null;
  }

  if (theme === 'system') {
    systemThemeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const setFromSystem = (e) => {
      document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : 'light');
    };
    systemThemeListener = setFromSystem;
    systemThemeMediaQuery.addEventListener('change', setFromSystem);
    setFromSystem(systemThemeMediaQuery);
  } else {
    document.documentElement.setAttribute('data-theme', theme);
  }
}

export function getResolvedTheme() {
  return document.documentElement.getAttribute('data-theme');
}
