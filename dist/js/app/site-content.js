import {
  escapeHtml,
  formatPostDate,
  formatQuoteBold,
  initialsFromName,
  loadSiteJson,
  loadSiteUrls,
  resolveSiteUrl,
  resolveSiteUrlFromRecord,
  safeHttpUrl,
  safePostDomId,
} from './site-utils.js';
import { openPostFromHash, refreshScrollFades } from './site-nav.js';

const LI_CARD_H = 460;

const rafFade = () => requestAnimationFrame(refreshScrollFades);

const DEFAULT_EXP_FIGURE_CLASS =
  'mt-6 overflow-hidden rounded-xl border border-stone-200 dark:border-stone-800';

const EXP_FIGCAPTION_CLASS =
  'border-t border-stone-200 bg-stone-50 px-3 py-2.5 text-[11px] leading-relaxed text-stone-500 dark:border-stone-800 dark:bg-stone-900/40 dark:text-stone-400';

const EXP_VIDEO_CLASS = 'max-h-[min(28rem,75vh)] w-full object-contain';
const EXP_VIDEO_CLASS_CAROUSEL = 'max-h-[min(28rem,75vh)] w-full bg-black object-contain';
let siteUrlsPromise;

function getSiteUrls() {
  if (!siteUrlsPromise) siteUrlsPromise = loadSiteUrls();
  return siteUrlsPromise;
}

function expFigcaptionEsc(captionEscaped) {
  return captionEscaped ? `<figcaption class="${EXP_FIGCAPTION_CLASS}">${captionEscaped}</figcaption>` : '';
}

function expPosterLoopAttrs(m) {
  const poster = safeHttpUrl(String(m.poster || ''));
  return {
    posterAttr: poster ? ` poster="${escapeHtml(poster)}"` : '',
    loopAttr: m.loop ? ' loop' : '',
  };
}

function renderExpVideoFigure(figureClass, ariaEscaped, srcEscaped, attrs, captionEscaped, videoClass = EXP_VIDEO_CLASS) {
  const { posterAttr, loopAttr } = attrs;
  return `<figure class="${figureClass}">
      <video class="${videoClass}" controls playsinline preload="none"${loopAttr} aria-label="${ariaEscaped}"${posterAttr}>
        <source src="${srcEscaped}" type="video/mp4" />
      </video>
      ${expFigcaptionEsc(captionEscaped)}
    </figure>`;
}

function renderExpImageFigure(figureClass, srcEscaped, altEscaped, imgClass, width, height, captionEscaped) {
  return `<figure class="${figureClass}">
      <img
        src="${srcEscaped}"
        alt="${altEscaped}"
        width="${width}"
        height="${height}"
        class="${imgClass}"
        loading="lazy"
        decoding="async"
      />
      ${expFigcaptionEsc(captionEscaped)}
    </figure>`;
}

let recommendationCardZ = 50;

function bindRecommendationCardStack(stack) {
  if (!stack) return;
  const cards = stack.querySelectorAll('.recommendation-stack-card');
  if (!cards.length) return;

  cards.forEach((card) => {
    const nameEl = card.querySelector('.recommendation-stack-card__name');
    const label = (nameEl?.textContent || '').trim() || 'Endorsement';
    card.setAttribute('tabindex', '0');
    card.setAttribute('role', 'button');
    card.setAttribute('aria-label', `Bring to front: ${label}`);

    const bringToFront = () => {
      cards.forEach((c) => c.classList.remove('recommendation-stack-card--front'));
      card.classList.add('recommendation-stack-card--front');
      recommendationCardZ += 1;
      card.style.zIndex = String(recommendationCardZ);
    };

    card.addEventListener('click', bringToFront);
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        bringToFront();
      }
    });
  });
}

