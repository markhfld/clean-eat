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
  suppReco: 'ce.suppReco', // last personalised supplement recommendation
  labs: 'ce.labs', // merged blood-lab markers + upload history
};

// Missing/invalid dates sort as oldest so a dated value always beats an undated one.
function labTime(d) {
  if (!d) return -Infinity;
  const t = Date.parse(d);
  return isNaN(t) ? -Infinity : t;
}

// ---- merge helpers for cross-device sync (union collections, keep newest) ----
function mergeLabs(a, b) {
  a = a || { markers: {}, uploads: [] };
  b = b || { markers: {}, uploads: [] };
  const markers = { ...(a.markers || {}) };
  for (const [k, m] of Object.entries(b.markers || {})) {
    const prev = markers[k];
    const newer = !prev
      || labTime(m.date) > labTime(prev.date)
      || (labTime(m.date) === labTime(prev.date) && (m.at || 0) >= (prev.at || 0));
    if (newer) markers[k] = m;
  }
  const uploads = [...(a.uploads || [])];
  const seen = new Set(uploads.map((u) => u.at));
  for (const u of (b.uploads || [])) if (!seen.has(u.at)) uploads.push(u);
  uploads.sort((x, y) => (y.at || 0) - (x.at || 0));
  return { markers, uploads: uploads.slice(0, 12) };
}
function mergeById(a, b) {
  const map = new Map();
  for (const x of (a || [])) map.set(x.id, x);
  for (const y of (b || [])) {
    const ex = map.get(y.id);
    if (!ex || (y.at || 0) > (ex.at || 0)) map.set(y.id, y);
  }
  return [...map.values()].sort((x, y) => (y.at || 0) - (x.at || 0));
}
function mergeByKey(a, b, keyOf, limit) {
  const map = new Map();
  for (const x of [...(a || []), ...(b || [])]) map.set(keyOf(x), x);
  const out = [...map.values()].sort((x, y) => (y.at || 0) - (x.at || 0));
  return limit ? out.slice(0, limit) : out;
}

// Keys whose changes should sync across devices (excludes sync config/meta + nothing local-only).
const SYNCED = [KEYS.apiKey, KEYS.profile, KEYS.mode, KEYS.scans, KEYS.supps, KEYS.suppReco, KEYS.labs];
let changeHook = null;
let suspend = false; // true while applying a remote bundle, so we don't echo a push

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
  if (!suspend && changeHook && SYNCED.includes(key)) changeHook(key);
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
  updateSupp(id, patch) {
    const list = read(KEYS.supps, []).map((s) => (s.id === id ? { ...s, ...patch } : s));
    write(KEYS.supps, list);
  },
  removeSupp(id) {
    write(KEYS.supps, read(KEYS.supps, []).filter((s) => s.id !== id));
  },
  getSuppReco: () => read(KEYS.suppReco, null),
  setSuppReco: (reco) => write(KEYS.suppReco, reco),

  // Blood labs: { markers: { key: {name,value,unit,reference_range,flag,category,date,at} }, uploads: [] }
  getLabs: () => read(KEYS.labs, { markers: {}, uploads: [] }),
  getLabMarkers() {
    return Object.values(read(KEYS.labs, { markers: {}, uploads: [] }).markers);
  },
  // Merge an extraction: keep the most RECENT value per marker (by date, then upload time).
  mergeLabResult(extraction, filename) {
    const labs = read(KEYS.labs, { markers: {}, uploads: [] });
    const uploadAt = Date.now();
    const reportDate = extraction.lab_date || '';
    let added = 0, updated = 0, kept = 0;

    for (const m of extraction.markers || []) {
      const key = (m.name || '').trim().toLowerCase();
      if (!key) continue;
      const eff = m.date || reportDate || '';
      const prev = labs.markers[key];
      const isNewer = !prev
        || labTime(eff) > labTime(prev.date)
        || (labTime(eff) === labTime(prev.date) && uploadAt >= (prev.at || 0));
      if (isNewer) {
        if (prev) updated++; else added++;
        labs.markers[key] = {
          name: m.name, value: m.value, unit: m.unit,
          reference_range: m.reference_range, flag: m.flag,
          category: m.category, date: eff, at: uploadAt,
        };
      } else {
        kept++;
      }
    }

    labs.uploads.unshift({
      at: uploadAt, lab_date: reportDate, filename: filename || '',
      summary: extraction.summary || '', count: (extraction.markers || []).length,
      added, updated, kept,
    });
    labs.uploads = labs.uploads.slice(0, 12);
    write(KEYS.labs, labs);
    return { added, updated, kept };
  },
  clearLabs: () => write(KEYS.labs, { markers: {}, uploads: [] }),

  // ---- sync plumbing ----
  onChange(cb) { changeHook = cb; },
  exportBundle() {
    const d = {};
    for (const k of SYNCED) {
      const v = localStorage.getItem(k);
      if (v != null) { try { d[k] = JSON.parse(v); } catch { /* skip */ } }
    }
    return d;
  },
  importBundle(data) {
    suspend = true;
    try {
      for (const [k, v] of Object.entries(data || {})) {
        if (SYNCED.includes(k)) localStorage.setItem(k, JSON.stringify(v));
      }
    } finally { suspend = false; }
  },
  // Merge a remote bundle into local. Collections are UNIONed (never lost);
  // scalars (profile/mode/apiKey/reco) take the remote value only if it's newer.
  // Returns true if anything changed locally.
  mergeRemote(data, remoteAt, localAt) {
    if (!data) return false;
    suspend = true;
    let changed = false;
    const setIfDiff = (key, valObj) => {
      const next = JSON.stringify(valObj);
      if (localStorage.getItem(key) !== next) { localStorage.setItem(key, next); changed = true; }
    };
    try {
      if (KEYS.labs in data) setIfDiff(KEYS.labs, mergeLabs(read(KEYS.labs, { markers: {}, uploads: [] }), data[KEYS.labs]));
      if (KEYS.supps in data) setIfDiff(KEYS.supps, mergeById(read(KEYS.supps, []), data[KEYS.supps]));
      if (KEYS.scans in data) setIfDiff(KEYS.scans, mergeByKey(read(KEYS.scans, []), data[KEYS.scans], (s) => (s.at || 0) + '|' + (s.product_name || ''), 15));
      // Scalars: last-write-wins by bundle timestamp.
      if ((remoteAt || 0) > (localAt || 0)) {
        for (const k of [KEYS.apiKey, KEYS.profile, KEYS.mode, KEYS.suppReco]) {
          if (k in data) setIfDiff(k, data[k]);
        }
      }
    } finally { suspend = false; }
    return changed;
  },
  // Sync config (token/gistId/passphrase) and clock are LOCAL only — never synced.
  getSyncCfg: () => read('ce.sync', {}),
  setSyncCfg: (c) => localStorage.setItem('ce.sync', JSON.stringify(c || {})),
  getSyncMeta: () => read('ce.syncMeta', { updatedAt: 0 }),
  setSyncMeta: (m) => localStorage.setItem('ce.syncMeta', JSON.stringify(m || { updatedAt: 0 })),
};
