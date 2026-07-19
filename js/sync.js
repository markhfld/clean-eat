// sync.js — optional cross-device sync via a private GitHub gist.
// Serverless: GitHub is the store. Data is end-to-end encrypted with a passphrase
// (AES-GCM) before it leaves the device, so GitHub only sees ciphertext.

import { store } from './store.js';

const API = 'https://api.github.com';
const FILE = 'clean-eat.json';

let rerender = () => {};
let pushTimer = null;

export function initSync(rerenderFn) {
  rerender = rerenderFn || (() => {});
  // Any change to synced data bumps the local clock and schedules a debounced push.
  store.onChange(() => {
    if (!syncConfigured()) return;
    store.setSyncMeta({ updatedAt: Date.now() });
    schedulePush();
  });
}

function schedulePush() {
  clearTimeout(pushTimer);
  pushTimer = setTimeout(() => { push().catch(() => {}); }, 1500);
}

// ---- base64 <-> bytes ----
function b64(u8) { let s = ''; u8.forEach((b) => (s += String.fromCharCode(b))); return btoa(s); }
function ub64(str) { const bin = atob(str); const u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i); return u8; }

// ---- AES-GCM with a PBKDF2-derived key ----
async function deriveKey(pass, salt) {
  const km = await crypto.subtle.importKey('raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    km, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']
  );
}
async function encryptBundle(obj, pass) {
  if (!pass) return JSON.stringify(obj); // plaintext (gist is still private)
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(pass, salt);
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(JSON.stringify(obj)));
  return JSON.stringify({ enc: 'v1', salt: b64(salt), iv: b64(iv), ct: b64(new Uint8Array(ct)) });
}
async function decryptBundle(str, pass) {
  let o;
  try { o = JSON.parse(str); } catch { throw new Error('Sync data is corrupt.'); }
  if (!o || o.enc !== 'v1') return o; // plaintext bundle
  if (!pass) throw new Error('This sync data is encrypted — enter the same passphrase you used on the other device.');
  try {
    const key = await deriveKey(pass, ub64(o.salt));
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: ub64(o.iv) }, key, ub64(o.ct));
    return JSON.parse(new TextDecoder().decode(pt));
  } catch {
    throw new Error('Wrong passphrase (could not decrypt the synced data).');
  }
}

// ---- GitHub gist API ----
async function gh(path, opts = {}) {
  const cfg = store.getSyncCfg();
  if (!cfg.token) throw new Error('Add a GitHub token first.');
  const res = await fetch(API + path, {
    ...opts,
    headers: {
      Authorization: 'Bearer ' + cfg.token,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
  });
  if (!res.ok) {
    let msg = 'GitHub error ' + res.status;
    try { const j = await res.json(); if (j.message) msg = j.message; } catch { /* ignore */ }
    if (res.status === 401) msg = 'Invalid GitHub token — it needs the "gist" scope.';
    if (res.status === 404) msg = 'Sync gist not found — check the Sync ID.';
    throw new Error(msg);
  }
  return res.json();
}

function makeBundle() {
  const m = store.getSyncMeta();
  return { app: 'clean-eat', updatedAt: m.updatedAt || Date.now(), data: store.exportBundle() };
}

export function syncConfigured() {
  const c = store.getSyncCfg();
  return !!(c.gistId && c.token);
}

// Create a new private gist seeded with this device's data. Returns the Sync ID.
export async function setupSync() {
  const bundle = makeBundle();
  const content = await encryptBundle(bundle, store.getSyncCfg().passphrase);
  const g = await gh('/gists', {
    method: 'POST',
    body: JSON.stringify({ description: 'Clean Eat sync (private, encrypted)', public: false, files: { [FILE]: { content } } }),
  });
  store.setSyncCfg({ ...store.getSyncCfg(), gistId: g.id });
  store.setSyncMeta({ updatedAt: bundle.updatedAt });
  return g.id;
}

export async function push() {
  const cfg = store.getSyncCfg();
  if (!cfg.gistId) return;
  const content = await encryptBundle(makeBundle(), cfg.passphrase);
  await gh('/gists/' + cfg.gistId, { method: 'PATCH', body: JSON.stringify({ files: { [FILE]: { content } } }) });
}

export async function pull() {
  const cfg = store.getSyncCfg();
  if (!cfg.gistId || !cfg.token) return { applied: false };
  const g = await gh('/gists/' + cfg.gistId, { method: 'GET' });
  const f = g.files && g.files[FILE];
  if (!f) return { applied: false };
  let content = f.content;
  if (f.truncated && f.raw_url) content = await (await fetch(f.raw_url)).text(); // large gists
  if (!content) return { applied: false };
  const remote = await decryptBundle(content, cfg.passphrase);
  const local = store.getSyncMeta();
  // Union collections + newest-wins scalars. Collections merge regardless of timestamp,
  // so data unique to either device is never lost.
  const changed = store.mergeRemote(remote.data, remote.updatedAt || 0, local.updatedAt || 0);
  if (changed) { store.setSyncMeta({ updatedAt: Date.now() }); rerender(); }
  return { applied: changed };
}

// Full sync: merge in the remote, then push the merged result back so both ends converge.
export async function syncNow() {
  const r = await pull();
  await push();
  return r;
}

