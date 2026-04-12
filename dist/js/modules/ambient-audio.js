import { AMBIENT_MUTED_KEY, AMBIENT_VOL_KEY } from '../constants.js';

export class AmbientAudio {
  constructor({ volKey = AMBIENT_VOL_KEY, mutedKey = AMBIENT_MUTED_KEY } = {}) {
    this.volKey = volKey;
    this.mutedKey = mutedKey;
  }

  init() {
    const audio = document.getElementById('ambient-audio');
    const powerBtn = document.querySelector('[data-ambient-power]');
    const muteBtn = document.querySelector('[data-ambient-mute]');
    const vol = document.querySelector('[data-ambient-volume]');
    const hint = document.querySelector('[data-ambient-hint]');
    if (!audio || !powerBtn || !muteBtn || !vol) return;

    const unmutedIcon = muteBtn.querySelector('[data-ambient-unmuted]');
    const mutedIcon = muteBtn.querySelector('[data-ambient-muted]');

    const stored = parseFloat(localStorage.getItem(this.volKey));
    if (!Number.isNaN(stored) && stored >= 0 && stored <= 1) {
      audio.volume = stored;
      vol.value = String(stored);
    } else {
      audio.volume = 0.25;
      vol.value = '0.25';
    }

    audio.muted = localStorage.getItem(this.mutedKey) === '1';

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
      localStorage.setItem(this.mutedKey, m ? '1' : '0');
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
      localStorage.setItem(this.volKey, String(v));
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
}
