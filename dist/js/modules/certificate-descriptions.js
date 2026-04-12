function wordLimitForViewport() {
  const w = window.innerWidth;
  if (w < 480) return 32;
  if (w < 640) return 42;
  if (w < 768) return 52;
  if (w < 1024) return 68;
  if (w < 1280) return 88;
  return Infinity;
}

export class CertificateDescriptions {
  constructor() {
    this.fullTextByBlock = new WeakMap();
    this.expandedByBlock = new WeakMap();
  }

  applyBlock(block) {
    const textSpan = block.querySelector('.certificate-card__text');
    const btn = block.querySelector('.certificate-card__more-btn');
    if (!textSpan || !btn) return;

    let full = this.fullTextByBlock.get(block);
    if (full == null) {
      full = textSpan.textContent.trim().replace(/\s+/g, ' ');
      this.fullTextByBlock.set(block, full);
    }

    if (this.expandedByBlock.get(block)) {
      textSpan.textContent = full;
      btn.hidden = true;
      btn.setAttribute('aria-expanded', 'true');
      return;
    }

    const words = full.split(' ');
    const limit = wordLimitForViewport();
    if (!Number.isFinite(limit) || words.length <= limit) {
      textSpan.textContent = full;
      btn.hidden = true;
      btn.setAttribute('aria-expanded', 'false');
      return;
    }

    textSpan.textContent = words.slice(0, limit).join(' ');
    btn.hidden = false;
    btn.textContent = 'more...';
    btn.setAttribute('aria-expanded', 'false');
  }

  init() {
    const blocks = document.querySelectorAll('[data-cert-desc-block]');
    if (!blocks.length) return;

    blocks.forEach((block) => {
      const btn = block.querySelector('.certificate-card__more-btn');
      if (!btn) return;
      btn.addEventListener('click', () => {
        this.expandedByBlock.set(block, true);
        this.applyBlock(block);
      });
      this.applyBlock(block);
    });

    let resizeT = 0;
    window.addEventListener('resize', () => {
      window.clearTimeout(resizeT);
      resizeT = window.setTimeout(() => {
        blocks.forEach((block) => {
          if (!this.expandedByBlock.get(block)) this.applyBlock(block);
        });
      }, 120);
    });
  }
}
