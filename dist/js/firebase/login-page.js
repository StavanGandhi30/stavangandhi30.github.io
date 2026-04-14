import {
  onAuthStateChanged,
  setPersistence,
  signInWithEmailAndPassword,
  browserLocalPersistence,
} from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js';
import { auth } from './client.js';

const statusEl = document.getElementById('auth-status');
const formEl = document.getElementById('email-auth-form');
const emailEl = document.getElementById('email');
const passwordEl = document.getElementById('password');
const submitEl = document.getElementById('email-submit');

function safeNextPath() {
  const params = new URLSearchParams(window.location.search);
  const next = String(params.get('next') || '').trim();
  if (!next) return '/dropbox/';
  if (!next.startsWith('/')) return '/dropbox/';
  if (next.startsWith('//')) return '/dropbox/';
  return next;
}

function setStatus(message, isError = false) {
  if (!statusEl) return;
  statusEl.textContent = message;
  statusEl.classList.toggle('error', isError);
}

async function init() {
  await setPersistence(auth, browserLocalPersistence);
  const nextPath = safeNextPath();

  onAuthStateChanged(auth, (user) => {
    if (user) {
      window.location.replace(nextPath);
    }
  });

  formEl?.addEventListener('submit', async (event) => {
    event.preventDefault();
    setStatus('');

    const email = String(emailEl?.value || '').trim();
    const password = String(passwordEl?.value || '').trim();
    if (!email || !password) {
      setStatus('Email and password are required.', true);
      return;
    }
    if (password.length < 6) {
      setStatus('Password must be at least 6 characters.', true);
      return;
    }

    submitEl.disabled = true;
    try {
      await signInWithEmailAndPassword(auth, email, password);
      setStatus('Signed in. Redirecting...');
    } catch (err) {
      setStatus(err?.message || 'Sign-in failed.', true);
    } finally {
      submitEl.disabled = false;
    }
  });
}

init().catch((err) => {
  setStatus(err?.message || 'Auth bootstrap failed.', true);
});
