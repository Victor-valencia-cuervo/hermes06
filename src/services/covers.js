// Carátulas ORIGINALES (no el frame del video).
// Prioridad: 1) iTunes 600px (arte oficial del álbum) -> 2) MusicBrainz + Cover Art Archive (arte original escaneado)
// -> 3) Audius 1000px -> 4) YouTube maxres/hq (último recurso).
// Todo gratis, sin key, CORS abierto. Cache memoria + localStorage.

const mem = new Map(); // "titulo|artista" -> { t, url }
const LS = 'h_cover_cache_v1';
const QS = (s) => encodeURIComponent(s || '');

function lsGet(key) {
  try {
    const c = JSON.parse(localStorage.getItem(LS) || '{}');
    const e = c[key];
    if (e && Date.now() - e.t < 30 * 24 * 3600 * 1000) return e.url;
  } catch {}
  return null;
}
function lsSet(key, url) {
  try {
    const c = JSON.parse(localStorage.getItem(LS) || '{}');
    c[key] = { url, t: Date.now() };
    const ks = Object.keys(c);
    if (ks.length > 300) {
      ks.sort((a, b) => (c[a].t || 0) - (c[b].t || 0));
      for (const old of ks.slice(0, ks.length - 300)) delete c[old];
    }
    localStorage.setItem(LS, JSON.stringify(c));
  } catch {}
}

const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const toks = (s) => norm(s).replace(/\(.*?\)|\[.*?\]/g, ' ').replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter((w) => w.length > 1);
const overlap = (a, b) => {
  if (!a.length || !b.length) return 0;
  const B = new Set(b);
  return a.filter((w) => B.has(w)).length / Math.max(a.length, b.length);
};
export const cleanTrack = (s) => String(s || '')
  .replace(/\s*[\(\[].*?(official|video|lyric|audio|remaster|feat\.?|ft\.?|live|remix|acoustic|slowed|sped up|8d|nightcore|cover|karaoke|tiktok|version).*?[\)\]]\s*/gi, ' ')
  .replace(/\s{2,}/g, ' ').trim();

async function fetchJSON(url, ms = 7000) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  try {
    const r = await fetch(url, { signal: c.signal });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } finally {
    clearTimeout(t);
  }
}

// 1) iTunes: arte oficial 600px. Exige coincidencia título ≥0.5 + artista ≥0.34.
async function fromITunes(title, artist) {
  const q = `${cleanTrack(artist)} ${cleanTrack(title)}`.trim().slice(0, 80);
  if (!q) return null;
  const j = await fetchJSON(`https://itunes.apple.com/search?term=${QS(q)}&media=music&entity=song&limit=8`);
  const tt = toks(title); const at = toks(artist);
  let best = null; let bs = 0;
  for (const s of j.results || []) {
    if (!s.artworkUrl100) continue;
    const to = overlap(tt, toks(s.trackName));
    const ao = Math.max(overlap(at, toks(s.artistName)), 0);
    if (to < 0.5 || ao < 0.34) continue;
    const sc = to * 0.7 + ao * 0.3;
    if (sc > bs) {
      bs = sc;
      best = String(s.artworkUrl100).replace('100x100', '600x600').replace('60x60', '600x600');
    }
  }
  return best;
}

// 2) MusicBrainz recording -> release -> Cover Art Archive front-500 (arte original).
async function fromMusicBrainz(title, artist) {
  const ct = cleanTrack(title); const ca = cleanTrack(artist);
  if (!ct) return null;
  const query = `recording:"${ct}"${ca ? ` AND artist:"${ca}"` : ''}`;
  const j = await fetchJSON(`https://musicbrainz.org/ws/2/recording/?query=${QS(query)}&fmt=json&limit=6`);
  const recs = j.recordings || [];
  for (const rec of recs) {
    const releases = rec.releases || [];
    for (const rel of releases.slice(0, 3)) {
      if (!rel.id) continue;
      // front-500 existe casi siempre; si da 404 se prueba el siguiente release
      try {
        const url = `https://coverartarchive.org/release/${rel.id}/front-500`;
        const c = new AbortController();
        const t = setTimeout(() => c.abort(), 5000);
        try {
          const r = await fetch(url, { signal: c.signal, method: 'GET' });
          if (r.ok && String(r.headers.get('content-type') || '').startsWith('image/')) return url;
        } finally {
          clearTimeout(t);
        }
      } catch { /* siguiente release */ }
    }
    // Si el recording coincide pero sin cover, no seguir buscando a ciegas
    if (recs.length) break;
  }
  return null;
}

/** Carátula original para título+artista. Devuelve URL http (no dataURL) o ''. Nunca lanza. */
export async function getOriginalCover(title, artist, { videoId = null } = {}) {
  const key = `${norm(cleanTrack(title))}|${norm(cleanTrack(artist))}`;
  if (!cleanTrack(title)) return '';
  const m = mem.get(key);
  if (m && Date.now() - m.t < 30 * 24 * 3600 * 1000) return m.url;
  const ls = lsGet(key);
  if (ls) { mem.set(key, { t: Date.now(), url: ls }); return ls; }

  // iTunes primero (más rápido y fiable en latinos/comercial)
  try {
    const it = await fromITunes(title, artist);
    if (it) { mem.set(key, { t: Date.now(), url: it }); lsSet(key, it); return it; }
  } catch {}
  // MusicBrainz/CAA (original escaneado, mejor en rock/clásica/catalogo)
  try {
    const mb = await fromMusicBrainz(title, artist);
    if (mb) { mem.set(key, { t: Date.now(), url: mb }); lsSet(key, mb); return mb; }
  } catch {}
  // Último recurso: frame HD del video
  if (videoId) {
    const yt = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
    mem.set(key, { t: Date.now(), url: yt });
    return yt;
  }
  return '';
}

/** Enriquecer lista online en segundo plano: reemplaza art YT por original sin bloquear.
 *  onUpdate(nuevaLista) se llama por lotes. Concurrencia 4, solo faltantes. */
export async function enrichOnlineCovers(list, onUpdate, { concurrency = 4 } = {}) {
  const arr = Array.isArray(list) ? list : [];
  if (!arr.length || typeof onUpdate !== 'function') return arr;
  const out = arr.slice();
  // Solo los que aún traen thumb de YouTube (los de iTunes/Audius ya son originales)
  const idxs = [];
  out.forEach((t, i) => {
    if (t && /i\.ytimg\.com/.test(String(t.art || '')) && t.title) idxs.push(i);
  });
  if (!idxs.length) return out;
  let cursor = 0;
  const worker = async () => {
    while (cursor < idxs.length) {
      const i = idxs[cursor++];
      const t = out[i];
      try {
        const url = await getOriginalCover(t.title, t.artist, { videoId: t.videoId });
        if (url && !/i\.ytimg\.com/.test(url)) {
          out[i] = { ...t, art: url, artOriginal: true };
          // Actualiza por lotes cada 3 para no re-renderizar 20 veces
          if (idxs.indexOf(i) % 3 === 0) onUpdate(out.slice());
        }
      } catch { /* conserva thumb */ }
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, idxs.length) }, worker));
  onUpdate(out.slice());
  return out;
}