function renderExperienceCarouselSlide(slide, expIndex, slideIndex, siteUrls) {
  if (!slide || typeof slide !== 'object') return '';
  const capEsc = escapeHtml(String(slide.caption || '').trim());
  const figCls = 'exp-carousel__figure m-0 overflow-hidden';

  if (slide.type === 'video') {
    const src = safeHttpUrl(resolveSiteUrlFromRecord(siteUrls, slide, 'srcKey', 'src'));
    if (!src) return '';
    const aria = escapeHtml(String(slide.ariaLabel || `Experience clip ${expIndex + 1} · slide ${slideIndex + 1}`));
    return renderExpVideoFigure(figCls, aria, escapeHtml(src), expPosterLoopAttrs(slide), capEsc, EXP_VIDEO_CLASS_CAROUSEL);
  }

  if (slide.type === 'image') {
    const src = String(slide.src || '').trim();
    if (!src) return '';
    return renderExpImageFigure(
      figCls,
      escapeHtml(src),
      escapeHtml(String(slide.alt || '')),
      escapeHtml(String(slide.imgClass || 'w-full object-cover')),
      Number(slide.width) || 1024,
      Number(slide.height) || 576,
      capEsc,
    );
  }

  return '';
}

function renderExperienceCarousel(media, index, siteUrls) {
  const slides = Array.isArray(media.slides) ? media.slides : [];
  const inners = [];
  slides.forEach((s, j) => {
    const inner = renderExperienceCarouselSlide(s, index, j, siteUrls);
    if (inner) inners.push(inner);
  });
  const n = inners.length;
  if (!n) return '';

  const slidePct = 100 / n;
  const parts = inners.map(
    (inner) =>
      `<div class="exp-carousel__slide" style="flex:0 0 ${slidePct}%;box-sizing:border-box">${inner}</div>`
  );

  const figureClass = escapeHtml(String(media.figureClass || DEFAULT_EXP_FIGURE_CLASS));
  const aria = escapeHtml(String(media.ariaLabel || `Experience media ${index + 1}`));
  const navBtns =
    n > 1
      ? `<button type="button" class="exp-carousel__btn exp-carousel__btn--prev" data-exp-carousel-prev aria-label="Previous slide"><span aria-hidden="true">←</span></button>
      <button type="button" class="exp-carousel__btn exp-carousel__btn--next" data-exp-carousel-next aria-label="Next slide"><span aria-hidden="true">→</span></button>`
      : '';
  const tabIdx = n > 1 ? '0' : '-1';

  return `<div class="${figureClass} exp-carousel" data-exp-carousel tabindex="${tabIdx}" role="region" aria-roledescription="carousel" aria-label="${aria}">
    <div class="exp-carousel__viewport">
      <div class="exp-carousel__track" style="width:${n * 100}%;transform:translateX(0)">
        ${parts.join('')}
      </div>
      ${navBtns}
    </div>
  </div>`;
}

function bindExperienceCarousels(root) {
  root.querySelectorAll('[data-exp-carousel]').forEach((carousel) => {
    const track = carousel.querySelector('.exp-carousel__track');
    const slides = carousel.querySelectorAll('.exp-carousel__slide');
    const prev = carousel.querySelector('[data-exp-carousel-prev]');
    const next = carousel.querySelector('[data-exp-carousel-next]');
    if (!track || !slides.length) return;

    const n = slides.length;
    let i = 0;

    const syncVideos = () => {
      slides.forEach((slide, si) => {
        const v = slide.querySelector('video');
        if (!v) return;
        if (si !== i) {
          v.pause();
          try {
            v.currentTime = 0;
          } catch {
            /* ignore */
          }
        }
      });
    };

    const apply = () => {
      const pct = (i * 100) / n;
      track.style.transform = `translateX(-${pct}%)`;
      syncVideos();
    };

    const go = (delta) => {
      i = (i + delta + n) % n;
      apply();
    };

    prev?.addEventListener('click', () => go(-1));
    next?.addEventListener('click', () => go(1));

    if (n > 1) {
      carousel.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          go(-1);
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          go(1);
        }
      });
    }

    apply();
  });
}

