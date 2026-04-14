/**
 * Site entry: loads shell (theme/nav), JSON-driven sections, Connect, ambient audio.
 */
import { MAILTO_MAX, applyUrlKeyBindings, loadSiteUrls } from './site-utils.js';
import {
  initTheme,
  initSectionNav,
  initScrollFade,
  openPostFromHash,
  applyHashToNav,
} from './site-nav.js';
import {
  initBlog,
  initCredentials,
  initEducation,
  initExperience,
  initRecommendations,
  initLinkedInEmbeds,
  initPhotos,
  initCertificateDescMore,
} from './site-content.js';

const AMBIENT_VOL_KEY = 'sg-ambient-vol';
const AMBIENT_MUTED_KEY = 'sg-ambient-muted';
const AMBIENT_PANEL_EXPANDED_KEY = 'sg-ambient-panel-expanded';

function initConnectMailto() {
  const form = document.getElementById('Connect-form');
  const status = document.getElementById('Connect-status');
  if (!form || !status) return;

  const to = 'stavangandhi3008@gmail.com';

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    status.textContent = '';
    status.classList.remove('text-red-600', 'dark:text-red-400');

    const fd = new FormData(form);
    const name = String(fd.get('name') || '').trim();
    const message = String(fd.get('message') || '').trim();

    if (!name || !message) {
      status.textContent = 'Please fill in name and message.';
      status.classList.add('text-red-600', 'dark:text-red-400');
      return;
    }

    const subject = `Site inquiry from ${name}`;
    const body = `Hello Stavan,\n\n${message}\n\nBest regards,\n${name}`;
    const mailto = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

    if (mailto.length > MAILTO_MAX) {
      status.textContent =
        'Message is too long for a mailto link in some browsers. Shorten the text or copy your note and email directly.';
      status.classList.add('text-red-600', 'dark:text-red-400');
      return;
    }

    window.location.href = mailto;
  });
}

function initAmbientAudio() {
  const audio = document.getElementById('ambient-audio');
  const panel = document.querySelector('[data-ambient-panel]');
  const expandBtn = document.querySelector('[data-ambient-expand]');
  const collapseBtn = document.querySelector('[data-ambient-collapse]');
  const powerBtn = document.querySelector('[data-ambient-power]');
  const muteBtn = document.querySelector('[data-ambient-mute]');
  const vol = document.querySelector('[data-ambient-volume]');
  const hint = document.querySelector('[data-ambient-hint]');
  if (!audio || !powerBtn || !muteBtn || !vol) return;

  audio.loop = true;

  const setPanelExpanded = (expanded) => {
    if (panel) {
      panel.classList.toggle('ambient-audio-panel--collapsed', !expanded);
      panel.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    }
    if (expandBtn) expandBtn.hidden = expanded;
    if (collapseBtn) collapseBtn.hidden = !expanded;
    try {
      localStorage.setItem(AMBIENT_PANEL_EXPANDED_KEY, expanded ? '1' : '0');
    } catch {
      /* ignore */
    }
  };

  if (panel && expandBtn && collapseBtn) {
    const storedExpanded = localStorage.getItem(AMBIENT_PANEL_EXPANDED_KEY);
    setPanelExpanded(storedExpanded !== '0');
    expandBtn.addEventListener('click', () => setPanelExpanded(true));
    collapseBtn.addEventListener('click', () => setPanelExpanded(false));
  }

  const unmutedIcon = muteBtn.querySelector('[data-ambient-unmuted]');
  const mutedIcon = muteBtn.querySelector('[data-ambient-muted]');

  const stored = parseFloat(localStorage.getItem(AMBIENT_VOL_KEY));
  if (!Number.isNaN(stored) && stored >= 0 && stored <= 1) {
    audio.volume = stored;
    vol.value = String(stored);
  } else {
    audio.volume = 0.25;
    vol.value = '0.25';
  }

  audio.muted = localStorage.getItem(AMBIENT_MUTED_KEY) === '1';

  const syncVolAria = () => {
    const pct = Math.round(parseFloat(vol.value) * 100);
    vol.setAttribute('aria-valuenow', String(pct));
    vol.setAttribute('aria-valuetext', `${pct}%`);
  };
  syncVolAria();

  const setPower = (on) => {
    powerBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
    powerBtn.setAttribute('aria-label', on ? 'Turn background music off' : 'Turn background music on');
    powerBtn.classList.toggle('ambient-audio-panel__toggle--on', on);
    muteBtn.disabled = !on;
  };

  const setMutedUi = (m) => {
    muteBtn.setAttribute('aria-pressed', m ? 'true' : 'false');
    muteBtn.setAttribute('aria-label', m ? 'Unmute background music' : 'Mute background music');
    if (unmutedIcon) unmutedIcon.classList.toggle('hidden', m);
    if (mutedIcon) mutedIcon.classList.toggle('hidden', !m);
  };

  const applyMuted = (m) => {
    audio.muted = m;
    setMutedUi(m);
    localStorage.setItem(AMBIENT_MUTED_KEY, m ? '1' : '0');
  };

  setMutedUi(audio.muted);
  setPower(!audio.paused);

  powerBtn.addEventListener('click', async () => {
    if (!audio.paused) {
      audio.pause();
      setPower(false);
      return;
    }
    try {
      audio.loop = true;
      await audio.play();
      setPower(true);
    } catch {
      if (hint) hint.removeAttribute('hidden');
    }
  });

  muteBtn.addEventListener('click', () => {
    if (muteBtn.disabled) return;
    applyMuted(!audio.muted);
  });

  vol.addEventListener('input', () => {
    const v = parseFloat(vol.value);
    audio.volume = v;
    localStorage.setItem(AMBIENT_VOL_KEY, String(v));
    syncVolAria();
    if (v > 0 && audio.muted) applyMuted(false);
  });

  audio.addEventListener('play', () => setPower(true));
  audio.addEventListener('pause', () => setPower(false));

  audio.addEventListener('error', () => {
    if (hint) hint.removeAttribute('hidden');
    setPower(false);
  });

  audio.addEventListener('loadeddata', () => {
    if (hint) hint.setAttribute('hidden', '');
  });
}

window.addEventListener('hashchange', () => {
  openPostFromHash();
  applyHashToNav(location.hash);
});

function hideBootLoader() {
  const el = document.getElementById('site-boot-loader');
  if (!el) return;
  el.setAttribute('aria-busy', 'false');
  el.classList.add('site-boot-loader--done');
  let finished = false;
  const done = () => {
    if (finished) return;
    finished = true;
    el.remove();
    document.body.classList.remove('site-boot-loading');
  };
  el.addEventListener('transitionend', done, { once: true });
  /* Match .site-boot-loader transition (~1s); the old 100ms timeout removed the overlay before the fade and caused a visible jump */
  window.setTimeout(done, 1200);
}

document.addEventListener('DOMContentLoaded', async () => {
  try {
    const siteUrls = await loadSiteUrls();
    applyUrlKeyBindings(siteUrls);
    initTheme();
    initSectionNav();
    await initExperience();
    await initBlog();
    await initEducation();
    await initCredentials();
    await initRecommendations();
    await initLinkedInEmbeds();
    await initPhotos();
    initConnectMailto();
    initScrollFade();
    initCertificateDescMore();
    initAmbientAudio();
  } finally {
    hideBootLoader();
  }
});
