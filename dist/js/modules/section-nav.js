import { NAV_ACTIVATION_BELOW_HEADER_PX, NAV_LINK_KEYS, NAV_MAP } from '../constants.js';

export class SectionNav {
  constructor({
    navMap = NAV_MAP,
    linkKeys = NAV_LINK_KEYS,
    activationBelowHeaderPx = NAV_ACTIVATION_BELOW_HEADER_PX,
  } = {}) {
    this.navMap = navMap;
    this.linkKeys = linkKeys;
    this.activationBelowHeaderPx = activationBelowHeaderPx;
    this.sections = [];
  }

  setActive(sectionKey) {
    const resolved = this.linkKeys.has(sectionKey) ? sectionKey : null;
    document.querySelectorAll('[data-section-link]').forEach((el) => {
      const key = el.getAttribute('data-section-link');
      const active = resolved !== null && key === resolved;
      el.classList.toggle('is-active', active);
      if (active) el.setAttribute('aria-current', 'location');
      else el.removeAttribute('aria-current');
    });
  }

  activationLineY() {
    const header = document.querySelector('header.site-nav') || document.querySelector('header');
    const h = header ? header.getBoundingClientRect().height : 72;
    return h + this.activationBelowHeaderPx;
  }

  syncFromScroll() {
    const line = this.activationLineY();
    let chosen = null;
    for (const s of this.sections) {
      const r = s.getBoundingClientRect();
      if (r.top <= line && r.bottom > line) {
        chosen = s;
        break;
      }
    }
    if (!chosen) {
      for (let i = this.sections.length - 1; i >= 0; i--) {
        const r = this.sections[i].getBoundingClientRect();
        if (r.top <= line) {
          chosen = this.sections[i];
          break;
        }
      }
    }
    if (!chosen) [chosen] = this.sections;
    const navKey = this.navMap[chosen.id] || chosen.id;
    this.setActive(navKey);
  }

  applyHash(hash) {
    const raw = (hash || '').replace(/^#/, '');
    if (!raw || raw.startsWith('post-')) return;
    this.setActive(this.navMap[raw] || raw);
  }

  init() {
    this.sections = [...document.querySelectorAll('main section[id]')];
    if (!this.sections.length) return;

    let scrollRaf = 0;
    const onScrollOrResize = () => {
      if (scrollRaf) return;
      scrollRaf = requestAnimationFrame(() => {
        scrollRaf = 0;
        this.syncFromScroll();
      });
    };

    window.addEventListener('scroll', onScrollOrResize, { passive: true });
    window.addEventListener('resize', onScrollOrResize);

    const initial = (location.hash || '#home').replace('#', '');
    const initialNav = this.navMap[initial] || (initial.startsWith('post-') ? 'blog' : initial);
    this.setActive(initialNav);
    requestAnimationFrame(() => this.syncFromScroll());
    window.addEventListener('load', () => this.syncFromScroll(), { once: true });
  }
}
