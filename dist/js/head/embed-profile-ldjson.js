/**
 * Loads ProfilePage JSON-LD from data/profile-page-ld.json and injects a script tag.
 * (Search engines do not reliably use <script type="application/ld+json" src="...">;
 * injecting after fetch keeps one source of truth and works with Googlebot’s JS execution.)
 */
(async () => {
  try {
    const res = await fetch(new URL('../../data/profile-page-ld.json', import.meta.url));
    if (!res.ok) return;
    const data = await res.json();
    const el = document.createElement('script');
    el.type = 'application/ld+json';
    el.textContent = JSON.stringify(data);
    document.head.appendChild(el);
  } catch {
    /* ignore: offline, file://, or blocked fetch */
  }
})();
