export const MAILTO_MAX = 1900;

export function formatPostDate(iso) {
  try {
    return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return iso;
  }
}

export function escapeHtml(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

export function initialsFromName(name) {
  const cleaned = String(name)
    .replace(/,.*$/, '')
    .trim();
  const parts = cleaned.split(/\s+/).filter((p) => /^[A-Za-z]/.test(p.replace(/\./g, '')));
  if (parts.length >= 2) {
    const first = parts[0][0];
    const last = parts[parts.length - 1][0];
    return (first + last).toUpperCase();
  }
  return (cleaned.slice(0, 2) || '?').toUpperCase();
}

/** Wrap segments in **double asterisks** as <strong>; escape everything. */
export function formatQuoteBold(raw) {
  const parts = String(raw || '').split(/\*\*/);
  return parts.map((chunk, i) => (i % 2 === 1 ? `<strong>${escapeHtml(chunk)}</strong>` : escapeHtml(chunk))).join('');
}

export function safePostDomId(id) {
  return String(id).replace(/[^a-zA-Z0-9_-]/g, '-');
}

export function safeHttpUrl(href) {
  const s = String(href ?? '').trim();
  /* Empty string resolves to the current page via URL(); never treat that as a valid remote link. */
  if (!s) return '';
  try {
    const u = new URL(s, document.baseURI || window.location.href);
    if (u.protocol === 'http:' || u.protocol === 'https:') return u.href;
  } catch {
    /* ignore */
  }
  return '';
}

/** @param {string} relPath e.g. `data/experience.json` */
export async function loadSiteJson(relPath) {
  const r = await fetch(new URL(relPath, document.baseURI || window.location.href));
  if (!r.ok) throw new Error('fetch failed');
  return r.json();
}
