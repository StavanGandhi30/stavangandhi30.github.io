/**
 * Builds <head> children (title, meta, links, scripts) after charset + viewport in index.html.
 * Edit the constants below to change SEO/social tags and asset paths.
 */
const SITE_ORIGIN = 'https://stavangandhi30.github.io';

const TITLE = 'Stavan Gandhi · Official Website';

const META = [
  { name: 'description', content: 'Stavan Gandhi is a founder and engineer building at the intersection of AI, robotics, and health. Explore projects, experience, writing, and ways to connect.' },
  { property: 'og:title', content: 'Stavan Gandhi | Founder, Engineer, and Builder in AI, Robotics, and Health' },
  { property: 'og:description', content: 'Founder and engineer building at the intersection of AI, robotics, and health. Explore projects, experience, writing, and ways to connect.' },
  { property: 'og:type', content: 'website' },
  { property: 'og:url', content: `${SITE_ORIGIN}/` },
  { property: 'og:image', content: `${SITE_ORIGIN}/images/photos/Image01.jpg` },
  { property: 'og:image:alt', content: 'Portrait of Stavan Gandhi' },
  { name: 'twitter:card', content: 'summary_large_image' },
  { name: 'twitter:title', content: 'Stavan Gandhi | Founder, Engineer, and Builder in AI, Robotics, and Health' },
  { name: 'twitter:description', content: 'Founder and engineer building at the intersection of AI, robotics, and health.' },
  { name: 'twitter:image', content: `${SITE_ORIGIN}/images/photos/Image01.jpg` },
  { name: 'robots', content: 'index, follow' },
  { name: 'author', content: 'Stavan Gandhi' },
];

const LINKS_BEFORE_SCRIPTS = [
  { rel: 'canonical', href: `${SITE_ORIGIN}/` },
  { rel: 'icon', type: 'image/png', sizes: '32x32', href: 'images/icons/favicon-32.png' },
  { rel: 'icon', type: 'image/png', sizes: '48x48', href: 'images/icons/favicon-48.png' },
  { rel: 'apple-touch-icon', sizes: '180x180', href: 'images/icons/apple-touch-icon.png' },
  { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
  { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossOrigin: '' },
  {
    rel: 'stylesheet',
    href: 'https://fonts.googleapis.com/css2?family=Caveat:wght@500;600&family=DM+Sans:ital,opsz,wght@0,9..40,100..1000;1,9..40,100..1000&family=Newsreader:ital,opsz,wght@0,6..72,400..800;1,6..72,400..800&display=swap',
  },
];

const SCRIPTS = [
  { type: 'module', src: 'js/head/embed-profile-ldjson.js' },
  { src: 'https://cdn.tailwindcss.com' },
  { src: 'js/config/tailwind-config.js' },
];

const STYLESHEETS_AFTER_TAILWIND = [{ rel: 'stylesheet', href: 'css/site.css' }];

function appendMeta(attrs) {
  const el = document.createElement('meta');
  Object.entries(attrs).forEach(([k, v]) => {
    if (v !== undefined && v !== null) el.setAttribute(k, String(v));
  });
  document.head.appendChild(el);
}

function appendLink(spec) {
  const el = document.createElement('link');
  const { crossOrigin, ...rest } = spec;
  Object.entries(rest).forEach(([k, v]) => {
    if (v !== undefined && v !== null) el.setAttribute(k, String(v));
  });
  if (crossOrigin !== undefined) el.crossOrigin = crossOrigin === '' ? 'anonymous' : crossOrigin;
  document.head.appendChild(el);
}

function appendScript(spec) {
  const el = document.createElement('script');
  Object.entries(spec).forEach(([k, v]) => {
    if (v !== undefined && v !== null) el.setAttribute(k, String(v));
  });
  if (spec.type !== 'module') el.async = false;
  document.head.appendChild(el);
}

const t = document.createElement('title');
t.textContent = TITLE;
document.head.appendChild(t);

META.forEach(appendMeta);
LINKS_BEFORE_SCRIPTS.forEach(appendLink);
SCRIPTS.forEach(appendScript);
STYLESHEETS_AFTER_TAILWIND.forEach(appendLink);
