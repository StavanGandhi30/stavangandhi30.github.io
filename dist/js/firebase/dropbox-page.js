import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js';
import {
  deleteObject,
  getBlob,
  getBytes,
  getMetadata,
  listAll,
  ref,
  updateMetadata,
  uploadBytes,
  uploadBytesResumable,
} from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-storage.js';
import { auth, getCachedDownloadURL, invalidateStorageDownloadUrlCache, storage } from './client.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

const statusEl = document.getElementById('dropbox-status');
const folderInputEl = document.getElementById('folder-input');
const filePickBtn = document.getElementById('file-pick-btn');
const refreshBtn = document.getElementById('refresh-btn');
const pendingFileListEl = document.getElementById('pending-file-list');
const pendingUploadBtn = document.getElementById('pending-upload-btn');
const pendingClearBtn = document.getElementById('pending-clear-btn');
const pendingModal = document.getElementById('pending-modal');
const pendingCloseBtn = document.getElementById('pending-close-btn');
const loadingOverlayEl = document.getElementById('loading-overlay');
const loadingLabelEl = document.getElementById('loading-label');
const textInputModalEl = document.getElementById('text-input-modal');
const textInputFormEl = document.getElementById('text-input-form');
const textInputTitleEl = document.getElementById('text-input-title');
const textInputHintEl = document.getElementById('text-input-hint');
const textInputFieldEl = document.getElementById('text-input-field');
const textInputCloseBtn = document.getElementById('text-input-close-btn');
const textInputCancelBtn = document.getElementById('text-input-cancel-btn');
const textInputSubmitBtn = document.getElementById('text-input-submit-btn');
const confirmModalEl = document.getElementById('confirm-modal');
const confirmModalTitleEl = document.getElementById('confirm-modal-title');
const confirmModalMessageEl = document.getElementById('confirm-modal-message');
const confirmModalOkBtn = document.getElementById('confirm-modal-ok-btn');
const confirmModalCancelBtn = document.getElementById('confirm-modal-cancel-btn');
const confirmModalCloseBtn = document.getElementById('confirm-modal-close-btn');
const fileListEl = document.getElementById('file-list');
const syncIndicatorEl = document.getElementById('sync-indicator');
const signOutBtn = document.getElementById('signout-btn');
const breadcrumbsEl = document.getElementById('breadcrumbs');
const searchEl = document.getElementById('search-input');
const typeFilterEl = document.getElementById('type-filter');
const dropzoneEl = document.getElementById('dropzone');
const newFolderBtn = document.getElementById('new-folder-btn');
const sidebarNewFolderBtn = document.getElementById('sidebar-new-folder-btn');
const selectionBarEl = document.getElementById('selection-bar');
const deleteSelectedBtn = document.getElementById('delete-selected-btn');
const folderListEl = document.getElementById('folder-list');
const folderHomeBtn = document.getElementById('folder-home-btn');
const sidebarResizerEl = document.getElementById('sidebar-resizer');
const appShellEl = document.querySelector('.app-shell');
const previewModal = document.getElementById('preview-modal');
const previewTitle = document.getElementById('preview-title');
const previewContent = document.getElementById('preview-content');
const previewCloseBtn = document.getElementById('preview-close-btn');
const sortButtons = Array.from(document.querySelectorAll('[data-sort-field]'));

const OWNER_UID = 'jkfTRq5tyTRnMFLkzkB0USUGzjd2';
const RENAME_ENABLED = false;
const TAGS_METADATA_KEY = 'hashtags';
const FOLDER_CACHE_TTL_MS = 5 * 60_000;
const FOLDER_CACHE_STORAGE_PREFIX = 'sg-dropbox-folder-cache-v1';
const STATUS_TOAST_MS = 4000;
const SELECTION_TOAST_MS = 3000;

let currentUser = null;
let currentPrefix = '';
let currentRows = [];
let queuedFiles = [];
let currentSort = 'date-desc';
let loadingDepth = 0;
let textInputResolver = null;
let confirmResolver = null;
let activeCacheUid = '';
const folderCache = new Map();
let lastSyncedAt = 0;
let lastSyncMode = '';
let syncTickerId = null;
const selectedPaths = new Set();
const SIDEBAR_WIDTH_KEY = 'sg-dropbox-sidebar-width';
const SIDEBAR_MIN = 220;
const SIDEBAR_MAX = 420;
let statusTimerId = null;
let selectionTimerId = null;

function pendingUploadCount() {
  return queuedFiles.length;
}

function syncUploadButtonVisibility() {
  const hasPendingFiles = pendingUploadCount() > 0;
  if (!hasPendingFiles && pendingModal) pendingModal.hidden = true;
  renderPendingFilesPreview();
}

function pendingFilesSnapshot() {
  return queuedFiles.slice();
}

function renderPendingFilesPreview() {
  if (!pendingFileListEl) return;
  pendingFileListEl.replaceChildren();
  const files = pendingFilesSnapshot();
  files.forEach((file) => {
    const li = document.createElement('li');
    li.className = 'pending-item';

    const left = document.createElement('div');
    left.className = 'pending-item__name';
    const icon = document.createElement('span');
    icon.className = 'pending-item__icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.appendChild(createFileTypeIconEl('file', file.name));
    const label = document.createElement('span');
    label.className = 'pending-item__label';
    label.textContent = file.name;
    left.appendChild(icon);
    left.appendChild(label);

    const meta = document.createElement('span');
    meta.className = 'pending-item__meta';
    meta.textContent = readableBytes(file.size);

    li.appendChild(left);
    li.appendChild(meta);
    pendingFileListEl.appendChild(li);
  });
}

function clearPendingFiles() {
  queuedFiles = [];
  if (folderInputEl) folderInputEl.value = '';
  syncUploadButtonVisibility();
  setStatus('Cleared selected folders.');
}

function clampSidebarWidth(px) {
  const n = Number(px);
  if (!Number.isFinite(n)) return SIDEBAR_MIN;
  return Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, n));
}

function setSidebarWidth(px) {
  if (!appShellEl) return;
  const clamped = clampSidebarWidth(px);
  appShellEl.style.setProperty('--sidebar-w', `${clamped}px`);
  try {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, String(clamped));
  } catch {
    /* ignore */
  }
}

function initSidebarResize() {
  if (!sidebarResizerEl || !appShellEl) return;

  try {
    const stored = Number(localStorage.getItem(SIDEBAR_WIDTH_KEY));
    if (Number.isFinite(stored)) {
      setSidebarWidth(stored);
    }
  } catch {
    /* ignore */
  }

  let startX = 0;
  let startW = 0;
  let dragging = false;

  const onMove = (event) => {
    if (!dragging) return;
    const dx = event.clientX - startX;
    setSidebarWidth(startW + dx);
  };

  const onUp = () => {
    dragging = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
  };

  sidebarResizerEl.addEventListener('pointerdown', (event) => {
    if (window.innerWidth <= 820) return;
    const styles = getComputedStyle(appShellEl);
    startW = parseFloat(styles.getPropertyValue('--sidebar-w')) || SIDEBAR_MIN;
    startX = event.clientX;
    dragging = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  });
}

function openPendingModal() {
  if (!pendingModal) return;
  if (!queuedFiles.length) return;
  pendingModal.hidden = false;
}

function closePendingModal() {
  if (!pendingModal) return;
  pendingModal.hidden = true;
}

function queueFilesForUpload(files) {
  const picked = Array.from(files || []);
  if (!picked.length) return;
  queuedFiles = [...queuedFiles, ...picked];
  syncUploadButtonVisibility();
  setStatus(`${picked.length} file(s) added to upload queue.`);
  openPendingModal();
}

function sortFieldLabel(field) {
  if (field === 'name') return 'item';
  if (field === 'type') return 'type';
  if (field === 'date') return 'updated';
  if (field === 'size') return 'size';
  return 'items';
}

function parseSortState(value) {
  const [fieldRaw, dirRaw] = String(value || '').split('-');
  const field =
    fieldRaw === 'name' || fieldRaw === 'type' || fieldRaw === 'date' || fieldRaw === 'size' ? fieldRaw : 'date';
  const dir = dirRaw === 'asc' ? 'asc' : 'desc';
  return { field, dir };
}

function defaultSortDir(field) {
  return field === 'name' || field === 'type' ? 'asc' : 'desc';
}

function updateSortButtons() {
  const active = parseSortState(currentSort);
  sortButtons.forEach((btn) => {
    const field = String(btn.dataset.sortField || '');
    const isActive = field === active.field;
    const shownDir = isActive ? active.dir : defaultSortDir(field);
    const nextDir = isActive ? (active.dir === 'asc' ? 'desc' : 'asc') : defaultSortDir(field);
    btn.classList.toggle('active', isActive);
    btn.textContent = shownDir === 'asc' ? '▲' : '▼';
    const fieldLabel = sortFieldLabel(field);
    const nextWord = nextDir === 'asc' ? 'ascending' : 'descending';
    btn.setAttribute('aria-label', `Sort ${fieldLabel} ${nextWord}`);
    btn.setAttribute('title', `Sort ${fieldLabel} ${nextWord}`);
  });
}

