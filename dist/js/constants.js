/** Site-wide keys and layout constants. */

export const THEME_KEY = 'sg-theme';
export const AMBIENT_VOL_KEY = 'sg-ambient-vol';
export const AMBIENT_MUTED_KEY = 'sg-ambient-muted';
export const MAILTO_MAX = 1900;

/** LinkedIn preview row height (px); iframe scales to this height. */
export const LI_CARD_H = 460;

/** `{ src, width, height }` per embed; optional `href` for open-on-click. */
export const LINKEDIN_EMBEDS = [
  { src: 'https://www.linkedin.com/embed/feed/update/urn:li:ugcPost:7384682943434276864?collapsed=1', width: 504, height: 894 },
  { src: 'https://www.linkedin.com/embed/feed/update/urn:li:ugcPost:7348470397782126592?collapsed=1', width: 504, height: 840 },
  { src: 'https://www.linkedin.com/embed/feed/update/urn:li:ugcPost:7331886700194856960?collapsed=1', width: 720, height: 610 },
  { src: 'https://www.linkedin.com/embed/feed/update/urn:li:ugcPost:7324183374879764480?collapsed=1', width: 720, height: 610 },
  { src: 'https://www.linkedin.com/embed/feed/update/urn:li:ugcPost:7319445222793330688?collapsed=1', width: 720, height: 610 },
];

/** Section `id` → nav `data-section-link` value. */
export const NAV_MAP = {
  home: 'home',
  about: 'about',
  building: 'about',
  featured: 'experience',
  experience: 'experience',
  education: 'experience',
  linkedin: 'blog',
  blog: 'blog',
  certificates: 'blog',
  contact: 'contact',
};

export const NAV_LINK_KEYS = new Set(['home', 'about', 'experience', 'projects', 'blog', 'contact']);

/** Pixels below sticky header where the “current section” activation line sits. */
export const NAV_ACTIVATION_BELOW_HEADER_PX = 100;
