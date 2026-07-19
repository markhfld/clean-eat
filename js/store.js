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
  labs: 'ce.labs', // merged blood-lab markers + upload history
};

// Missing/invalid dates sort as oldest so a dated value always beats an undated one.
function labTime(d) {
  if (!d) return -Infinity;
  const t = Date.parse(d);
  return isNaN(t) ? -Infinity : t;
}

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
};
