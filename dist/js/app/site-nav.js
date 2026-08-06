const NAV_ACTIVATION_BELOW_HEADER_PX = 100;

/** Section `id` → nav key when it differs from the section id. */
const SECTION_NAV_REDIRECT = {
  about: 'home',
  building: 'home',
  experience: 'experience',
  education: 'education',
  certificates: 'education',
  blog: 'blog',
  linkedin: 'blog',
  recommendations: 'blog',
  photos: 'blog',
  connect: 'connect',
};

let navLinkKeys = new Set();
let sections = [];

function navKeyForSectionId(id) {
  return SECTION_NAV_REDIRECT[id] ?? id;
}

function setActiveNav(sectionKey) {
  const activeKey = navLinkKeys.has(sectionKey) ? sectionKey : null;
  document.querySelectorAll('[data-section-link]').forEach((el) => {
    const key = el.getAttribute('data-section-link');
    const on = activeKey !== null && key === activeKey;
    el.classList.toggle('is-active', on);
    if (on) el.setAttribute('aria-current', 'location');
    else el.removeAttribute('aria-current');
  });
}

function activationLineY() {
  const header = document.querySelector('header.site-nav') || document.querySelector('header');
  const h = header ? header.getBoundingClientRect().height : 72;
  return h + NAV_ACTIVATION_BELOW_HEADER_PX;
}

function sectionInViewForNav() {
  const line = activationLineY();
  const hit = sections.find((s) => {
    const r = s.getBoundingClientRect();
    return r.top <= line && r.bottom > line;
  });
  if (hit) return hit;
  for (let i = sections.length - 1; i >= 0; i--) {
    if (sections[i].getBoundingClientRect().top <= line) return sections[i];
  }
  return sections[0];
}

function syncNavFromScroll() {
  const chosen = sectionInViewForNav();
  if (chosen) setActiveNav(navKeyForSectionId(chosen.id));
}

export function initSectionNav() {
  navLinkKeys = new Set(
    [...document.querySelectorAll('[data-section-link]')].map((el) => el.getAttribute('data-section-link')).filter(Boolean),
  );
  sections = [...document.querySelectorAll('main section[id]')];
  if (!sections.length) return;

  let scrollRaf = 0;
  const onScrollOrResize = () => {
    if (scrollRaf) return;
    scrollRaf = requestAnimationFrame(() => {
      scrollRaf = 0;
      syncNavFromScroll();
    });
  };

  window.addEventListener('scroll', onScrollOrResize, { passive: true });
  window.addEventListener('resize', onScrollOrResize);

  const raw = (location.hash || '#home').replace(/^#/, '');
  const initialKey = raw.startsWith('post-') ? 'blog' : navKeyForSectionId(raw);
  setActiveNav(navLinkKeys.has(initialKey) ? initialKey : 'home');
  requestAnimationFrame(syncNavFromScroll);
  window.addEventListener('load', () => syncNavFromScroll(), { once: true });
}

const scrollFadeUpdaters = [];

export function initScrollFade() {
  document.querySelectorAll('[data-scroll-fade]').forEach((wrap) => {
    if (wrap.dataset.sfBound) return;
    const scroller = wrap.querySelector('.scroll-fade__scroller');
    if (!scroller) return;
    wrap.dataset.sfBound = '1';
    const eps = 3;
    const update = () => {
      const { scrollLeft, scrollWidth, clientWidth } = scroller;
      const overflow = scrollWidth > clientWidth + eps;
      wrap.classList.toggle('scroll-fade--left', overflow && scrollLeft > eps);
      wrap.classList.toggle('scroll-fade--right', overflow && scrollLeft < scrollWidth - clientWidth - eps);
    };
    scrollFadeUpdaters.push(update);
    scroller.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    new ResizeObserver(update).observe(scroller);
    update();
  });
}

export function refreshScrollFades() {
  scrollFadeUpdaters.forEach((fn) => fn());
}

export function openPostFromHash() {
  const raw = (location.hash || '').slice(1);
  if (!raw.startsWith('post-')) return;
  const article = document.getElementById(raw);
  if (!article) return;
  const details = article.querySelector('details');
  if (details) details.open = true;
  requestAnimationFrame(() => article.scrollIntoView({ behavior: 'smooth', block: 'start' }));
}

function navKeyFromHash(hash) {
  const raw = String(hash || '').replace(/^#/, '');
  if (!raw || raw.startsWith('post-')) return null;
  return navKeyForSectionId(raw);
}

export function applyHashToNav(hash) {
  const key = navKeyFromHash(hash);
  if (key !== null) setActiveNav(key);
}