function renderExperienceMedia(media, index, siteUrls) {
  if (!media || typeof media !== 'object') return '';
  const figureClass = escapeHtml(String(media.figureClass || DEFAULT_EXP_FIGURE_CLASS));
  const captionEsc = escapeHtml(String(media.caption || '').trim());

  if (media.type === 'carousel') {
    const slides = Array.isArray(media.slides)
      ? media.slides.map((slide) => ({
          ...slide,
          src: resolveSiteUrlFromRecord(siteUrls, slide, 'srcKey', 'src'),
        }))
      : [];
    return renderExperienceCarousel({ ...media, slides }, index, siteUrls);
  }

  if (media.type === 'video') {
    const src = safeHttpUrl(resolveSiteUrlFromRecord(siteUrls, media, 'srcKey', 'src'));
    if (!src) return '';
    const aria = escapeHtml(String(media.ariaLabel || `Experience clip ${index + 1}`));
    return renderExpVideoFigure(figureClass, aria, escapeHtml(src), expPosterLoopAttrs(media), captionEsc);
  }

  const src = String(media.src || '').trim();
  if (!src) return '';
  return renderExpImageFigure(
    figureClass,
    escapeHtml(src),
    escapeHtml(String(media.alt || '')),
    escapeHtml(String(media.imgClass || 'w-full object-cover')),
    Number(media.width) || 1024,
    Number(media.height) || 576,
    captionEsc,
  );
}

function renderExperienceLinks(links, siteUrls) {
  const items = Array.isArray(links) ? links : [];
  if (!items.length) return '';
  const linkClass =
    'underline decoration-stone-300 underline-offset-4 transition hover:decoration-stone-600 dark:decoration-stone-600 dark:hover:decoration-stone-400';
  const anchors = items
    .map((item) => {
      const href = safeHttpUrl(resolveSiteUrlFromRecord(siteUrls, item, 'hrefKey', 'href'));
      const label = escapeHtml(String(item?.label || '').trim());
      if (!href || !label) return '';
      return `<a href="${escapeHtml(href)}" class="${linkClass}" rel="noopener noreferrer" target="_blank">${label}</a>`;
    })
    .filter(Boolean);
  if (!anchors.length) return '';
  return `<p class="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-stone-600 dark:text-stone-400">${anchors.join(
    '<span class="text-stone-300 dark:text-stone-600" aria-hidden="true">·</span>'
  )}</p>`;
}

export async function initExperience() {
  const root = document.getElementById('experience-root');
  if (!root) return;

  root.innerHTML = '<p class="text-sm text-stone-400 dark:text-stone-500" data-exp-loading>Loading…</p>';

  let data;
  try {
    data = await loadSiteJson('data/experience.json');
  } catch {
    root.innerHTML =
      '<p class="text-sm text-stone-600 dark:text-stone-400">Experience couldn’t load. Serve <code class="text-xs">dist/</code> over HTTP (not <code class="text-xs">file://</code>) so <code class="text-xs">data/experience.json</code> can be fetched, or check that the file exists and is valid JSON.</p>';
    rafFade();
    return;
  }

  try {
    const siteUrls = await getSiteUrls();
    const items = Array.isArray(data.items) ? data.items : [];
    if (!items.length) {
      root.innerHTML = '<p class="text-sm text-stone-500 dark:text-stone-400">No experience entries yet.</p>';
      rafFade();
      return;
    }

    root.innerHTML = items
      .map((item, i) => {
        const org = escapeHtml(String(item.org || '').trim());
        const role = escapeHtml(String(item.role || '').trim());
        const date = escapeHtml(String(item.date || '').trim());
        const description = escapeHtml(String(item.description || '').trim());
        const linksHtml = renderExperienceLinks(item.links, siteUrls);
        const mediaHtml = renderExperienceMedia(item.media, i, siteUrls);
        const bullets = Array.isArray(item.bullets) ? item.bullets : [];
        const bulletsHtml = bullets.length
          ? `<ul class="mt-6 space-y-3.5 border-l-2 border-stone-200 pl-5 text-sm leading-relaxed text-stone-600 dark:border-stone-700 dark:text-stone-400">${bullets
              .map((b) => {
                const title = escapeHtml(String(b?.title || '').trim());
                const text = escapeHtml(String(b?.text || '').trim());
                if (!text) return '';
                return `<li>${title ? `<span class="font-medium text-stone-900 dark:text-stone-200">${title}</span> — ` : ''}${text}</li>`;
              })
              .filter(Boolean)
              .join('')}</ul>`
          : '';

        return `<li class="border-b border-stone-200 pb-14 last:border-0 last:pb-0 dark:border-stone-800">
          <h3 class="font-serif mt-6 text-xl text-stone-900 dark:text-stone-50">${org}</h3>
          <div class="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
            <p class="mt-1 text-sm text-stone-500 dark:text-stone-400">${role}</p>
            <p class="mt-1 text-sm text-stone-500 dark:text-stone-400">${date}</p>
          </div>
          ${linksHtml}
          ${mediaHtml}
          ${description ? `<p class="mt-4 text-sm leading-relaxed text-stone-600 dark:text-stone-400">${description}</p>` : ''}
          ${bulletsHtml}
        </li>`;
      })
      .join('');

    bindExperienceCarousels(root);
    rafFade();
  } catch {
    root.innerHTML =
      '<p class="text-sm text-stone-600 dark:text-stone-400">Experience loaded but couldn’t be displayed. Check <code class="text-xs">data/experience.json</code> for valid JSON.</p>';
    rafFade();
  }
}