function setSort(value) {
  const next = String(value || '').trim();
  if (!next || next === currentSort) return;
  currentSort = next;
  updateSortButtons();
  renderRows(filterAndSortRows(currentRows));
}

function handleFilePickClick() {
  if (queuedFiles.length > 0) {
    openPendingModal();
    return;
  }
  folderInputEl?.click();
}

function setStatus(message, isError = false) {
  if (!statusEl) return;
  const text = String(message || '').trim();
  const hasMessage = Boolean(text);
  if (statusTimerId) {
    window.clearTimeout(statusTimerId);
    statusTimerId = null;
  }
  statusEl.classList.toggle('error', isError);
  statusEl.textContent = text;
  statusEl.classList.toggle('is-visible', hasMessage);
  syncIndicatorEl?.classList.toggle('is-hidden', hasMessage);
  if (!text) return;
  statusTimerId = window.setTimeout(() => {
    statusEl.textContent = '';
    statusEl.classList.remove('error');
    statusEl.classList.remove('is-visible');
    syncIndicatorEl?.classList.remove('is-hidden');
    statusTimerId = null;
  }, STATUS_TOAST_MS);
}

function showLoading(label = 'Loading...') {
  loadingDepth += 1;
  if (loadingLabelEl) loadingLabelEl.textContent = label;
  if (loadingOverlayEl) loadingOverlayEl.hidden = false;
}

function hideLoading() {
  loadingDepth = Math.max(0, loadingDepth - 1);
  if (loadingDepth > 0) return;
  if (loadingOverlayEl) loadingOverlayEl.hidden = true;
  if (loadingLabelEl) loadingLabelEl.textContent = 'Loading...';
}

function relativeSyncText(msAgo) {
  if (msAgo < 5_000) return 'just now';
  const seconds = Math.floor(msAgo / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

function renderSyncIndicator() {
  if (!syncIndicatorEl) return;
  if (!lastSyncedAt) {
    syncIndicatorEl.textContent = '';
    return;
  }
  const age = Math.max(0, Date.now() - lastSyncedAt);
  const prefix = lastSyncMode === 'cache' ? 'Showing cached items' : 'Last synced';
  syncIndicatorEl.textContent = `${prefix}: ${relativeSyncText(age)}`;
}

function setSyncState(atMs, mode = 'live') {
  lastSyncedAt = Number(atMs || 0);
  lastSyncMode = mode;
  renderSyncIndicator();
  if (syncTickerId) return;
  syncTickerId = window.setInterval(renderSyncIndicator, 1000);
}

function cloneRows(rows) {
  return (rows || []).map((row) => ({
    ...row,
    tags: Array.isArray(row?.tags) ? row.tags.slice() : [],
  }));
}

/** Persisted folder cache must not store download URLs (tokens, size); URLs are resolved lazily when needed. */
function rowsForFolderCachePersist(rows) {
  return cloneRows(rows || []).map((row) => (row.kind === 'file' ? { ...row, url: '' } : row));
}

function folderCacheStorageKey(uid) {
  return `${FOLDER_CACHE_STORAGE_PREFIX}:${uid}`;
}

function cachePathKey(path) {
  return normalizePrefix(path || '');
}

function isCacheEntryFresh(entry) {
  if (!entry || typeof entry !== 'object') return false;
  const fetchedAt = Number(entry.fetchedAt || 0);
  if (!Number.isFinite(fetchedAt) || fetchedAt <= 0) return false;
  return Date.now() - fetchedAt < FOLDER_CACHE_TTL_MS;
}

function persistFolderCache() {
  if (!activeCacheUid) return;
  try {
    const payload = {};
    folderCache.forEach((entry, key) => {
      payload[key] = {
        fetchedAt: Number(entry.fetchedAt || Date.now()),
        rows: rowsForFolderCachePersist(entry.rows || []),
      };
    });
    localStorage.setItem(folderCacheStorageKey(activeCacheUid), JSON.stringify(payload));
  } catch {
    /* ignore */
  }
}

function hydrateFolderCache(uid) {
  activeCacheUid = uid || '';
  folderCache.clear();
  if (!activeCacheUid) return;
  try {
    const raw = localStorage.getItem(folderCacheStorageKey(activeCacheUid));
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return;
    Object.entries(parsed).forEach(([key, entry]) => {
      if (!isCacheEntryFresh(entry)) return;
      folderCache.set(cachePathKey(key), {
        fetchedAt: Number(entry.fetchedAt || Date.now()),
        rows: cloneRows(Array.isArray(entry.rows) ? entry.rows : []),
      });
    });
  } catch {
    /* ignore */
  }
}

function clearFolderCache(path = null) {
  if (!activeCacheUid) return;
  if (path == null) {
    invalidateStorageDownloadUrlCache();
    folderCache.clear();
    try {
      localStorage.removeItem(folderCacheStorageKey(activeCacheUid));
    } catch {
      /* ignore */
    }
    return;
  }
  folderCache.delete(cachePathKey(path));
  persistFolderCache();
}

function setFolderCacheRows(path, rows, fetchedAt = Date.now()) {
  if (!activeCacheUid) return;
  folderCache.set(cachePathKey(path), { fetchedAt: Number(fetchedAt || Date.now()), rows: cloneRows(rows) });
  persistFolderCache();
}

function getFolderCacheEntry(path) {
  const key = cachePathKey(path);
  const entry = folderCache.get(key);
  if (!isCacheEntryFresh(entry)) {
    folderCache.delete(key);
    persistFolderCache();
    return null;
  }
  return { fetchedAt: Number(entry.fetchedAt || Date.now()), rows: cloneRows(entry.rows || []) };
}

function resolveTextInput(value) {
  if (!textInputResolver) return;
  const resolver = textInputResolver;
  textInputResolver = null;
  if (textInputModalEl) textInputModalEl.hidden = true;
  if (textInputFieldEl) textInputFieldEl.value = '';
  resolver(value);
}

function resolveConfirm(value) {
  if (!confirmResolver) return;
  const resolver = confirmResolver;
  confirmResolver = null;
  if (confirmModalEl) confirmModalEl.hidden = true;
  resolver(Boolean(value));
}

function requestConfirm({
  title = 'Confirm',
  message = '',
  confirmLabel = 'OK',
  cancelLabel = 'Cancel',
  danger = false,
} = {}) {
  if (!confirmModalEl || !confirmModalTitleEl || !confirmModalMessageEl || !confirmModalOkBtn) {
    return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  }
  if (confirmResolver) resolveConfirm(false);

  confirmModalTitleEl.textContent = title;
  confirmModalMessageEl.textContent = message;
  if (confirmModalCancelBtn) confirmModalCancelBtn.textContent = cancelLabel;
  confirmModalOkBtn.textContent = confirmLabel;
  confirmModalOkBtn.classList.toggle('primary', !danger);
  confirmModalOkBtn.classList.toggle('confirm-modal-ok--danger', danger);
  confirmModalEl.hidden = false;

  return new Promise((resolve) => {
    confirmResolver = resolve;

    const onOk = () => {
      resolveConfirm(true);
      cleanup();
    };
    const onCancel = () => {
      resolveConfirm(false);
      cleanup();
    };
    const onBackdrop = (event) => {
      if (event.target !== confirmModalEl) return;
      resolveConfirm(false);
      cleanup();
    };
    const onKeyDown = (event) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      resolveConfirm(false);
      cleanup();
    };

    const cleanup = () => {
      confirmModalOkBtn.removeEventListener('click', onOk);
      confirmModalCancelBtn?.removeEventListener('click', onCancel);
      confirmModalCloseBtn?.removeEventListener('click', onCancel);
      confirmModalEl.removeEventListener('click', onBackdrop);
      window.removeEventListener('keydown', onKeyDown);
    };

    confirmModalOkBtn.addEventListener('click', onOk);
    confirmModalCancelBtn?.addEventListener('click', onCancel);
    confirmModalCloseBtn?.addEventListener('click', onCancel);
    confirmModalEl.addEventListener('click', onBackdrop);
    window.addEventListener('keydown', onKeyDown);
    window.setTimeout(() => {
      if (danger) confirmModalCancelBtn?.focus();
      else confirmModalOkBtn.focus();
    }, 0);
  });
}

function requestConfirmDeleteFolder(folderName) {
  return requestConfirm({
    title: 'Delete folder',
    message: `"${folderName}" is not empty. This will permanently delete the folder and everything inside it.`,
    confirmLabel: 'Delete everything',
    cancelLabel: 'Cancel',
    danger: true,
  });
}

function requestTextInput({
  title = 'Input',
  hint = '',
  value = '',
  placeholder = '',
  submitLabel = 'Save',
} = {}) {
  if (!textInputModalEl || !textInputFormEl || !textInputFieldEl) {
    return Promise.resolve(window.prompt(title, value) ?? null);
  }
  if (textInputResolver) resolveTextInput(null);

  if (textInputTitleEl) textInputTitleEl.textContent = title;
  if (textInputHintEl) {
    textInputHintEl.textContent = hint || '';
    textInputHintEl.hidden = !hint;
  }
  textInputFieldEl.value = String(value || '');
  textInputFieldEl.placeholder = String(placeholder || '');
  if (textInputSubmitBtn) textInputSubmitBtn.textContent = submitLabel;
  textInputModalEl.hidden = false;

  return new Promise((resolve) => {
    textInputResolver = resolve;

    const onSubmit = (event) => {
      event.preventDefault();
      resolveTextInput(String(textInputFieldEl.value || ''));
      cleanup();
    };
    const onCancel = () => {
      resolveTextInput(null);
      cleanup();
    };
    const onBackdropClick = (event) => {
      if (event.target !== textInputModalEl) return;
      resolveTextInput(null);
      cleanup();
    };
    const onKeyDown = (event) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      resolveTextInput(null);
      cleanup();
    };
    const cleanup = () => {
      textInputFormEl.removeEventListener('submit', onSubmit);
      textInputCancelBtn?.removeEventListener('click', onCancel);
      textInputCloseBtn?.removeEventListener('click', onCancel);
      textInputModalEl.removeEventListener('click', onBackdropClick);
      window.removeEventListener('keydown', onKeyDown);
    };

    textInputFormEl.addEventListener('submit', onSubmit);
    textInputCancelBtn?.addEventListener('click', onCancel);
    textInputCloseBtn?.addEventListener('click', onCancel);
    textInputModalEl.addEventListener('click', onBackdropClick);
    window.addEventListener('keydown', onKeyDown);
    window.setTimeout(() => {
      textInputFieldEl.focus();
      textInputFieldEl.select();
    }, 0);
  });
}

