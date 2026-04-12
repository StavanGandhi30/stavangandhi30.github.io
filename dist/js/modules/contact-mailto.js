import { MAILTO_MAX } from '../constants.js';

export class ContactMailto {
  constructor({ to = 'stavangandhi3008@gmail.com', maxUrlLength = MAILTO_MAX } = {}) {
    this.to = to;
    this.maxUrlLength = maxUrlLength;
  }

  init() {
    const form = document.getElementById('contact-form');
    const status = document.getElementById('contact-status');
    if (!form || !status) return;

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
      const mailto = `mailto:${encodeURIComponent(this.to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

      if (mailto.length > this.maxUrlLength) {
        status.textContent =
          'Message is too long for a mailto link in some browsers. Shorten the text or copy your note and email directly.';
        status.classList.add('text-red-600', 'dark:text-red-400');
        return;
      }

      window.location.href = mailto;
    });
  }
}