const EDU_PROG_LINK_CLASS =
  'ml-1 whitespace-nowrap text-stone-800 underline decoration-stone-300 underline-offset-4 hover:decoration-stone-600 dark:text-stone-200 dark:decoration-stone-600 dark:hover:decoration-stone-400';

export async function initEducation() {
  const root = document.getElementById('education-root');
  if (!root) return;

  root.innerHTML = '<p class="text-sm text-stone-400 dark:text-stone-500" data-edu-loading>Loading…</p>';

  let data;
  try {
    data = await loadSiteJson('data/education.json');
  } catch {
    root.innerHTML =
      '<p class="text-sm text-stone-600 dark:text-stone-400">Education couldn’t load. Serve <code class="text-xs">dist/</code> over HTTP (not <code class="text-xs">file://</code>) so <code class="text-xs">data/education.json</code> can be fetched, or check that the file exists and is valid JSON.</p>';
    rafFade();
    return;
  }

  try {
    const siteUrls = await getSiteUrls();
    const items = (data.items || []).slice();
    if (!items.length) {
      root.innerHTML = '<p class="text-sm text-stone-500 dark:text-stone-400">No education entries yet.</p>';
      rafFade();
      return;
    }

    root.innerHTML = `<div class="mt-8 space-y-12">${items
      .map((item) => {
        const logo = escapeHtml(String(item.logo || '').trim());
        const lw = 420;
        const lh = 440;
        const school = escapeHtml(item.school || '');
        const degree = escapeHtml(item.degree || '');
        const dates = escapeHtml(item.dates || '');
        const desc = escapeHtml(String(item.description || '').trim());
        const progHref = safeHttpUrl(resolveSiteUrlFromRecord(siteUrls, item, 'programUrlKey', 'programUrl'));
        const progLabel = escapeHtml('Program page →');
        const progA = progHref
          ? `<a href="${escapeHtml(progHref)}" class="${EDU_PROG_LINK_CLASS}" rel="noopener noreferrer" target="_blank">${progLabel}</a>`
          : '';
        const highlights = Array.isArray(item.highlights) ? item.highlights : [];
        const highlightsHtml = highlights.length
        ? `<ul class="mt-6 space-y-1.5 text-sm leading-snug text-stone-600 dark:text-stone-400">
            ${highlights
              .map((h) => {
                const t = escapeHtml(String(h || '').trim());
                return t
                  ? `<li><span class="text-stone-900 dark:text-stone-200">${t}</span></li>`
                  : '';
              })
              .filter(Boolean)
              .join('')}
          </ul>`
        : '';
        return `
            <div class="border-l-2 border-stone-300 pl-6 dark:border-stone-600">
              <div class="flex items-center gap-3">
                <img
                  src="${logo}"
                  alt=""
                  width="${lw}"
                  height="${lh}"
                  class="h-10 w-auto shrink-0 object-contain"
                  loading="lazy"
                  decoding="async"
                />
                <p class="font-serif text-xl text-stone-900 dark:text-stone-100">${school}</p>
              </div>
              <p class="mt-1 text-stone-600 dark:text-stone-400">${degree}</p>
              <p class="mt-2 text-sm text-stone-500 dark:text-stone-500">${dates}</p>
              <p class="mt-5 text-sm leading-relaxed text-stone-600 dark:text-stone-400">${desc}${progA ? ` ${progA}` : ''}</p>
              ${highlightsHtml}
            </div>`;
      })
      .join('')}</div>`;

    rafFade();
  } catch {
    root.innerHTML =
      '<p class="text-sm text-stone-600 dark:text-stone-400">Education loaded but couldn’t be displayed. Check <code class="text-xs">data/education.json</code> for valid JSON.</p>';
    rafFade();
  }
}