function loginRedirectUrl() {
  const next = `${window.location.pathname || '/dropbox/'}${window.location.search || ''}${window.location.hash || ''}`;
  return `/login/?next=${encodeURIComponent(next)}`;
}

function safeName(raw) {
  return String(raw || '')
    .trim()
    .replace(/[^\w.\-]/g, '_');
}

function normalizeTag(raw) {
  const cleaned = String(raw || '')
    .trim()
    .replace(/^#+/, '')
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '');
  return cleaned ? `#${cleaned}` : '';
}

function parseTagInput(raw) {
  const tokens = String(raw || '')
    .split(/[\s,]+/)
    .map(normalizeTag)
    .filter(Boolean);
  return Array.from(new Set(tokens)).slice(0, 20);
}

function tagsFromMetadata(metadata) {
  const raw = String(metadata?.customMetadata?.[TAGS_METADATA_KEY] || '').trim();
  if (!raw) return [];
  return parseTagInput(raw);
}

function tagsToMetadataValue(tags) {
  const clean = Array.from(new Set((tags || []).map(normalizeTag).filter(Boolean))).slice(0, 20);
  return clean.join(' ');
}

function getRowTags(row) {
  return Array.isArray(row?.tags) ? row.tags : [];
}

async function updateObjectTags(targetRef, tags) {
  const metadata = await getMetadata(targetRef);
  const customMetadata = { ...(metadata?.customMetadata || {}) };
  const serialized = tagsToMetadataValue(tags);
  if (serialized) customMetadata[TAGS_METADATA_KEY] = serialized;
  else delete customMetadata[TAGS_METADATA_KEY];
  await updateMetadata(targetRef, { customMetadata });
}

async function ensureFolderKeepRef(folderPath) {
  const listing = await listAll(ref(storage, folderPath));
  const keepItem = (listing.items || []).find((itemRef) => itemRef.name === '.keep');
  if (keepItem) return keepItem;
  const keepRef = ref(storage, `${folderPath}/.keep`);
  await uploadBytes(keepRef, new Blob(['keep']));
  return keepRef;
}

function patchRowTags(path, nextTags) {
  currentRows = currentRows.map((row) => {
    if (row.fullPath !== path) return row;
    return { ...row, tags: nextTags.slice() };
  });
}

async function editRowTags(row) {
  if (!row?.fullPath) return;
  const current = getRowTags(row);
  const hint = current.join(' ');
  const nextRaw = await requestTextInput({
    title: `Edit hashtags: ${row.name}`,
    hint: 'Use space/comma separated hashtags (e.g. #finance #2026). Leave empty to clear.',
    value: hint,
    placeholder: '#tag1 #tag2',
    submitLabel: 'Save',
  });
  if (nextRaw == null) return;
  const next = parseTagInput(nextRaw);
  try {
    showLoading('Saving hashtags...');
    if (row.kind === 'folder') {
      const keepRef = await ensureFolderKeepRef(row.fullPath);
      await updateObjectTags(keepRef, next);
    } else {
      await updateObjectTags(ref(storage, row.fullPath), next);
    }
    patchRowTags(row.fullPath, next);
    setFolderCacheRows(currentFolderPath(), currentRows);
    renderRows(filterAndSortRows(currentRows));
    setStatus(next.length ? `Updated tags for "${row.name}".` : `Cleared tags for "${row.name}".`);
  } catch (err) {
    setStatus(err?.message || 'Could not save tags.', true);
  } finally {
    hideLoading();
  }
}

function rootPrefix(uid) {
  return `private/${uid}`;
}

function normalizePrefix(prefix) {
  if (!prefix) return '';
  return String(prefix).replace(/^\/+|\/+$/g, '');
}

function currentFolderPath() {
  const root = rootPrefix(currentUser.uid);
  const normalized = normalizePrefix(currentPrefix);
  return normalized ? `${root}/${normalized}` : root;
}

function childFolderPrefix(name) {
  const normalized = normalizePrefix(currentPrefix);
  return normalized ? `${normalized}/${name}` : name;
}

