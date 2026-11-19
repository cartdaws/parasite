// localStorage persistence: unlocks, best run, settings.
const KEY = 'finding-of-isaiah-save-v1';
const DEFAULTS = {
  unlocks: { june: false },
  best: { floor: 0, wins: 0, runs: 0, deaths: 0 },
  settings: { master: 0.8, sfx: 0.9, music: 0.5, mute: false, shake: 1, showIntro: true },
  seenIntro: false,
};
function merge(a, b) {
  const out = Array.isArray(a) ? [...a] : { ...a };
  for (const k in b) {
    if (b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]) && a[k] && typeof a[k] === 'object') out[k] = merge(a[k], b[k]);
    else out[k] = b[k];
  }
  return out;
}
export const save = {
  data: structuredClone(DEFAULTS),
  load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) this.data = merge(DEFAULTS, JSON.parse(raw));
    } catch { /* private mode etc. */ }
    return this.data;
  },
  write() {
    try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch { /* ignore */ }
  },
};