export async function initCredentials() {
  const root = document.getElementById('certificates-root');
  if (!root) return;

  root.innerHTML = '<p class="text-sm text-stone-400 dark:text-stone-500" data-certs-loading>Loading…</p>';

  let data;
  try {
    data = await loadSiteJson('data/credentials.json');
  } catch {
    root.innerHTML =
      '<p class="text-sm text-stone-600 dark:text-stone-400">Credentials couldn’t load. Serve <code class="text-xs">dist/</code> over HTTP (not <code class="text-xs">file://</code>) so <code class="text-xs">data/credentials.json</code> can be fetched, or check that the file exists and is valid JSON.</p>';
    rafFade();
    return;
  }

  try {
    const siteUrls = await getSiteUrls();
    const items = (data.items || []).slice();
    if (!items.length) {
      root.innerHTML = '<p class="text-sm text-stone-500 dark:text-stone-400">No credentials listed yet.</p>';
      rafFade();
      return;
    }

    const certLinkClass =
      'text-[13px] text-stone-700 underline decoration-stone-300 underline-offset-4 dark:text-stone-400 dark:decoration-stone-600';
    root.innerHTML = items
      .map((item) => {
        const title = escapeHtml(item.title || '');
        const meta = escapeHtml(item.meta || '');
        const desc = escapeHtml(String(item.description || '').trim());
        const certHref = safeHttpUrl(resolveSiteUrlFromRecord(siteUrls, item, 'urlKey', 'url'));
        const courseHref = safeHttpUrl(resolveSiteUrlFromRecord(siteUrls, item, 'courseUrlKey', 'courseUrl'));
        const courseA = courseHref
          ? `<a href="${escapeHtml(courseHref)}" class="${certLinkClass}" rel="noopener noreferrer" target="_blank">View ${item.isSpecialization ? 'Specialization' : 'Course'} →</a>`
          : '';
        const certA = certHref
          ? `<a href="${escapeHtml(certHref)}" class="${certLinkClass}" rel="noopener noreferrer" target="_blank">View Certificate →</a>`
          : '';
        let linksRow = '';
        if (certA || courseA) {
          const sep =
            certA && courseA
              ? '<span class="text-stone-300 dark:text-stone-600 select-none" aria-hidden="true"> · </span>'
              : '';
          linksRow = `<div class="mt-4 flex flex-wrap items-center gap-x-1 gap-y-1">${courseA}${sep}${certA}</div>`;
        }
        return `
            <article class="certificate-card">
              <h3 class="font-serif mt-6 text-xl text-stone-900 dark:text-stone-50">${title}</h3>
              <p class="mt-1 text-sm text-stone-500 dark:text-stone-400">${meta}</p>
              <div class="certificate-card__desc mt-4" data-cert-desc-block>
                <p class="text-sm leading-relaxed text-stone-600 dark:text-stone-400 certificate-card__para"><span class="certificate-card__text">
                  ${desc}
</span><button
                  type="button"
                  class="certificate-card__more-btn ml-1 inline align-baseline border-0 bg-transparent p-0 text-left text-[13px] font-medium leading-relaxed text-stone-600 underline decoration-stone-300 decoration-1 underline-offset-[0.2em] transition hover:text-stone-900 hover:decoration-stone-500 dark:text-stone-400 dark:decoration-stone-600 dark:hover:text-stone-200 dark:hover:decoration-stone-400"
                  hidden
                  aria-expanded="false"
                  aria-label="Show full certificate description"
                >
                  more...
                </button>
                </p>
              </div>
              ${linksRow}
            </article>`;
      })
      .join('');

    rafFade();
  } catch {
    root.innerHTML =
      '<p class="text-sm text-stone-600 dark:text-stone-400">Credentials loaded but couldn’t be displayed. Check <code class="text-xs">data/credentials.json</code> for valid JSON.</p>';
    rafFade();
  }
}