function readableBytes(bytes) {
  const value = Number(bytes || 0);
  if (!value) return '';
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function fileDateLabel(timeCreated) {
  if (!timeCreated) return '';
  const d = new Date(timeCreated);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString();
}

function createFileTypeSvgRoot() {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.5');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  svg.classList.add('file-type-icon');
  return svg;
}

function svgAppend(svg, tag, attrs) {
  const el = document.createElementNS(SVG_NS, tag);
  Object.entries(attrs).forEach(([key, value]) => {
    if (value != null && value !== '') el.setAttribute(key, String(value));
  });
  svg.appendChild(el);
  return el;
}

function createFileTypeIconEl(kind, name = '') {
  const svg = createFileTypeSvgRoot();
  if (kind === 'folder') {
    svgAppend(svg, 'path', {
      d: 'M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z',
    });
    return svg;
  }
  const n = String(name || '').toLowerCase();
  if (/\.(png|jpe?g|gif|webp|svg)$/.test(n)) {
    svgAppend(svg, 'rect', { width: '18', height: '18', x: '3', y: '3', rx: '2', ry: '2' });
    svgAppend(svg, 'circle', { cx: '9', cy: '9', r: '2' });
    svgAppend(svg, 'path', { d: 'm21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21' });
    return svg;
  }
  if (/\.(mp4|mov|webm|m4v)$/.test(n)) {
    svgAppend(svg, 'path', {
      d: 'm16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.87a.5.5 0 0 0-.752-.432L16 10.5',
    });
    svgAppend(svg, 'rect', { x: '2', y: '6', width: '14', height: '12', rx: '2' });
    return svg;
  }
  if (/\.(mp3|wav|m4a|aac|flac)$/.test(n)) {
    svgAppend(svg, 'path', { d: 'M9 18V5l12-2v13' });
    svgAppend(svg, 'circle', { cx: '6', cy: '18', r: '3' });
    svgAppend(svg, 'circle', { cx: '18', cy: '16', r: '3' });
    return svg;
  }
  if (/\.pdf$/.test(n)) {
    svgAppend(svg, 'path', { d: 'M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z' });
    svgAppend(svg, 'path', { d: 'M14 2v4a2 2 0 0 0 2 2h4' });
    svgAppend(svg, 'path', { d: 'M10 9H8' });
    svgAppend(svg, 'path', { d: 'M16 13H8' });
    svgAppend(svg, 'path', { d: 'M16 17H8' });
    return svg;
  }
  if (/\.(zip|rar|7z|tar|gz)$/.test(n)) {
    svgAppend(svg, 'rect', { width: '20', height: '5', x: '2', y: '3', rx: '1' });
    svgAppend(svg, 'path', { d: 'M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8' });
    svgAppend(svg, 'path', { d: 'M10 12h4' });
    return svg;
  }
  svgAppend(svg, 'path', { d: 'M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z' });
  svgAppend(svg, 'path', { d: 'M14 2v4a2 2 0 0 0 2 2h4' });
  return svg;
}

function fileTypeLabel(row) {
  if (row.kind === 'folder') return 'Folder';
  const n = String(row.name || '').toLowerCase();
  if (/\.(png|jpe?g|gif|webp|svg)$/.test(n)) return 'Image';
  if (/\.(mp4|mov|webm|m4v)$/.test(n)) return 'Video';
  if (/\.(mp3|wav|m4a|aac|flac)$/.test(n)) return 'Audio';
  if (/\.pdf$/.test(n)) return 'PDF';
  if (/\.(zip|rar|7z|tar|gz)$/.test(n)) return 'Archive';
  const dot = n.lastIndexOf('.');
  if (dot > -1 && dot < n.length - 1) return n.slice(dot + 1).toUpperCase();
  return 'File';
}

function fileTypeKey(row) {
  return fileTypeLabel(row).toLowerCase();
}

async function ensureFileRowUrl(row) {
  if (!row || row.kind !== 'file') return '';
  const existing = String(row.url || '').trim();
  if (existing) return existing;
  const path = String(row.fullPath || '').trim();
  if (!path) throw new Error('Missing file path.');
  const url = await getCachedDownloadURL(ref(storage, path));
  row.url = url;
  return url;
}

function toTitleCase(value) {
  const str = String(value || '').trim();
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function populateTypeFilterOptions(rows) {
  if (!typeFilterEl) return;
  const previous = String(typeFilterEl.value || 'all').toLowerCase();
  const types = Array.from(new Set((rows || []).map((row) => fileTypeKey(row)).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b)
  );

  typeFilterEl.replaceChildren();
  const allOpt = document.createElement('option');
  allOpt.value = 'all';
  allOpt.textContent = 'All';
  typeFilterEl.appendChild(allOpt);

  types.forEach((type) => {
    const opt = document.createElement('option');
    opt.value = type;
    opt.textContent = toTitleCase(type);
    typeFilterEl.appendChild(opt);
  });

  const hasPrevious = previous === 'all' || types.includes(previous);
  typeFilterEl.value = hasPrevious ? previous : 'all';
}

function buildShortFileLink(row) {
  if (!row || row.kind !== 'file') return '';
  const rawUrl = String(row.url || '').trim();
  if (!rawUrl) return '';
  try {
    const parsed = new URL(rawUrl);
    const token = String(parsed.searchParams.get('token') || '').trim();
    if (!token) return '';
    const marker = '/o/';
    const i = parsed.pathname.indexOf(marker);
    if (i < 0) return '';
    const encodedObjectPath = parsed.pathname.slice(i + marker.length);
    const objectPath = decodeURIComponent(encodedObjectPath);
    if (!objectPath) return '';
    const basePrefix = `private/${OWNER_UID}/`;
    const shortPath = objectPath.startsWith(basePrefix) ? objectPath.slice(basePrefix.length) : objectPath;
    if (!shortPath) return '';
    return `${window.location.origin}/s/?p=${encodeURIComponent(shortPath)}&t=${encodeURIComponent(token)}`;
  } catch {
    return '';
  }
}

async function copyShortLink(row) {
  try {
    await ensureFileRowUrl(row);
  } catch {
    setStatus('No short link available for this item.', true);
    return;
  }
  const value = buildShortFileLink(row);
  if (!value) {
    setStatus('No short link available for this item.', true);
    return;
  }
  try {
    await navigator.clipboard.writeText(value);
    setStatus('Copied public short link.');
  } catch {
    setStatus('Could not copy short link. Clipboard access may be blocked.', true);
  }
}

async function handleShortDownloadFromQuery() {
  if (!currentUser) return false;
  const params = new URLSearchParams(window.location.search);
  const dl = String(params.get('dl') || '').trim();
  if (!dl) return false;

  const clearQueryParam = () => {
    params.delete('dl');
    const next = params.toString();
    const path = window.location.pathname || '/dropbox/';
    const hash = window.location.hash || '';
    const query = next ? `?${next}` : '';
    window.history.replaceState(null, '', `${path}${query}${hash}`);
  };

  const relPath = normalizePrefix(decodeURIComponent(dl));
  if (!relPath || relPath.includes('..')) {
    clearQueryParam();
    setStatus('Invalid short link.', true);
    return true;
  }

  try {
    setStatus('Opening short link...');
    const fullPath = `${rootPrefix(currentUser.uid)}/${relPath}`;
    const url = await getCachedDownloadURL(ref(storage, fullPath));
    triggerBrowserDownload(url, relPath.split('/').pop() || 'download');
    setStatus('Started download from short link.');
  } catch (err) {
    setStatus(err?.message || 'Short link download failed.', true);
  } finally {
    clearQueryParam();
  }
  return true;
}

function withTimeout(promise, ms, message) {
  let timer = null;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

function uploadBlobWithProgress(toRef, blob, metadata, onProgress) {
  return new Promise((resolve, reject) => {
    const task = uploadBytesResumable(toRef, blob, {
      contentType: metadata?.contentType || blob.type || 'application/octet-stream',
    });
    task.on(
      'state_changed',
      (snapshot) => {
        if (!onProgress) return;
        const total = Number(snapshot.totalBytes || 0);
        const transferred = Number(snapshot.bytesTransferred || 0);
        const percent = total > 0 ? Math.max(1, Math.min(100, Math.round((transferred / total) * 100))) : 0;
        onProgress(percent);
      },
      reject,
      resolve
    );
  });
}

async function downloadBlobWithFetch(url, expectedSize = 0) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 300000);
  try {
    const response = await fetch(url, { signal: controller.signal, cache: 'default' });
    if (!response.ok) {
      throw new Error(`Could not download file (HTTP ${response.status}).`);
    }
    if (!response.body) {
      return await response.blob();
    }
    const reader = response.body.getReader();
    const chunks = [];
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        chunks.push(value);
        total += value.byteLength;
      }
    }
    const blobType = response.headers.get('content-type') || 'application/octet-stream';
    const size = expectedSize > 0 ? expectedSize : total;
    return new Blob(chunks, { type: blobType, endings: 'transparent' }).slice(0, size);
  } catch (err) {
    if (err?.name === 'AbortError') {
      throw new Error('Timed out downloading file.');
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

async function downloadSourceBlob(fromRef, metadata, onPhase) {
  try {
    if (onPhase) onPhase('download-url');
    const url = await withTimeout(getCachedDownloadURL(fromRef), 15000, 'Timed out creating source download URL.');
    return await downloadBlobWithFetch(url, Number(metadata?.size || 0));
  } catch (urlReadError) {
    try {
      if (onPhase) onPhase('sdk-bytes');
      const bytes = await withTimeout(
        getBytes(fromRef, 1024 * 1024 * 1024),
        120000,
        'Timed out reading source file for rename.'
      );
      return new Blob([bytes]);
    } catch (bytesError) {
      try {
        if (onPhase) onPhase('sdk-blob');
        return await withTimeout(getBlob(fromRef), 120000, 'Timed out reading source file for rename.');
      } catch (blobError) {
        const reason =
          blobError?.message || bytesError?.message || urlReadError?.message || 'Unknown read error.';
        throw new Error(`Could not read source file for rename. ${reason}`);
      }
    }
  }
}

async function copyStorageObject(fromRef, toRef, onProgress, onPhase) {
  if (onPhase) onPhase('downloading');
  const metadata = await withTimeout(getMetadata(fromRef), 30000, 'Timed out reading file metadata for rename.');
  const blob = await downloadSourceBlob(fromRef, metadata, onPhase);
  if (onPhase) onPhase('uploading');
  await withTimeout(
    uploadBlobWithProgress(toRef, blob, metadata, onProgress),
    300000,
    'Timed out writing renamed file.'
  );
  if (onPhase) onPhase('done');
}

async function listAllItemsRecursive(folderRef) {
  const listing = await listAll(folderRef);
  const all = [...listing.items];
  for (const sub of listing.prefixes) {
    const nested = await listAllItemsRecursive(sub);
    all.push(...nested);
  }
  return all;
}

/**
 * Lightweight folder summary: one getMetadata on `.keep` (tags + rough date).
 * Skips recursive listAll/getMetadata over every nested file (major bandwidth + quota saver).
 * Folder size stays 0 (UI shows "--"); sort-by-size treats folders as equal.
 */
async function resolveFolderStats(folderRef) {
  const prefix = String(folderRef?.fullPath || '').replace(/\/+$/, '');
  let tags = [];
  let latestTime = '';
  if (!prefix) return { totalSize: 0, latestTime, tags };
  try {
    const keepMeta = await getMetadata(ref(storage, `${prefix}/.keep`));
    tags = tagsFromMetadata(keepMeta);
    latestTime = String(keepMeta.timeCreated || keepMeta.updated || '');
  } catch {
    /* no .keep or inaccessible */
  }
  return { totalSize: 0, latestTime, tags };
}

function normalizeUploadRelativePath(rawPath) {
  return String(rawPath || '')
    .replace(/\\/g, '/')
    .replace(/^\/+|\/+$/g, '');
}

function dropFirstPathSegment(path) {
  const normalized = normalizeUploadRelativePath(path);
  const index = normalized.indexOf('/');
  return index >= 0 ? normalized.slice(index + 1) : '';
}

function appendNumericSuffix(fileName, n) {
  const name = String(fileName || '').trim();
  const dot = name.lastIndexOf('.');
  if (dot > 0) {
    const base = name.slice(0, dot);
    const ext = name.slice(dot);
    return `${base}${n}${ext}`;
  }
  return `${name}${n}`;
}

async function objectExistsAtPath(fullPath) {
  try {
    await getMetadata(ref(storage, fullPath));
    return true;
  } catch (err) {
    if (String(err?.code || '').includes('object-not-found')) return false;
    throw err;
  }
}

async function resolveUniqueTargetPath(fullPath, reservedPaths) {
  const normalized = String(fullPath || '').replace(/\/+/g, '/');
  if (!normalized) return normalized;

  const slash = normalized.lastIndexOf('/');
  const dir = slash >= 0 ? normalized.slice(0, slash) : '';
  const fileName = slash >= 0 ? normalized.slice(slash + 1) : normalized;
  let candidate = normalized;
  let suffix = 2;

  while (reservedPaths.has(candidate) || (await objectExistsAtPath(candidate))) {
    const nextName = appendNumericSuffix(fileName, suffix);
    candidate = dir ? `${dir}/${nextName}` : nextName;
    suffix += 1;
  }

  reservedPaths.add(candidate);
  return candidate;
}

function triggerBrowserDownload(url, filename) {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || '';
  a.rel = 'noopener noreferrer';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function triggerBlobDownload(blob, filename) {
  const blobUrl = URL.createObjectURL(blob);
  triggerBrowserDownload(blobUrl, filename);
  window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
}

async function downloadFolderAsFiles(row, visibleItems) {
  for (let index = 0; index < visibleItems.length; index += 1) {
    const itemRef = visibleItems[index];
    const rel = itemRef.fullPath.slice(row.fullPath.length + 1);
    setStatus(`Starting file downloads... ${index + 1}/${visibleItems.length}`);
    const url = await withTimeout(getCachedDownloadURL(itemRef), 30000, `Timed out resolving "${itemRef.name}".`);
    const fallbackName = `${row.name}__${rel.replace(/[\\/]/g, '__')}`;
    triggerBrowserDownload(url, fallbackName);
  }
  setStatus(`Started download for ${visibleItems.length} file(s).`);
}

async function downloadFolder(row) {
  if (!row || row.kind !== 'folder') return;
  setStatus(`Preparing "${row.name}" for download...`);
  let visibleItems = [];
  try {
    showLoading(`Preparing "${row.name}"...`);
    const items = await listAllItemsRecursive(ref(storage, row.fullPath));
    visibleItems = items.filter((itemRef) => itemRef.name !== '.keep');
    if (!visibleItems.length) {
      setStatus('Folder is empty.');
      return;
    }
    const JSZip = window.JSZip;
    if (!JSZip) {
      await downloadFolderAsFiles(row, visibleItems);
      return;
    }

    const zip = new JSZip();
    for (let index = 0; index < visibleItems.length; index += 1) {
      const itemRef = visibleItems[index];
      const rel = itemRef.fullPath.slice(row.fullPath.length + 1);
      setStatus(`Preparing "${row.name}" for download... ${index + 1}/${visibleItems.length}`);
      const [url, metadata] = await Promise.all([
        withTimeout(getCachedDownloadURL(itemRef), 20000, `Timed out resolving URL for "${itemRef.name}".`),
        withTimeout(getMetadata(itemRef), 30000, `Timed out reading metadata for "${itemRef.name}".`),
      ]);
      const blob = await withTimeout(
        downloadBlobWithFetch(url, Number(metadata?.size || 0)),
        300000,
        `Timed out downloading "${itemRef.name}" while creating folder zip.`
      );
      zip.file(`${row.name}/${rel}`, blob);
    }

    const safeFolderName = safeName(row.name) || 'folder';
    const zipBlob = await zip.generateAsync(
      { type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } },
      (meta) => {
        const percent = Math.max(0, Math.min(100, Math.round(Number(meta.percent || 0))));
        setStatus(`Packaging "${row.name}"... ${percent}%`);
      }
    );
    triggerBlobDownload(zipBlob, `${safeFolderName}.zip`);
    setStatus(`Downloaded "${safeFolderName}.zip".`);
  } catch (err) {
    const message = String(err?.message || '');
    const shouldFallback =
      visibleItems.length > 0 &&
      (message === 'Load failed' || message.includes('Failed to fetch') || message.includes('Could not download file'));
    if (shouldFallback) {
      try {
        setStatus('ZIP failed in this browser. Falling back to direct file downloads...');
        await downloadFolderAsFiles(row, visibleItems);
        return;
      } catch (fallbackErr) {
        setStatus(fallbackErr?.message || 'Folder download failed.', true);
        return;
      }
    }
    setStatus(message || 'Folder download failed.', true);
  } finally {
    hideLoading();
  }
}

async function renameRow(row) {
  if (!RENAME_ENABLED) {
    setStatus('Rename is temporarily disabled.');
    return;
  }
  const currentName = String(row.name || '').trim();
  if (!currentName) {
    setStatus('Rename failed: Missing item name.', true);
    return;
  }
  const nextRaw = window.prompt('Rename to:', currentName);
  if (nextRaw == null) {
    setStatus('Rename canceled.');
    return;
  }
  let nextName = safeName(nextRaw);
  if (!nextName) {
    setStatus('Rename failed: Enter a valid name.', true);
    return;
  }
  if (row.kind === 'file' && !nextName.includes('.')) {
    const extMatch = currentName.match(/(\.[^.]+)$/);
    if (extMatch && !nextName.endsWith(extMatch[1])) {
      nextName += extMatch[1];
    }
  }
  if (nextName === currentName) {
    setStatus('Name is unchanged.');
    return;
  }
  setStatus(`Renaming "${currentName}"...`);

  try {
    if (row.kind === 'file') {
      const oldPath = String(row.fullPath || '');
      const slash = oldPath.lastIndexOf('/');
      if (slash < 0) throw new Error('Invalid file path.');
      const parent = oldPath.slice(0, slash);
      const newPath = `${parent}/${nextName}`;
      if (newPath === oldPath) {
        setStatus('Name is unchanged.');
        return;
      }
      await copyStorageObject(
        ref(storage, oldPath),
        ref(storage, newPath),
        (percent) => {
          setStatus(`Renaming "${currentName}"... uploading ${percent}%`);
        },
        (phase) => {
          if (phase === 'downloading') setStatus(`Renaming "${currentName}"... downloading source`);
          if (phase === 'download-url') setStatus(`Renaming "${currentName}"... reading via download URL`);
          if (phase === 'sdk-bytes') setStatus(`Renaming "${currentName}"... retrying source read (bytes)`);
          if (phase === 'sdk-blob') setStatus(`Renaming "${currentName}"... retrying source read (blob)`);
          if (phase === 'uploading') setStatus(`Renaming "${currentName}"... starting upload`);
        }
      );
      setStatus(`Renaming "${currentName}"... finalizing`);
      await deleteObject(ref(storage, oldPath));
      setStatus(`Renamed file to "${nextName}".`);
    } else {
      const oldPrefix = String(row.fullPath || '').replace(/\/+$/, '');
      const slash = oldPrefix.lastIndexOf('/');
      if (slash < 0) throw new Error('Invalid folder path.');
      const parent = oldPrefix.slice(0, slash);
      const newPrefix = `${parent}/${nextName}`;
      if (newPrefix === oldPrefix) {
        setStatus('Name is unchanged.');
        return;
      }

      const items = await listAllItemsRecursive(ref(storage, oldPrefix));
      for (let index = 0; index < items.length; index += 1) {
        const itemRef = items[index];
        setStatus(`Renaming folder "${currentName}"... copying ${index + 1}/${items.length}`);
        const rel = itemRef.fullPath.slice(oldPrefix.length + 1);
        const newPath = rel ? `${newPrefix}/${rel}` : newPrefix;
        await copyStorageObject(itemRef, ref(storage, newPath));
      }
      for (let index = 0; index < items.length; index += 1) {
        const itemRef = items[index];
        setStatus(`Renaming folder "${currentName}"... cleaning ${index + 1}/${items.length}`);
        await deleteObject(itemRef);
      }
      setStatus(`Renamed folder to "${nextName}".`);
    }
    invalidateStorageDownloadUrlCache();
    await refreshFileList({ forceLive: true });
  } catch (err) {
    const detail = err?.message || err?.code || 'Rename failed.';
    setStatus(`Rename failed: ${detail}`, true);
  }
}

function isEffectivelyEmptyFolderListing(listing) {
  const visibleItems = (listing?.items || []).filter((itemRef) => itemRef.name !== '.keep');
  const nestedFolders = listing?.prefixes || [];
  return visibleItems.length === 0 && nestedFolders.length === 0;
}

async function deleteFolderTree(folderPath) {
  const allItems = await listAllItemsRecursive(ref(storage, folderPath));
  for (const itemRef of allItems) {
    await deleteObject(itemRef);
  }
}

function closePreview() {
  previewModal.hidden = true;
  previewContent.replaceChildren();
}

async function showPreview(row) {
  if (!row || row.kind !== 'file') return;
  try {
    await ensureFileRowUrl(row);
  } catch (err) {
    setStatus(err?.message || 'Could not load preview.', true);
    return;
  }
  if (!row.url) return;
  previewTitle.textContent = row.name;
  previewContent.replaceChildren();
  const lower = row.name.toLowerCase();
  let el;
  if (/\.(png|jpe?g|gif|webp|svg)$/.test(lower)) {
    el = document.createElement('img');
    el.loading = 'lazy';
    el.decoding = 'async';
    el.src = row.url;
    el.alt = row.name;
  } else if (/\.(mp4|mov|webm|m4v)$/.test(lower)) {
    el = document.createElement('video');
    el.preload = 'none';
    el.src = row.url;
    el.controls = true;
  } else if (/\.(mp3|wav|m4a|aac|flac)$/.test(lower)) {
    el = document.createElement('audio');
    el.preload = 'none';
    el.src = row.url;
    el.controls = true;
  } else if (/\.pdf$/.test(lower)) {
    el = document.createElement('iframe');
    el.loading = 'lazy';
    el.src = row.url;
    el.width = '100%';
    el.height = '700';
    el.title = row.name;
  } else {
    const link = document.createElement('a');
    link.href = row.url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.className = 'file-link';
    link.textContent = 'Open file in new tab';
    previewContent.appendChild(link);
    previewModal.hidden = false;
    return;
  }
  previewContent.appendChild(el);
  previewModal.hidden = false;
}

function renderBreadcrumbs() {
  breadcrumbsEl.replaceChildren();
  const parts = normalizePrefix(currentPrefix).split('/').filter(Boolean);
  const nodes = [{ label: 'Home', prefix: '' }];
  let p = '';
  parts.forEach((part) => {
    p = p ? `${p}/${part}` : part;
    nodes.push({ label: part, prefix: p });
  });

  nodes.forEach((node, index) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'crumb';
    btn.textContent = node.label;
    btn.addEventListener('click', () => {
      currentPrefix = node.prefix;
      selectedPaths.clear();
      refreshFileList();
    });
    breadcrumbsEl.appendChild(btn);
    if (index < nodes.length - 1) {
      const sep = document.createElement('span');
      sep.className = 'crumb-sep';
      sep.textContent = '/';
      breadcrumbsEl.appendChild(sep);
    }
  });
}

function renderFolderSidebar(rows) {
  if (!folderListEl) return;
  folderListEl.replaceChildren();
  const currentParts = normalizePrefix(currentPrefix).split('/').filter(Boolean);
  const folders = rows
    .filter((r) => r.kind === 'folder')
    .sort((a, b) => a.name.localeCompare(b.name));
  folderHomeBtn?.classList.toggle('active', !currentPrefix);

  const items = [];
  let runningPath = '';
  currentParts.forEach((part, index) => {
    runningPath = runningPath ? `${runningPath}/${part}` : part;
    items.push({
      label: part,
      relPath: runningPath,
      depth: index + 1,
      kind: 'ancestor',
    });
  });

  folders.forEach((row) => {
    items.push({
      label: row.name,
      relPath: row.relPath,
      depth: currentParts.length + 1,
      kind: 'child',
    });
  });

  items.forEach((item, index) => {
    const li = document.createElement('li');
    li.className = `folder-item folder-item--${item.kind}`;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'folder-btn';
    if (item.relPath === normalizePrefix(currentPrefix)) btn.classList.add('active');
    btn.style.setProperty('--tree-indent', `${(item.depth - 1) * 14}px`);

    const prefix = document.createElement('span');
    prefix.className = 'tree-prefix';
    const isLast = index === items.length - 1;
    prefix.textContent = isLast ? '└─' : '├─';

    const icon = document.createElement('span');
    icon.className = 'tree-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.appendChild(createFileTypeIconEl('folder', ''));

    const label = document.createElement('span');
    label.className = 'tree-label';
    label.textContent = item.label;

    btn.appendChild(prefix);
    btn.appendChild(icon);
    btn.appendChild(label);
    btn.addEventListener('click', () => {
      currentPrefix = item.relPath;
      selectedPaths.clear();
      refreshFileList();
    });
    li.appendChild(btn);
    folderListEl.appendChild(li);
  });
}

function buildRows(listing, files) {
  const fileRows = files
    .filter(({ metadata }) => metadata?.name !== '.keep' && metadata?.name !== '.tags.json')
    .map(({ itemRef, metadata, url }) => ({
      kind: 'file',
      name: metadata?.name || itemRef.name,
      fullPath: itemRef.fullPath,
      relPath: itemRef.fullPath.replace(`${rootPrefix(currentUser.uid)}/`, ''),
      size: Number(metadata?.size || 0),
      timeCreated: String(metadata?.timeCreated || ''),
      url,
      tags: tagsFromMetadata(metadata),
    }));

  return fileRows;
}

async function resolveFolderRows(prefixes) {
  return Promise.all(
    prefixes.map(async (folderRef) => {
      let totalSize = 0;
      let latestTime = '';
      let tags = [];
      try {
        const stats = await resolveFolderStats(folderRef);
        totalSize = stats.totalSize;
        latestTime = stats.latestTime;
        tags = stats.tags || [];
      } catch {
        /* ignore */
      }

      return {
        kind: 'folder',
        name: folderRef.name,
        fullPath: folderRef.fullPath,
        relPath: childFolderPrefix(folderRef.name),
        size: totalSize,
        timeCreated: latestTime,
        url: '',
        tags,
      };
    })
  );
}

function filterAndSortRows(rows) {
  const q = String(searchEl?.value || '').trim().toLowerCase();
  const selectedType = String(typeFilterEl?.value || 'all').trim().toLowerCase();
  let filtered = rows;
  if (q) {
    filtered = rows.filter((row) => {
      const tags = getRowTags(row).join(' ').toLowerCase();
      return row.name.toLowerCase().includes(q) || tags.includes(q);
    });
  }
  if (selectedType && selectedType !== 'all') {
    filtered = filtered.filter((row) => fileTypeKey(row) === selectedType);
  }

  const sort = String(currentSort || 'date-desc');
  const sorted = filtered.slice().sort((a, b) => {
    if (sort === 'name-asc') return a.name.localeCompare(b.name);
    if (sort === 'name-desc') return b.name.localeCompare(a.name);
    if (sort === 'type-asc') return fileTypeKey(a).localeCompare(fileTypeKey(b)) || a.name.localeCompare(b.name);
    if (sort === 'type-desc') return fileTypeKey(b).localeCompare(fileTypeKey(a)) || a.name.localeCompare(b.name);
    if (sort === 'size-asc') return a.size - b.size || a.name.localeCompare(b.name);
    if (sort === 'size-desc') return b.size - a.size || a.name.localeCompare(b.name);
    if (sort === 'date-asc') return a.timeCreated.localeCompare(b.timeCreated) || a.name.localeCompare(b.name);
    return b.timeCreated.localeCompare(a.timeCreated) || a.name.localeCompare(b.name);
  });

  return sorted;
}

function updateSelectionBar() {
  const count = selectedPaths.size;
  if (!selectionBarEl) return;
  if (selectionTimerId) {
    window.clearTimeout(selectionTimerId);
    selectionTimerId = null;
  }
  if (!count) {
    selectionBarEl.textContent = '';
    selectionBarEl.classList.remove('is-visible');
  } else {
    selectionBarEl.textContent = `${count} selected`;
    selectionBarEl.classList.add('is-visible');
    selectionTimerId = window.setTimeout(() => {
      selectionBarEl.textContent = '';
      selectionBarEl.classList.remove('is-visible');
      selectionTimerId = null;
    }, SELECTION_TOAST_MS);
  }
  deleteSelectedBtn.hidden = count === 0;
  deleteSelectedBtn.disabled = count === 0;
}

function toggleSelection(path, checked) {
  if (checked) selectedPaths.add(path);
  else selectedPaths.delete(path);
  updateSelectionBar();
}

function renderEmptyDropzoneHint() {
  fileListEl.replaceChildren();
  const li = document.createElement('li');
  li.className = 'empty empty-dropzone';
  const hint = document.createElement('div');
  hint.className = 'empty-dropzone__hint';
  hint.textContent = 'No files or folders in this view. Drag files here to upload.';
  li.appendChild(hint);
  fileListEl.appendChild(li);
}

function renderRows(rows) {
  if (!rows.length) {
    renderEmptyDropzoneHint();
    return;
  }
  fileListEl.replaceChildren();

  rows.forEach((row) => {
    const li = document.createElement('li');
    li.className = 'file-row';

    const box = document.createElement('input');
    box.type = 'checkbox';
    box.checked = selectedPaths.has(row.fullPath);
    box.addEventListener('change', () => toggleSelection(row.fullPath, box.checked));
    const checkWrap = document.createElement('div');
    checkWrap.className = 'cell-check';
    checkWrap.appendChild(box);

    const nameWrap = document.createElement('div');
    nameWrap.className = 'file-name';
    const titleLine = document.createElement('div');
    titleLine.className = 'file-name-main';
    const icon = document.createElement('span');
    icon.className = 'icon';
    icon.appendChild(createFileTypeIconEl(row.kind, row.name));
    titleLine.appendChild(icon);

    if (row.kind === 'folder') {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'crumb';
      btn.textContent = row.name;
      btn.addEventListener('click', () => {
        currentPrefix = row.relPath;
        selectedPaths.clear();
        refreshFileList();
      });
      titleLine.appendChild(btn);
    } else {
      const a = document.createElement('a');
      a.className = 'file-link';
      a.rel = 'noopener noreferrer';
      a.target = '_blank';
      a.textContent = row.name;
      const urlReady = String(row.url || '').trim();
      if (urlReady) {
        a.href = urlReady;
      } else {
        a.href = '#';
        a.addEventListener('click', async (e) => {
          e.preventDefault();
          try {
            const u = await ensureFileRowUrl(row);
            if (!u) return;
            window.open(u, '_blank', 'noopener,noreferrer');
          } catch (err) {
            setStatus(err?.message || 'Could not open file.', true);
          }
        });
      }
      titleLine.appendChild(a);
    }
    nameWrap.appendChild(titleLine);

    const rowTags = getRowTags(row);
    if (rowTags.length) {
      const tagsWrap = document.createElement('div');
      tagsWrap.className = 'row-tags';
      rowTags.forEach((tag) => {
        const chip = document.createElement('span');
        chip.className = 'tag-chip';
        chip.textContent = tag;
        tagsWrap.appendChild(chip);
      });
      nameWrap.appendChild(tagsWrap);
    }

    const pathMeta = document.createElement('div');
    pathMeta.className = 'file-meta cell-path';
    pathMeta.textContent = fileTypeLabel(row);

    const dateMeta = document.createElement('div');
    dateMeta.className = 'file-meta cell-date';
    dateMeta.textContent = fileDateLabel(row.timeCreated);

    const sizeMeta = document.createElement('div');
    sizeMeta.className = 'file-meta cell-size';
    sizeMeta.textContent = Number(row.size || 0) > 0 ? readableBytes(row.size) : '--';

    const actions = document.createElement('div');
    actions.className = 'row-actions';

    const menuBtn = document.createElement('button');
    menuBtn.type = 'button';
    menuBtn.className = 'row-menu-btn';
    menuBtn.setAttribute('aria-haspopup', 'menu');
    menuBtn.setAttribute('aria-expanded', 'false');
    menuBtn.setAttribute('aria-label', `Open actions for ${row.name}`);
    menuBtn.textContent = '⋮';

    const menu = document.createElement('div');
    menu.className = 'row-menu';
    menu.setAttribute('role', 'menu');
    menu.hidden = true;

    const renameItem = document.createElement('button');
    renameItem.type = 'button';
    renameItem.className = 'row-menu-item';
    renameItem.textContent = 'Rename';
    renameItem.addEventListener('click', async () => {
      menu.hidden = true;
      menuBtn.setAttribute('aria-expanded', 'false');
      await renameRow(row);
    });

    const tagsItem = document.createElement('button');
    tagsItem.type = 'button';
    tagsItem.className = 'row-menu-item';
    tagsItem.textContent = 'Edit hashtags';
    tagsItem.addEventListener('click', async () => {
      menu.hidden = true;
      menuBtn.setAttribute('aria-expanded', 'false');
      await editRowTags(row);
    });

    const closeMenu = () => {
      menu.hidden = true;
      menuBtn.setAttribute('aria-expanded', 'false');
      actions.classList.remove('menu-open');
      document.removeEventListener('click', handleOutsideClick, true);
    };

    const handleOutsideClick = (event) => {
      if (!actions.contains(event.target)) closeMenu();
    };

    menuBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      const willOpen = menu.hidden;
      document.querySelectorAll('.row-menu').forEach((node) => {
        node.hidden = true;
      });
      document.querySelectorAll('.row-menu-btn[aria-expanded="true"]').forEach((node) => {
        node.setAttribute('aria-expanded', 'false');
      });
      document.querySelectorAll('.row-actions.menu-open').forEach((node) => {
        node.classList.remove('menu-open');
      });
      menu.hidden = !willOpen;
      menuBtn.setAttribute('aria-expanded', String(willOpen));
      if (willOpen) {
        actions.classList.add('menu-open');
        document.addEventListener('click', handleOutsideClick, true);
      } else {
        actions.classList.remove('menu-open');
        document.removeEventListener('click', handleOutsideClick, true);
      }
    });

    if (RENAME_ENABLED) menu.appendChild(renameItem);
    menu.appendChild(tagsItem);

    if (row.kind === 'folder') {
      const downloadFolderItem = document.createElement('button');
      downloadFolderItem.type = 'button';
      downloadFolderItem.className = 'row-menu-item';
      downloadFolderItem.textContent = 'Download';
      downloadFolderItem.addEventListener('click', async () => {
        menu.hidden = true;
        menuBtn.setAttribute('aria-expanded', 'false');
        await downloadFolder(row);
      });

      const deleteFolderItem = document.createElement('button');
      deleteFolderItem.type = 'button';
      deleteFolderItem.className = 'row-menu-item danger';
      deleteFolderItem.textContent = 'Delete';
      deleteFolderItem.addEventListener('click', () => {
        menu.hidden = true;
        menuBtn.setAttribute('aria-expanded', 'false');
        removePath(row);
      });

      menu.appendChild(downloadFolderItem);
      menu.appendChild(deleteFolderItem);
    }

    if (row.kind === 'file') {
      const copyShortLinkItem = document.createElement('button');
      copyShortLinkItem.type = 'button';
      copyShortLinkItem.className = 'row-menu-item';
      copyShortLinkItem.textContent = 'Copy link';
      copyShortLinkItem.addEventListener('click', async () => {
        menu.hidden = true;
        menuBtn.setAttribute('aria-expanded', 'false');
        await copyShortLink(row);
      });

      const downloadItem = document.createElement('button');
      downloadItem.type = 'button';
      downloadItem.className = 'row-menu-item';
      downloadItem.textContent = 'Download';
      downloadItem.addEventListener('click', async () => {
        menu.hidden = true;
        menuBtn.setAttribute('aria-expanded', 'false');
        try {
          const u = await ensureFileRowUrl(row);
          triggerBrowserDownload(u, row.name);
          setStatus(`Started download for "${row.name}".`);
        } catch (err) {
          setStatus(err?.message || 'Download failed.', true);
        }
      });

      const previewItem = document.createElement('button');
      previewItem.type = 'button';
      previewItem.className = 'row-menu-item';
      previewItem.textContent = 'Preview';
      previewItem.addEventListener('click', () => {
        menu.hidden = true;
        menuBtn.setAttribute('aria-expanded', 'false');
        void showPreview(row);
      });

      const deleteItem = document.createElement('button');
      deleteItem.type = 'button';
      deleteItem.className = 'row-menu-item danger';
      deleteItem.textContent = 'Delete';
      deleteItem.addEventListener('click', () => {
        menu.hidden = true;
        menuBtn.setAttribute('aria-expanded', 'false');
        removePath(row);
      });

      menu.appendChild(copyShortLinkItem);
      menu.appendChild(downloadItem);
      menu.appendChild(previewItem);
      menu.appendChild(deleteItem);
    }

    actions.appendChild(menuBtn);
    actions.appendChild(menu);

    li.appendChild(checkWrap);
    li.appendChild(nameWrap);
    li.appendChild(pathMeta);
    li.appendChild(dateMeta);
    li.appendChild(sizeMeta);
    li.appendChild(actions);
    fileListEl.appendChild(li);
  });
}

