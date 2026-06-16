// Light/dark theme: persisted in localStorage, applied as <html data-theme>.
// Mirrors alteredcore.org's two palettes (see src/index.css). An inline script in
// index.html sets the attribute before first paint to avoid a flash; this module is
// the single source of truth for reading/toggling afterwards.

const KEY = 'theme'

export function getTheme() {
  try { return localStorage.getItem(KEY) || 'dark' } catch { return 'dark' }
}

export function applyTheme(t) {
  const theme = t === 'light' ? 'light' : 'dark'
  document.documentElement.dataset.theme = theme
  try { localStorage.setItem(KEY, theme) } catch { /* ignore */ }
  return theme
}

// Ensure the DOM matches the stored preference (the inline script usually has, but
// this keeps things correct if it didn't run).
export function initTheme() {
  return applyTheme(getTheme())
}

export function toggleTheme() {
  return applyTheme(getTheme() === 'dark' ? 'light' : 'dark')
}
