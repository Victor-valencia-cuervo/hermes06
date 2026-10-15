// LyricsRepository estilo BitChord, reimplementado para web (sin copiar GPL).
// Prioridad: LRCLIB (line-sync) > lrc.red (word-sync TTML/LRC) > PaxSenix (Apple TTML) > Unison.
// Todo CORS abierto, sin key. Cache localStorage + AbortController.

const CACHE_KEY = 'h_lyrics_cache_v1';
const QS = (s) => encodeURIComponent(s || '');

function loadCache() {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}'); } catch { return {}; }
}
function saveCacheEntry(k, v) {
  try {
    const c = loadCache();
    c[k] = { ...v, at: Date.now() };
    // tope 120 entradas
    const keys = Object.keys(c);
    if (keys.length > 120) {
      keys.sort((a, b) => (c[a].at || 0) - (c[b].at || 0));
      for (const old of keys.slice(0, keys.length - 120)) delete c[old];
    }
    localStorage.setItem(CACHE_KEY, JSON.stringify(c));
  } catch { /* storage lleno */ }
}

// Limpia "Official Video, feat., remaster, etc" para buscar mejor (idea BitChord forLyricsSearch)
export function cleanForSearch(s) {
  return String(s || '')
    .replace(/\s*[\(\[].*?(official|video|lyric|audio|remaster|feat\.?|ft\.?|from .*|live|remix|acoustic|slowed|sped up|8d|nightcore).*?[\)\]]\s*/gi, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}
const coreOf = (s) => cleanForSearch(s).toLowerCase();
const versionOf = (s) => {
  const m = String(s || '').toLowerCase().match(/live|remix|acoustic|karaoke|cover|slowed|sped|nightcore|8d|extended|unplugged/);
  return m ? m[0] : '';
};

export function parseLRC(text) {
  const out = [];
  if (!text) return out;
  // Soporta [mm:ss.xx] y enhanced <mm:ss.xx>palabra
  for (const raw of String(text).split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const m = line.match(/\[(\d+):(\d+(?:\.\d+)?)\]\s*(.*)/);
    if (!m) continue;
    const t = (+m[1]) * 60 + (+m[2]);
    let rest = (m[3] || '').trim();
    if (!rest) continue;
    // Enhanced: <00:12.34>hola <00:13.00>mundo -> palabras con tiempo
    const words = [];
    const wRe = /<(\d+):(\d+(?:\.\d+)?)>([^<]*)/g;
    let wm; let hasWords = false;
    while ((wm = wRe.exec(rest)) !== null) {
      hasWords = true;
      const wt = (+wm[1]) * 60 + (+wm[2]);
      const wx = wm[3].trim();
      if (wx) words.push({ t: wt, x: wx });
    }
    const plain = rest.replace(/<\d+:\d+(?:\.\d+)?>/g, '').trim();
    out.push({ t, x: plain, words: hasWords ? words : undefined });
  }
  return out.sort((a, b) => a.t - b.t);
}

export function parseTTML(ttml) {
  // TTML Apple / lrc.red: <p begin="00:01.00" end="..."><span begin end>word</span>...</p>
  const out = [];
  if (!ttml || !ttml.includes('<p')) return out;
  const toSec = (s) => {
    if (s == null) return 0;
    const m = String(s).match(/(?:(\d+):)?(\d+):(\d+(?:\.\d+)?)/);
    if (m) return (+m[1] || 0) * 3600 + (+m[2]) * 60 + (+m[3]);
    const n = parseFloat(s);
    return isFinite(n) ? n : 0;
  };
  const pRe = /<p[^>]*begin="([^"]*)"[^>]*>([\s\S]*?)<\/p>/gi;
  let pm;
  while ((pm = pRe.exec(ttml)) !== null) {
    const t = toSec(pm[1]);
    const inner = pm[2];
    const words = [];
    const sRe = /<span[^>]*begin="([^"]*)"[^>]*>([^<]*)<\/span>/gi;
    let sm;
    while ((sm = sRe.exec(inner)) !== null) {
      const wt = toSec(sm[1]);
      const wx = (sm[2] || '').trim();
      if (wx) words.push({ t: wt, x: wx });
    }
    const plain = inner.replace(/<[^>]+>/g, ' ').replace(/\s{2,}/g, ' ').trim();
    if (!plain) continue;
    out.push({ t, x: plain, words: words.length ? words : undefined });
  }
  return out.sort((a, b) => a.t - b.t);
}