async function removePath(row) {
  try {
    if (row.kind === 'folder') {
      const nested = await listAll(ref(storage, row.fullPath));
      if (!isEffectivelyEmptyFolderListing(nested)) {
        const allowDeepDelete = await requestConfirmDeleteFolder(row.name);
        if (!allowDeepDelete) {
          setStatus('Delete canceled.');
          return;
        }
        showLoading('Deleting...');
        await deleteFolderTree(row.fullPath);
      } else {
        showLoading('Deleting...');
        const keepItem = (nested.items || []).find((itemRef) => itemRef.name === '.keep');
        if (keepItem) {
          await deleteObject(keepItem);
        }
      }
    } else {
      showLoading('Deleting...');
      await deleteObject(ref(storage, row.fullPath));
    }
    selectedPaths.delete(row.fullPath);
    setStatus('Deleted.');
    clearFolderCache();
    await refreshFileList();
  } catch (err) {
    const reason = err?.message || 'Delete failed.';
    setStatus(`Could not delete "${row.name}": ${reason}`, true);
  } finally {
    hideLoading();
  }
}

async function deleteSelected() {
  if (!selectedPaths.size) return;
  const toDelete = currentRows.filter((r) => selectedPaths.has(r.fullPath));
  if (!toDelete.length) return;
  const bulkOk = await requestConfirm({
    title: 'Delete selected items',
    message: `You are about to delete ${toDelete.length} selected item(s). This cannot be undone.`,
    confirmLabel: 'Delete',
    cancelLabel: 'Cancel',
    danger: true,
  });
  if (!bulkOk) return;

  showLoading('Deleting selected items...');
  try {
    let deletedCount = 0;
    const failedMessages = [];
    let canceledCount = 0;

    for (const row of toDelete) {
      try {
        if (row.kind === 'folder') {
          const nested = await listAll(ref(storage, row.fullPath));
          if (!isEffectivelyEmptyFolderListing(nested)) {
            const allowDeepDelete = await requestConfirmDeleteFolder(row.name);
            if (!allowDeepDelete) {
              canceledCount += 1;
              continue;
            }
            await deleteFolderTree(row.fullPath);
          } else {
            const keepItem = (nested.items || []).find((itemRef) => itemRef.name === '.keep');
            if (keepItem) {
              await deleteObject(keepItem);
            }
          }
          deletedCount += 1;
          continue;
        }
        await deleteObject(ref(storage, row.fullPath));
        deletedCount += 1;
      } catch (err) {
        failedMessages.push(`${row.name}: ${err?.message || 'Delete failed.'}`);
      }
    }

    if (!failedMessages.length && canceledCount === 0) {
      setStatus(`Deleted ${deletedCount} item(s).`);
    } else if (deletedCount === 0 && canceledCount > 0 && failedMessages.length === 0) {
      setStatus(`Delete canceled for ${canceledCount} item(s).`);
    } else if (deletedCount === 0) {
      const preview = failedMessages.slice(0, 2).join(' | ');
      setStatus(`Delete failed. ${preview}`, true);
    } else {
      const preview = failedMessages.slice(0, 2).join(' | ');
      if (failedMessages.length && canceledCount) {
        setStatus(
          `Deleted ${deletedCount} item(s), ${failedMessages.length} failed, ${canceledCount} canceled. ${preview}`,
          true
        );
      } else if (failedMessages.length) {
        setStatus(`Deleted ${deletedCount} item(s), but ${failedMessages.length} failed. ${preview}`, true);
      } else {
        setStatus(`Deleted ${deletedCount} item(s), ${canceledCount} canceled.`);
      }
    }

    selectedPaths.clear();
    if (deletedCount > 0) clearFolderCache();
    await refreshFileList();
  } finally {
    hideLoading();
  }
}

