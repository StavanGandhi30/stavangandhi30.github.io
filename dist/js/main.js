import { AmbientAudio } from './modules/ambient-audio.js';
import { BlogSection } from './modules/blog.js';
import { CertificateDescriptions } from './modules/certificate-descriptions.js';
import { ContactMailto } from './modules/contact-mailto.js';
import { LinkedInEmbeds } from './modules/linkedin-embeds.js';
import { ScrollFadeManager } from './modules/scroll-fade.js';
import { SectionNav } from './modules/section-nav.js';
import { ThemeManager } from './modules/theme.js';

/**
 * Boots feature modules in dependency order. Hash changes update the blog deep-link
 * and section nav together.
 */
class App {
  constructor() {
    this.scrollFade = new ScrollFadeManager();
    this.sectionNav = new SectionNav();
    this.blog = new BlogSection({
      onAfterDomUpdate: () => this.scrollFade.refresh(),
    });
    this.theme = new ThemeManager();
    this.linkedin = new LinkedInEmbeds();
    this.contact = new ContactMailto();
    this.certificates = new CertificateDescriptions();
    this.ambient = new AmbientAudio();
  }

  onHashChange() {
    this.blog.openFromHash();
    this.sectionNav.applyHash(location.hash);
  }

  async start() {
    this.theme.init();
    this.sectionNav.init();
    await this.blog.init();
    this.contact.init();
    this.linkedin.init();
    this.scrollFade.init();
    this.certificates.init();
    this.ambient.init();

    window.addEventListener('hashchange', () => this.onHashChange());
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new App().start();
});