export async function initRecommendations() {
  const root = document.getElementById('recommendations-root');
  const discEl = document.getElementById('recommendations-disclaimer');
  if (!root) return;

  root.innerHTML = '<p class="text-sm text-stone-400 dark:text-stone-500" data-rec-loading>Loading…</p>';

  let data;
  try {
    data = await loadSiteJson('data/recommendations.json');
  } catch {
    if (discEl) discEl.setAttribute('hidden', '');
    root.innerHTML =
      '<p class="text-sm text-stone-600 dark:text-stone-400">Endorsements couldn’t load. Serve <code class="text-xs">dist/</code> over HTTP so <code class="text-xs">data/recommendations.json</code> can be fetched.</p>';
    return;
  }

  try {
    const disclaimer = String(data.disclaimer || '').trim();
    if (discEl) {
      if (disclaimer) {
        discEl.textContent = disclaimer;
        discEl.removeAttribute('hidden');
      } else {
        discEl.setAttribute('hidden', '');
      }
    }

    const items = (data.items || []).slice();
    if (!items.length) {
      root.innerHTML = '<p class="text-sm text-stone-500 dark:text-stone-400">No endorsements listed yet.</p>';
      return;
    }

    root.innerHTML = `<div class="recommendations-stack">${items
      .map((item, i) => {
        const quoteHtml = formatQuoteBold(String(item.quote || '').trim());
        const name = escapeHtml(item.name || '');
        const role = escapeHtml(item.role || '');
        const avatarUrl = item.avatar ? safeHttpUrl(String(item.avatar)) : '';
        const initials = initialsFromName(item.name || '');
        const avatarInner = avatarUrl
          ? `<img src="${escapeHtml(avatarUrl)}" alt="" class="recommendation-stack-card__avatar recommendation-stack-card__avatar--img" width="44" height="44" loading="lazy" decoding="async" />`
          : `<span class="recommendation-stack-card__avatar recommendation-stack-card__avatar--initials" aria-hidden="true">${escapeHtml(initials)}</span>`;
        return `
            <article class="recommendation-stack-card" style="z-index:${3 + i}">
              <div class="recommendation-stack-card__header">
                ${avatarInner}
                <div class="recommendation-stack-card__meta">
                  <div class="recommendation-stack-card__name">${name}</div>
                  ${role ? `<div class="recommendation-stack-card__role">${role}</div>` : ''}
                </div>
              </div>
              <blockquote class="recommendation-stack-card__quote-wrap">
                <p class="recommendation-stack-card__quote">${quoteHtml}</p>
              </blockquote>
            </article>`;
      })
      .join('')}</div>`;

    bindRecommendationCardStack(root.querySelector('.recommendations-stack'));
  } catch {
    if (discEl) discEl.setAttribute('hidden', '');
    root.innerHTML =
      '<p class="text-sm text-stone-600 dark:text-stone-400">Endorsements loaded but couldn’t be displayed. Check <code class="text-xs">data/recommendations.json</code>.</p>';
  }
}