async function refreshFileList({ forceLive = false } = {}) {
  if (!currentUser) return;
  const folderPath = currentFolderPath();
  const cachedEntry = getFolderCacheEntry(folderPath);
  const cachedRows = cachedEntry?.rows || null;
  let overlayShown = false;
  renderBreadcrumbs();
  if (cachedRows) {
    currentRows = cachedRows;
    setSyncState(cachedEntry.fetchedAt, 'cache');
    populateTypeFilterOptions(currentRows);
    renderFolderSidebar(currentRows);
    renderRows(filterAndSortRows(currentRows));
    updateSelectionBar();
    if (!forceLive) return;
  } else {
    renderEmptyDropzoneHint();
    showLoading('Loading files and folders...');
    overlayShown = true;
  }
  try {
    const listing = await listAll(ref(storage, folderPath));
    const files = await Promise.all(
      listing.items.map(async (itemRef) => {
        const metadata = await getMetadata(itemRef);
        return { itemRef, metadata, url: '' };
      })
    );
    const folderRows = await resolveFolderRows(listing.prefixes);
    currentRows = [...folderRows, ...buildRows(listing, files)];
    const syncedAt = Date.now();
    setFolderCacheRows(folderPath, currentRows, syncedAt);
    setSyncState(syncedAt, 'live');
    populateTypeFilterOptions(currentRows);
    renderFolderSidebar(currentRows);
    renderRows(filterAndSortRows(currentRows));
    updateSelectionBar();
  } catch (err) {
    if (!cachedRows) {
      setStatus(err?.message || 'Could not load current folder.', true);
    } else {
      setStatus('Showing cached items. Could not refresh from storage.', true);
    }
  } finally {
    if (overlayShown) hideLoading();
  }
}

