import { escapeHtml, formatPostDate, safePostDomId } from '../utils/html.js';

export class BlogSection {
  constructor({ onAfterDomUpdate } = {}) {
    this.onAfterDomUpdate = onAfterDomUpdate;
  }

  async loadJson() {
    const embed = document.getElementById('blogs-data');
    if (embed?.textContent.trim()) return JSON.parse(embed.textContent);
    const r = await fetch(new URL('data/blogs.json', document.baseURI || window.location.href));
    if (!r.ok) throw new Error('fetch failed');
    return r.json();
  }

  openFromHash() {
    const raw = (location.hash || '').slice(1);
    if (!raw.startsWith('post-')) return;
    const article = document.getElementById(raw);
    if (!article) return;
    const details = article.querySelector('details');
    if (details) details.open = true;
    requestAnimationFrame(() => {
      article.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  notifyDomUpdate() {
    requestAnimationFrame(() => this.onAfterDomUpdate?.());
  }

  async init() {
    const root = document.getElementById('blog-posts-root');
    const intro = document.getElementById('blog-intro');
    if (!root) return;

    root.innerHTML =
      '<p class="text-sm text-stone-400 dark:text-stone-500" data-blog-loading>Loading…</p>';

    let data;
    try {
      data = await this.loadJson();
    } catch {
      if (intro) intro.setAttribute('hidden', '');
      root.innerHTML =
        '<p class="text-sm text-stone-600 dark:text-stone-400">Posts couldn’t load. From the repo root run <code class="rounded bg-stone-200 px-1.5 py-0.5 text-xs dark:bg-stone-800">npm run dev</code> to preview <code class="text-xs">public/</code>, or <code class="rounded bg-stone-200 px-1.5 py-0.5 text-xs dark:bg-stone-800">npm run build</code> and open <code class="text-xs">dist/index.html</code> (posts are embedded there).</p>';
      this.notifyDomUpdate();
      return;
    }

    if (intro) intro.removeAttribute('hidden');

    try {
      const posts = (data.posts || []).slice().sort((a, b) => new Date(b.date) - new Date(a.date));

      if (!posts.length) {
        root.innerHTML = '<p class="text-sm text-stone-500 dark:text-stone-400">No posts yet.</p>';
        this.notifyDomUpdate();
        return;
      }

      root.innerHTML = posts
        .map((p) => {
          const domId = safePostDomId(p.id);
          const hash = `post-${domId}`;
          return `
        <article id="${hash}" class="scroll-mt-28 border border-stone-200 bg-white dark:border-stone-800 dark:bg-neutral-900/40">
          <details class="blog-post group">
            <summary class="cursor-pointer p-6 transition hover:bg-stone-50 dark:hover:bg-stone-900/50">
              <div class="flex flex-wrap items-start justify-between gap-3">
                <div class="min-w-0 flex-1">
                  <time class="text-[11px] font-medium uppercase tracking-[0.2em] text-stone-400 dark:text-stone-500">${formatPostDate(p.date)}</time>
                  <h3 class="font-serif mt-3 text-lg font-normal text-stone-900 dark:text-stone-100">${escapeHtml(p.title)}</h3>
                  <p class="mt-2 text-sm leading-relaxed text-stone-600 dark:text-stone-400">${escapeHtml(p.excerpt || '')}</p>
                </div>
                <span class="blog-expand-label shrink-0 text-[11px] uppercase tracking-wider text-stone-500 dark:text-stone-400">Expand</span>
              </div>
              <div class="mt-4 flex flex-wrap gap-2">
                ${(p.tags || [])
                  .map((t) => `<span class="text-[10px] uppercase tracking-wider text-stone-500 dark:text-stone-400">${escapeHtml(t)}</span>`)
                  .join(' <span class="text-stone-300 dark:text-stone-600" aria-hidden="true">·</span> ')}
              </div>
            </summary>
            <div class="border-t border-stone-200 px-6 pb-6 pt-5 dark:border-stone-800">
              <div class="space-y-4 text-[15px] leading-[1.7] text-stone-700 dark:text-stone-300 max-w-none [&_p]:mb-4 [&_p:last-child]:mb-0 [&_strong]:font-semibold [&_em]:italic">${p.content}</div>
              <p class="mt-6 text-[11px] uppercase tracking-wider text-stone-400 dark:text-stone-500">Permalink <a class="text-stone-800 underline decoration-stone-300 underline-offset-4 hover:decoration-stone-600 dark:text-stone-200 dark:decoration-stone-600" href="#${hash}">#${hash}</a></p>
            </div>
          </details>
        </article>`;
        })
        .join('');

      root.querySelectorAll('details.blog-post').forEach((det) => {
        det.addEventListener('toggle', () => {
          const label = det.querySelector('.blog-expand-label');
          if (label) label.textContent = det.open ? 'Collapse' : 'Expand';
        });
      });

      this.openFromHash();
      this.notifyDomUpdate();
    } catch {
      if (intro) intro.setAttribute('hidden', '');
      root.innerHTML =
        '<p class="text-sm text-stone-600 dark:text-stone-400">Posts loaded but couldn’t be displayed. Check <code class="text-xs">data/blogs.json</code> for valid JSON.</p>';
      this.notifyDomUpdate();
    }
  }
}