export async function initBlog() {
  const root = document.getElementById('blog-posts-root');
  const intro = document.getElementById('blog-intro');
  if (!root) return;

  root.innerHTML = '<p class="text-sm text-stone-400 dark:text-stone-500" data-blog-loading>Loading…</p>';

  let data;
  try {
    data = await loadSiteJson('data/blogs.json');
  } catch {
    if (intro) intro.setAttribute('hidden', '');
    root.innerHTML =
      '<p class="text-sm text-stone-600 dark:text-stone-400">Posts couldn’t load. Serve <code class="text-xs">dist/</code> over HTTP (not <code class="text-xs">file://</code>) so <code class="text-xs">data/blogs.json</code> can be fetched, or check that the file exists and is valid JSON.</p>';
    rafFade();
    return;
  }

  if (intro) intro.removeAttribute('hidden');

  try {
    const posts = (data.posts || []).slice().sort((a, b) => new Date(b.date) - new Date(a.date));

    if (!posts.length) {
      root.innerHTML = '<p class="text-sm text-stone-500 dark:text-stone-400">No posts yet.</p>';
      rafFade();
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

    openPostFromHash();
    rafFade();
  } catch {
    if (intro) intro.setAttribute('hidden', '');
    root.innerHTML =
      '<p class="text-sm text-stone-600 dark:text-stone-400">Posts loaded but couldn’t be displayed. Check <code class="text-xs">data/blogs.json</code> for valid JSON.</p>';
    rafFade();
  }
}

function linkedInPostUrl(src, siteUrls) {
  const m = String(src).match(/\/embed\/feed\/update\/(urn:li:[^?&]+)/);
  const feedBase = resolveSiteUrl(siteUrls, 'https://www.linkedin.com/feed/update/');
  const profile = resolveSiteUrl(siteUrls, 'linkedinProfile');
  return m && feedBase ? `${feedBase}${m[1]}` : profile;
}

export async function initLinkedInEmbeds() {
  const track = document.getElementById('linkedin-embeds-track');
  if (!track) return;

  track.innerHTML = '<p class="text-sm text-stone-400 dark:text-stone-500">Loading…</p>';
  let data;
  try {
    data = await loadSiteJson('data/linkedin-posts.json');
  } catch {
    track.innerHTML =
      '<p class="text-sm text-stone-600 dark:text-stone-400">LinkedIn posts couldn’t load. Serve <code class="text-xs">dist/</code> over HTTP so <code class="text-xs">data/linkedin-posts.json</code> can be fetched.</p>';
    rafFade();
    return;
  }

  const siteUrls = await getSiteUrls();
  const posts = Array.isArray(data.posts) ? data.posts : [];
  if (!posts.length) {
    track.innerHTML = '<p class="text-sm text-stone-500 dark:text-stone-400">No LinkedIn posts yet.</p>';
    rafFade();
    return;
  }

  track.replaceChildren();
  posts.forEach((post, i) => {
    const src = safeHttpUrl(resolveSiteUrlFromRecord(siteUrls, post, 'srcKey', 'src'));
    if (!src) return;
    const w = Number(post.width) || 504;
    const h = Number(post.height) || 894;
    const scale = LI_CARD_H / h;
    const outerW = Math.max(1, Math.round(w * scale));

    const a = document.createElement('a');
    a.className = 'linkedin-embed-card';
    a.href = safeHttpUrl(resolveSiteUrlFromRecord(siteUrls, post, 'hrefKey', 'href')) || linkedInPostUrl(src, siteUrls);
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.setAttribute('aria-label', `Open LinkedIn post ${i + 1} in a new tab`);
    a.style.width = `${outerW}px`;
    a.style.height = `${LI_CARD_H}px`;

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
  rafFade();
}

function shuffleArray(items) {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export async function initPhotos() {
  const root = document.getElementById('photos-root');
  if (!root) return;

  root.innerHTML = '<p class="text-sm text-stone-400 dark:text-stone-500">Loading…</p>';

  let data;
  try {
    data = await loadSiteJson('data/photos.json');
  } catch {
    root.innerHTML =
      '<p class="text-sm text-stone-600 dark:text-stone-400">Photos couldn’t load. Serve <code class="text-xs">dist/</code> over HTTP so <code class="text-xs">data/photos.json</code> can be fetched.</p>';
    rafFade();
    return;
  }

  try {
    let items = Array.isArray(data.items) ? data.items.slice() : [];
    if (data.shuffle !== false) {
      items = shuffleArray(items);
    }

    if (!items.length) {
      root.innerHTML =
        '<p class="text-sm text-stone-500 dark:text-stone-400">No photos yet. Add entries to <code class="text-xs">data/photos.json</code>.</p>';
      rafFade();
      return;
    }

    root.innerHTML = `<div class="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:gap-5">${items
      .map((item) => {
        const src = String(item?.src || '').trim();
        if (!src) return '';
        const alt = escapeHtml(String(item?.alt || 'Photo'));
        const cap = String(item?.caption || '').trim();
        const capHtml = cap
          ? `<figcaption class="border-t border-stone-200 bg-stone-50 px-2 py-2 text-[11px] leading-snug text-stone-500 dark:border-stone-800 dark:bg-stone-900/40 dark:text-stone-400">${escapeHtml(cap)}</figcaption>`
          : '';
        const srcEsc = escapeHtml(src);
        return `<figure class="m-0 overflow-hidden rounded-xl border border-stone-200 bg-stone-100 dark:border-stone-800 dark:bg-stone-900/30">
          <div class="aspect-[4/3] overflow-hidden">
            <img src="${srcEsc}" alt="${alt}" width="800" height="600" class="h-full w-full object-cover transition duration-300 hover:scale-[1.02]" loading="lazy" decoding="async" />
          </div>
          ${capHtml}
        </figure>`;
      })
      .filter(Boolean)
      .join('')}</div>`;
    rafFade();
  } catch {
    root.innerHTML =
      '<p class="text-sm text-stone-600 dark:text-stone-400">Photos loaded but couldn’t be displayed. Check <code class="text-xs">data/photos.json</code>.</p>';
    rafFade();
  }
}

function certWordLimit() {
  const w = window.innerWidth;
  if (w < 480) return 32;
  if (w < 640) return 42;
  if (w < 768) return 52;
  if (w < 1024) return 68;
  return Infinity;
}

export function initCertificateDescMore() {
  const blocks = document.querySelectorAll('[data-cert-desc-block]');
  if (!blocks.length) return;

  const fullTextByBlock = new WeakMap();
  const expandedByBlock = new WeakMap();

  function applyBlock(block) {
    const textSpan = block.querySelector('.certificate-card__text');
    const btn = block.querySelector('.certificate-card__more-btn');
    if (!textSpan || !btn) return;

    let full = fullTextByBlock.get(block);
    if (full == null) {
      full = textSpan.textContent.trim().replace(/\s+/g, ' ');
      fullTextByBlock.set(block, full);
    }

    const limit = certWordLimit();
    const words = full.split(' ');
    const needsToggle = Number.isFinite(limit) && words.length > limit;

    if (expandedByBlock.get(block)) {
      textSpan.textContent = full;
      if (needsToggle) {
        btn.hidden = false;
        btn.textContent = 'less...';
        btn.setAttribute('aria-expanded', 'true');
        btn.setAttribute('aria-label', 'Show shorter certificate description');
      } else {
        btn.hidden = true;
        btn.setAttribute('aria-expanded', 'true');
      }
      return;
    }

    if (!needsToggle) {
      textSpan.textContent = full;
      btn.hidden = true;
      btn.setAttribute('aria-expanded', 'false');
      return;
    }

    textSpan.textContent = words.slice(0, limit).join(' ');
    btn.hidden = false;
    btn.textContent = 'more...';
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-label', 'Show full certificate description');
  }

  blocks.forEach((block) => {
    const btn = block.querySelector('.certificate-card__more-btn');
    if (!btn) return;
    btn.addEventListener('click', () => {
      expandedByBlock.set(block, !expandedByBlock.get(block));
      applyBlock(block);
    });
    applyBlock(block);
  });

  let resizeT = 0;
  window.addEventListener('resize', () => {
    window.clearTimeout(resizeT);
    resizeT = window.setTimeout(() => {
      blocks.forEach((block) => applyBlock(block));
    }, 120);
  });
}