async function fetchJSON(url, ms = 8000, signal) {
  const c = new AbortController();
  const timer = setTimeout(() => c.abort(), ms);
  const onAbort = () => c.abort();
  try {
    signal?.addEventListener?.('abort', onAbort, { once: true });
    const r = await fetch(url, { signal: c.signal, headers: { 'User-Agent': 'Hermes/4.1 (musica; +https://hermes06.pages.dev)' } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener?.('abort', onAbort);
  }
}
async function fetchText(url, ms = 8000, signal) {
  const c = new AbortController();
  const timer = setTimeout(() => c.abort(), ms);
  const onAbort = () => c.abort();
  try {
    signal?.addEventListener?.('abort', onAbort, { once: true });
    const r = await fetch(url, { signal: c.signal });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.text();
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener?.('abort', onAbort);
  }
}

// --- Providers ---
async function fromLRCLIB(artist, title, durationSec, signal) {
  try {
    if (artist && title) {
      const j = await fetchJSON(`https://lrclib.net/api/get?artist_name=${QS(artist)}&track_name=${QS(title)}${durationSec ? `&duration=${Math.round(durationSec)}` : ''}`, 8000, signal);
      if (j?.syncedLyrics || j?.plainLyrics) {
        return { provider: 'LRCLIB', lines: j.syncedLyrics ? parseLRC(j.syncedLyrics) : [], plain: j.plainLyrics || '', wordSync: (j.syncedLyrics || '').includes('<'), duration: j.duration };
      }
    }
  } catch { /* fallback search */ }
  const arr = await fetchJSON(`https://lrclib.net/api/search?track_name=${QS(title)}&artist_name=${QS(artist)}`, 8000, signal).catch(() => []);
  if (!Array.isArray(arr) || !arr.length) throw new Error('lrclib empty');
  const scored = arr
    .filter((x) => x.syncedLyrics || x.plainLyrics)
    .map((x) => ({ x, d: durationSec ? Math.abs((x.duration || 0) - durationSec) : 0 }))
    .sort((a, b) => a.d - b.d);
  const best = scored[0]?.x;
  if (!best) throw new Error('lrclib empty');
  return { provider: 'LRCLIB', lines: best.syncedLyrics ? parseLRC(best.syncedLyrics) : [], plain: best.plainLyrics || '', wordSync: false };
}

function bestLrcRed(hits, title, artist, durationSec) {
  const ct = coreOf(title); const ca = coreOf(artist); const vv = versionOf(`${title} ${artist}`);
  let best = null; let bestScore = -1;
  for (const h of hits || []) {
    const ht = coreOf(h.title || h.trackName || '');
    const ha = coreOf(h.artist || h.artistName || '');
    if (!ht || !ha) continue;
    if (ht !== ct) continue; // exige mismo núcleo
    if ((ha || '').split(' ')[0] && !(ca.includes(ha.split(' ')[0]) || ha.includes(ca.split(' ')[0]))) continue;
    if (versionOf(`${h.title} ${h.version || ''}`) !== vv) continue;
    const hd = Number(h.duration ?? h.length ?? NaN);
    if (durationSec && isFinite(hd) && Math.abs(hd - durationSec) > 3) continue;
    const score = (h.synced ? 2 : 0) + (h.isrc ? 1 : 0);
    if (score > bestScore) { bestScore = score; best = h; }
  }
  return best || (hits || []).find((h) => h.isrc) || null;
}

async function fromLrcRed(artist, title, durationSec, signal) {
  const q = cleanForSearch(`${title} ${artist}`);
  const j = await fetchJSON(`https://lrc.red/search.json?q=${QS(q)}`, 8000, signal);
  const hits = j?.hits || j?.results || j || [];
  const list = Array.isArray(hits) ? hits : [];
  if (!list.length) throw new Error('lrc.red empty');
  const hit = bestLrcRed(list, title, artist, durationSec) || list[0];
  const isrc = hit?.isrc || hit?.ISRC;
  if (!isrc) throw new Error('lrc.red sin isrc');
  // TTML primero (word-sync), luego LRC
  try {
    const ttml = await fetchText(`https://lrc.red/s/${isrc}.ttml`, 8000, signal);
    const lines = parseTTML(ttml);
    if (lines.length) return { provider: 'lrc.red', lines, plain: lines.map((l) => l.x).join('\n'), wordSync: lines.some((l) => l.words?.length) };
  } catch { /* prueba lrc */ }
  const lrc = await fetchText(`https://lrc.red/s/${isrc}.lrc`, 8000, signal);
  const lines = parseLRC(lrc);
  if (!lines.length) throw new Error('lrc.red sin lineas');
  return { provider: 'lrc.red', lines, plain: lines.map((l) => l.x).join('\n'), wordSync: lines.some((l) => l.words?.length) };
}

async function fromPaxSenix(artist, title, signal) {
  const j = await fetchJSON(`https://lyrics.paxsenix.org/apple-music/lyrics?title=${QS(cleanForSearch(title))}&artist=${QS(cleanForSearch(artist))}`, 9000, signal);
  // Respuesta: { lyrics: TTML string } o { data: ... }
  const ttml = j?.lyrics || j?.data?.lyrics || (typeof j === 'string' ? j : null);
  if (!ttml || !String(ttml).includes('<')) throw new Error('paxsenix empty');
  const lines = parseTTML(String(ttml));
  if (!lines.length) throw new Error('paxsenix sin lineas');
  return { provider: 'PaxSenix', lines, plain: lines.map((l) => l.x).join('\n'), wordSync: lines.some((l) => l.words?.length) };
}

async function fromUnison(artist, title, signal) {
  const j = await fetchJSON(`https://unison.boidu.dev/lyrics?title=${QS(title)}&artist=${QS(artist)}`, 8000, signal).catch(() => null);
  const lrc = j?.synced || j?.lrc || j?.lyrics;
  if (!lrc) throw new Error('unison empty');
  const lines = parseLRC(String(lrc));
  if (!lines.length) throw new Error('unison sin lineas');
  return { provider: 'Unison', lines, plain: j.plain || lines.map((l) => l.x).join('\n'), wordSync: false };
}

// API principal: primer wordSync gana, si no primer lineSync. Cancela perdedores.
export async function getLyrics({ artist = '', title = '', duration = 0, signal } = {}) {
  const a = cleanForSearch(artist); const t = cleanForSearch(title);
  if (!a && !t) throw new Error('sin datos');
  const key = `${a.toLowerCase()} — ${t.toLowerCase()}`;
  const cached = loadCache()[key];
  if (cached?.lines?.length || cached?.plain) return { ...cached, cached: true };

  const ctrl = new AbortController();
  const onOuterAbort = () => ctrl.abort();
  signal?.addEventListener?.('abort', onOuterAbort, { once: true });
  const s = ctrl.signal;
  const jobs = [
    () => fromLrcRed(a || artist, t || title, duration, s),
    () => fromLRCLIB(a || artist, t || title, duration, s),
    () => fromPaxSenix(a || artist, t || title, s),
    () => fromUnison(a || artist, t || title, s),
  ];
  const results = await Promise.all(jobs.map((fn) => fn().then(
    (value) => ({ status: 'fulfilled', value }),
    (reason) => ({ status: 'rejected', reason }),
  )));
  signal?.removeEventListener?.('abort', onOuterAbort);

  let firstLine = null;
  for (const r of results) {
    if (r.status !== 'fulfilled') continue;
    const v = r.value;
    if (v?.lines?.some((l) => l.words?.length)) {
      const out = { ...v, lines: v.lines, plain: v.plain || '' };
      saveCacheEntry(key, out);
      try { ctrl.abort(); } catch {}
      return out;
    }
    if (!firstLine && (v?.lines?.length || v?.plain)) firstLine = v;
  }
  if (firstLine) {
    saveCacheEntry(key, firstLine);
    return firstLine;
  }
  // Último intento: plain de LRCLIB aunque sea sin sync
  throw new Error('sin letra');
}

export function activeLineIndex(lines, cur) {
  let a = -1;
  for (let i = 0; i < (lines || []).length; i++) if ((lines[i]?.t ?? 0) <= cur) a = i;
  return a;
}