async function uploadQueuedFiles() {
  if (!currentUser) return;
  const files = queuedFiles.slice();
  if (!files.length) {
    setStatus('Select file(s) or folder first.', true);
    syncUploadButtonVisibility();
    return;
  }
  if (pendingUploadBtn) pendingUploadBtn.disabled = true;
  showLoading('Uploading...');
  setStatus(`Uploading ${files.length} file(s)...`);
  try {
    const base = currentFolderPath();
    const reservedPaths = new Set();
    for (const file of files) {
      const relativeRaw = normalizeUploadRelativePath(file.webkitRelativePath || '');
      let desiredTarget = '';
      if (relativeRaw) {
        const relativeWithoutRoot = dropFirstPathSegment(relativeRaw) || safeName(file.name);
        const safeRelative = relativeWithoutRoot
          .split('/')
          .map((segment) => safeName(segment))
          .filter(Boolean)
          .join('/');
        desiredTarget = `${base}/${safeRelative || safeName(file.name)}`;
      } else {
        desiredTarget = `${base}/${safeName(file.name)}`;
      }

      const target = await resolveUniqueTargetPath(desiredTarget, reservedPaths);
      await uploadBytes(ref(storage, target), file, {
        contentType: file.type || 'application/octet-stream',
      });
    }
    queuedFiles = [];
    if (folderInputEl) folderInputEl.value = '';
    closePendingModal();
    syncUploadButtonVisibility();
    setStatus('Upload complete.');
    clearFolderCache();
    await refreshFileList({ forceLive: true });
  } catch (err) {
    setStatus(err?.message || 'Upload failed.', true);
  } finally {
    hideLoading();
    if (pendingUploadBtn) pendingUploadBtn.disabled = false;
  }
}

