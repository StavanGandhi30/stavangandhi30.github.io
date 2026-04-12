import { THEME_KEY } from '../constants.js';

export class ThemeManager {
  constructor(storageKey = THEME_KEY) {
    this.storageKey = storageKey;
  }

  getPreferred() {
    const stored = localStorage.getItem(this.storageKey);
    if (stored === 'dark' || stored === 'light') return stored;
    if (window.matchMedia?.('(prefers-color-scheme: dark)').matches) return 'dark';
    return 'light';
  }

  apply(theme) {
    const root = document.documentElement;
    if (theme === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');
    localStorage.setItem(this.storageKey, theme);
    document.querySelectorAll('[data-theme-toggle]').forEach((btn) => {
      btn.setAttribute('aria-label', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
    });
  }

  init() {
    this.apply(this.getPreferred());
    document.querySelectorAll('[data-theme-toggle]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const next = document.documentElement.classList.contains('dark') ? 'light' : 'dark';
        this.apply(next);
      });
    });
  }
}
