/**
 * End of <body>: copyright year + main site bootstrap (theme, nav, content, etc.).
 */
import './app/site.js';

const yearEl = document.getElementById('current-year');
if (yearEl) yearEl.textContent = String(new Date().getFullYear());