async function createFolder() {
  if (!currentUser) return;
  const name = await requestTextInput({
    title: 'Create folder',
    hint: 'Enter a folder name.',
    value: '',
    placeholder: 'Folder name',
    submitLabel: 'Create',
  });
  if (name == null) return;
  const clean = safeName(name || '');
  if (!clean) return;
  try {
    showLoading('Creating folder...');
    const path = `${currentFolderPath()}/${clean}/.keep`;
    await uploadBytes(ref(storage, path), new Blob(['keep']));
    setStatus(`Folder "${clean}" created.`);
    clearFolderCache();
    await refreshFileList();
  } catch (err) {
    setStatus(err?.message || 'Could not create folder.', true);
  } finally {
    hideLoading();
  }
}

function bindDropzone() {
  const targets = [dropzoneEl, fileListEl].filter(Boolean);
  if (!targets.length) return;
  const prevent = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach((evt) => {
    targets.forEach((target) => target.addEventListener(evt, prevent));
  });

  ['dragenter', 'dragover'].forEach((evt) => {
    targets.forEach((target) =>
      target.addEventListener(evt, () => target.classList.add('drag-over'))
    );
  });
  ['dragleave', 'drop'].forEach((evt) => {
    targets.forEach((target) =>
      target.addEventListener(evt, () => target.classList.remove('drag-over'))
    );
  });

  targets.forEach((target) => {
    target.addEventListener('drop', (e) => {
      const files = Array.from(e.dataTransfer?.files || []);
      if (!files.length) return;
      queueFilesForUpload(files);
    });
  });
}

function bindUiEvents() {
  updateSortButtons();
  sortButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const field = String(btn.dataset.sortField || '');
      if (!field) return;
      const active = parseSortState(currentSort);
      const nextDir = field === active.field ? (active.dir === 'asc' ? 'desc' : 'asc') : defaultSortDir(field);
      setSort(`${field}-${nextDir}`);
    });
  });

  folderHomeBtn?.addEventListener('click', () => {
    currentPrefix = '';
    selectedPaths.clear();
    refreshFileList();
  });

  signOutBtn?.addEventListener('click', async () => {
    try {
      clearFolderCache();
      await signOut(auth);
      window.location.replace('/login/');
    } catch (err) {
      setStatus(err?.message || 'Sign out failed.', true);
    }
  });

  pendingUploadBtn?.addEventListener('click', uploadQueuedFiles);
  pendingClearBtn?.addEventListener('click', clearPendingFiles);
  pendingCloseBtn?.addEventListener('click', closePendingModal);
  filePickBtn?.addEventListener('click', handleFilePickClick);
  refreshBtn?.addEventListener('click', () => refreshFileList({ forceLive: true }));
  newFolderBtn?.addEventListener('click', createFolder);
  sidebarNewFolderBtn?.addEventListener('click', createFolder);
  deleteSelectedBtn?.addEventListener('click', deleteSelected);
  folderInputEl?.addEventListener('change', () => {
    const files = Array.from(folderInputEl.files || []);
    if (!files.length) return;
    folderInputEl.value = '';
    queueFilesForUpload(files);
  });
  searchEl?.addEventListener('input', () => renderRows(filterAndSortRows(currentRows)));
  typeFilterEl?.addEventListener('change', () => renderRows(filterAndSortRows(currentRows)));

  previewCloseBtn?.addEventListener('click', closePreview);
  previewModal?.addEventListener('click', (e) => {
    if (e.target === previewModal) closePreview();
  });
  pendingModal?.addEventListener('click', (e) => {
    if (e.target === pendingModal) closePendingModal();
  });
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !previewModal.hidden) closePreview();
    if (e.key === 'Escape' && pendingModal && !pendingModal.hidden) closePendingModal();
  });

  bindDropzone();
  initSidebarResize();
  syncUploadButtonVisibility();
  updateSelectionBar();
}

function initAuthGuard() {
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      clearFolderCache();
      activeCacheUid = '';
      window.location.replace(loginRedirectUrl());
      return;
    }
    if (user.uid !== OWNER_UID) {
      setStatus('This Dropbox is private to the owner account.', true);
      signOut(auth).finally(() => {
        window.location.replace('/login/');
      });
      return;
    }
    currentUser = user;
    if (activeCacheUid !== user.uid) hydrateFolderCache(user.uid);
    setStatus('');
    await handleShortDownloadFromQuery();
    refreshFileList();
  });
}

bindUiEvents();
initAuthGuard();
