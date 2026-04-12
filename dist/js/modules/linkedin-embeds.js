import { LI_CARD_H, LINKEDIN_EMBEDS } from '../constants.js';

export class LinkedInEmbeds {
  static postUrl(src) {
    const m = String(src).match(/\/embed\/feed\/update\/(urn:li:[^?&]+)/);
    return m ? `https://www.linkedin.com/feed/update/${m[1]}` : 'https://www.linkedin.com/in/StavanGandhi30';
  }

  constructor(embeds = LINKEDIN_EMBEDS, cardHeight = LI_CARD_H) {
    this.embeds = embeds;
    this.cardHeight = cardHeight;
  }

  init() {
    const track = document.getElementById('linkedin-embeds-track');
    if (!track || !this.embeds.length) return;

    track.replaceChildren();
    this.embeds.forEach((post, i) => {
      const w = post.width || 504;
      const h = post.height || 894;
      const src = post.src;
      const scale = this.cardHeight / h;
      const outerW = Math.max(1, Math.round(w * scale));

      const a = document.createElement('a');
      a.className = 'linkedin-embed-card';
      a.href = post.href || LinkedInEmbeds.postUrl(src);
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.setAttribute('aria-label', `Open LinkedIn post ${i + 1} in a new tab`);
      a.style.width = `${outerW}px`;
      a.style.height = `${this.cardHeight}px`;

      const iframe = document.createElement('iframe');
      iframe.src = src;
      iframe.width = String(w);
      iframe.height = String(h);
      iframe.title = `LinkedIn post preview ${i + 1}`;
      iframe.setAttribute('allowfullscreen', '');
      iframe.loading = 'lazy';
      iframe.style.width = `${w}px`;
      iframe.style.height = `${h}px`;
      iframe.style.transform = `scale(${scale})`;

      a.appendChild(iframe);
      track.appendChild(a);
    });
  }
}
