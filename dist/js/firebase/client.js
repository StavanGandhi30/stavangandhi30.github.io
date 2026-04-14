import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js';
import { getDownloadURL, getStorage } from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-storage.js';

const firebaseConfig = {
  apiKey: 'AIzaSyDBjvTCSMDbkjwAzhHP7Df_ApOF-l6rtRo',
  authDomain: 'shivgandhi30.firebaseapp.com',
  projectId: 'shivgandhi30',
  storageBucket: 'shivgandhi30.firebasestorage.app',
  messagingSenderId: '711360318828',
  appId: '1:711360318828:web:ef6d6e68fa17041d713749',
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const storage = getStorage(app);

/** Long TTL: download URLs are cheap to re-fetch if invalidated; long cache cuts repeat SDK + token work. */
const STORAGE_URL_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const STORAGE_URL_SESSION_PREFIX = 'sg-fb-storage-download-url-v1:';
const downloadUrlMemory = new Map();
const downloadUrlInflight = new Map();

function storageRefCacheKey(storageRef) {
  const path = storageRef?.fullPath != null ? String(storageRef.fullPath) : '';
  return path.replace(/^\/+/, '');
}

function readSessionDownloadUrl(key) {
  try {
    const raw = sessionStorage.getItem(`${STORAGE_URL_SESSION_PREFIX}${key}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.url !== 'string' || typeof parsed.expiresAt !== 'number') return null;
    if (Date.now() > parsed.expiresAt) {
      sessionStorage.removeItem(`${STORAGE_URL_SESSION_PREFIX}${key}`);
      return null;
    }
    return parsed.url;
  } catch {
    return null;
  }
}

function writeSessionDownloadUrl(key, url) {
  try {
    const expiresAt = Date.now() + STORAGE_URL_CACHE_TTL_MS;
    sessionStorage.setItem(`${STORAGE_URL_SESSION_PREFIX}${key}`, JSON.stringify({ url, expiresAt }));
  } catch {
    /* ignore quota / private mode */
  }
}

/**
 * Returns a download URL for a Storage ref with aggressive caching (memory + sessionStorage, 7d TTL).
 * Coalesces concurrent requests for the same object path.
 */
export async function getCachedDownloadURL(storageRef) {
  const key = storageRefCacheKey(storageRef);
  if (!key) return getDownloadURL(storageRef);

  const now = Date.now();
  const mem = downloadUrlMemory.get(key);
  if (mem && now < mem.expiresAt) return mem.url;

  const fromSession = readSessionDownloadUrl(key);
  if (fromSession) {
    downloadUrlMemory.set(key, { url: fromSession, expiresAt: now + STORAGE_URL_CACHE_TTL_MS });
    return fromSession;
  }

  if (downloadUrlInflight.has(key)) return downloadUrlInflight.get(key);

  const pending = (async () => {
    try {
      const url = await getDownloadURL(storageRef);
      const expiresAt = Date.now() + STORAGE_URL_CACHE_TTL_MS;
      downloadUrlMemory.set(key, { url, expiresAt });
      writeSessionDownloadUrl(key, url);
      return url;
    } finally {
      downloadUrlInflight.delete(key);
    }
  })();

  downloadUrlInflight.set(key, pending);
  return pending;
}

/** Drop all cached download URLs (memory + session). Call after storage mutations or sign-out. */
export function invalidateStorageDownloadUrlCache() {
  downloadUrlMemory.clear();
  downloadUrlInflight.clear();
  try {
    for (let i = sessionStorage.length - 1; i >= 0; i -= 1) {
      const k = sessionStorage.key(i);
      if (k && k.startsWith(STORAGE_URL_SESSION_PREFIX)) sessionStorage.removeItem(k);
    }
  } catch {
    /* ignore */
  }
}

export { app, auth, storage };
