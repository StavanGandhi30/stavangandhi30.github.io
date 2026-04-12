/** Edge gradients on `[data-scroll-fade]` + `.scroll-fade__scroller`. */
export class ScrollFadeManager {
  constructor() {
    /** @type {(() => void)[]} */
    this.updaters = [];
  }

  init() {
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

      this.updaters.push(update);
      scroller.addEventListener('scroll', update, { passive: true });
      window.addEventListener('resize', update);
      new ResizeObserver(update).observe(scroller);
      update();
    });
  }

  refresh() {
    this.updaters.forEach((fn) => fn());
  }
}
