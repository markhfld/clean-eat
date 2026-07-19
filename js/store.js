// store.js — all persisted state lives in the browser's localStorage.
// Nothing (API key, profile, history) ever leaves this device except the
// scan/plan requests you explicitly send to the Anthropic API.

import { DEFAULT_PROFILE } from './data.js';

const KEYS = {
  apiKey: 'ce.apiKey',
  profile: 'ce.profile',
  mode: 'ce.mode', // 'flare' | 'remission'
  scans: 'ce.scans', // recent scan history
  supps: 'ce.supps', // saved supplement stack
};

function read(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v == null ? fallback : JSON.parse(v);
  } catch {
    return fallback;
  }
}
function write(key, val) {
  localStorage.setItem(key, JSON.stringify(val));
}

export const store = {
  getApiKey: () => read(KEYS.apiKey, ''),
  setApiKey: (v) => write(KEYS.apiKey, v.trim()),

  getProfile() {
    const saved = read(KEYS.profile, null);
    // Merge so new default fields appear even for older saved profiles.
    return saved ? { ...DEFAULT_PROFILE, ...saved, targets: { ...DEFAULT_PROFILE.targets, ...(saved.targets || {}) } } : { ...DEFAULT_PROFILE };
  },
  setProfile: (p) => write(KEYS.profile, p),

  getMode: () => read(KEYS.mode, 'remission'),
  setMode: (m) => write(KEYS.mode, m),

  getScans: () => read(KEYS.scans, []),
  addScan(entry) {
    const list = read(KEYS.scans, []);
    list.unshift(entry);
    write(KEYS.scans, list.slice(0, 15)); // keep last 15
  },
  clearScans: () => write(KEYS.scans, []),

  getSupps: () => read(KEYS.supps, []),
  addSupp(entry) {
    const list = read(KEYS.supps, []);
    list.unshift({ id: Date.now() + '', ...entry });
    write(KEYS.supps, list);
  },
  removeSupp(id) {
    write(KEYS.supps, read(KEYS.supps, []).filter((s) => s.id !== id));
  },
};
