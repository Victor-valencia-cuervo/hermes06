// Catálogo REAL para la búsqueda y el inicio de música (sin datos inventados).
//
// Fuente principal: API pública de Deezer (sin key). No manda cabeceras CORS,
// por eso se consulta por JSONP (output=jsonp&callback=…), que sí funciona en
// el navegador y en el WebView del APK. Da: foto real del artista, álbumes con
// fecha de lanzamiento, canciones con carátula oficial, charts y lanzamientos.
// Respaldo: iTunes (./artist.js) cuando Deezer no responde.
//
// Cada entidad lleva `ref` ("dz-123" | "it-456") que viaja en la URL:
//   /musica/artista/dz-123 · /musica/album/dz-77
import {
  searchArtist as itSearchArtist, getArtistAlbums as itAlbums, getAlbumTracks as itAlbumTracks,
  getArtistTopSongs as itTop, searchAlbums as itSearchAlbums, searchSongs as itSearchSongs,
} from './artist';

const TTL = 10 * 60 * 1000;
const cache = new Map();
const cGet = (k) => { const e = cache.get(k); if (e && Date.now() - e.t < TTL) return e.v; cache.delete(k); return undefined; };
const cSet = (k, v) => { cache.set(k, { v, t: Date.now() }); if (cache.size > 160) cache.delete(cache.keys().next().value); return v; };

let seq = 0;
/** GET a Deezer por JSONP (el único modo sin CORS). */
function dz(path, ms = 8000) {
  const key = `dz:${path}`;
  const hit = cGet(key);
  if (hit !== undefined) return Promise.resolve(hit);
  return new Promise((resolve, reject) => {
    if (typeof document === 'undefined') { reject(new Error('sin DOM')); return; }
    const cb = `__dz${Date.now().toString(36)}${seq++}`;
    const s = document.createElement('script');
    let done = false;
    const end = () => { done = true; clearTimeout(timer); try { delete window[cb]; } catch { window[cb] = undefined; } s.remove(); };
    const timer = setTimeout(() => { if (!done) { end(); reject(new Error('Deezer tardó demasiado')); } }, ms);
    window[cb] = (data) => {
      if (done) return;
      end();
      if (!data || data.error) reject(new Error(data?.error?.message || 'Deezer error'));
      else { cSet(key, data); resolve(data); }
    };
    s.onerror = () => { if (!done) { end(); reject(new Error('Deezer no cargó')); } };
    s.async = true;
    s.src = `https://api.deezer.com${path}${path.includes('?') ? '&' : '?'}output=jsonp&callback=${cb}`;
    document.head.appendChild(s);
  });
}

export const dzRaw = dz;

const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

// ---------- normalizadores ----------
export const mapArtist = (a) => (a && a.id ? {
  kind: 'artist', src: 'dz', ref: `dz-${a.id}`, id: `dz_a_${a.id}`, dzId: a.id,
  name: a.name, art: a.picture_xl || a.picture_big || a.picture_medium || '',
  fans: a.nb_fan || 0, albums: a.nb_album || 0,
} : null);

export const mapAlbum = (a, fallbackArtist) => (a && a.id ? {
  kind: 'album', src: 'dz', ref: `dz-${a.id}`, id: `dz_al_${a.id}`, dzId: a.id,
  title: a.title, artist: a.artist?.name || fallbackArtist?.name || '', artistRef: a.artist?.id ? `dz-${a.artist.id}` : (fallbackArtist?.ref || ''),
  art: a.cover_xl || a.cover_big || a.cover_medium || '',
  releaseDate: a.release_date || '', year: (a.release_date || '').slice(0, 4),
  trackCount: a.nb_tracks || 0, type: a.record_type || 'album', explicit: !!a.explicit_lyrics,
} : null);

export const mapTrack = (t, album) => (t && t.id ? {
  kind: 'track', src: 'dz', id: `dz_t_${t.id}`, dzId: t.id,
  title: t.title_short || t.title, artist: t.artist?.name || '', artistRef: t.artist?.id ? `dz-${t.artist.id}` : '',
  album: t.album?.title || album?.title || '', albumRef: t.album?.id ? `dz-${t.album.id}` : (album?.ref || ''),
  art: t.album?.cover_xl || t.album?.cover_big || album?.art || '',
  duration: t.duration || 0, preview: t.preview || '', explicit: !!t.explicit_lyrics,
  trackNumber: t.track_position || 0, rank: t.rank || 0,
} : null);

const dedupe = (list, keyFn) => { const seen = new Set(); return list.filter((x) => { const k = keyFn(x); if (!k || seen.has(k)) return false; seen.add(k); return true; }); };
const byDateDesc = (a, b) => String(b.releaseDate || '').localeCompare(String(a.releaseDate || ''));

// ---------- respaldo iTunes con la misma forma ----------
const itArtist = (a) => (a ? { kind: 'artist', src: 'it', ref: `it-${a.artistId}`, id: a.id, itId: a.artistId, name: a.name, art: '', genre: a.genre || '', fans: 0 } : null);
const itAlbum = (a) => ({
  kind: 'album', src: 'it', ref: `it-${a.collectionId}`, id: a.id, itId: a.collectionId, title: a.title, artist: a.artist,
  artistRef: a.artistId ? `it-${a.artistId}` : '', art: a.art, year: a.releaseDate || '', releaseDate: a.releaseDate ? `${a.releaseDate}-01-01` : '',
  trackCount: a.trackCount, type: 'album',
});
const itTrack = (s) => ({
  kind: 'track', src: 'it', id: s.id, title: s.title, artist: s.artist, album: '', art: s.art, duration: s.duration, preview: s.preview || '', trackNumber: s.trackNumber || 0,
});

// ---------- búsqueda ----------
/** Todo lo que coincide con el término: artistas (con foto), álbumes y canciones. Nunca lanza. */
export async function searchCatalog(term) {
  const q = String(term || '').trim();
  const empty = { artists: [], albums: [], tracks: [], source: 'none' };
  if (q.length < 2) return empty;
  const ck = `all:${norm(q)}`;
  const hit = cGet(ck);
  if (hit) return hit;
  const Q = encodeURIComponent(q);
  try {
    const [ar, al, tr] = await Promise.all([
      dz(`/search/artist?q=${Q}&limit=10`).catch(() => null),
      dz(`/search/album?q=${Q}&limit=20`).catch(() => null),
      dz(`/search/track?q=${Q}&limit=30`).catch(() => null),
    ]);
    if (!ar && !al && !tr) throw new Error('Deezer sin datos');
    const out = {
      artists: dedupe((ar?.data || []).map(mapArtist).filter(Boolean), (x) => norm(x.name)),
      albums: dedupe((al?.data || []).map((x) => mapAlbum(x)).filter(Boolean), (x) => `${norm(x.title)}|${norm(x.artist)}`),
      tracks: dedupe((tr?.data || []).map((x) => mapTrack(x)).filter(Boolean), (x) => `${norm(x.title)}|${norm(x.artist)}`),
      source: 'deezer',
    };
    return cSet(ck, out);
  } catch {
    // Respaldo iTunes: sin foto de artista, pero con álbumes y canciones reales.
    try {
      const [a, albums, songs] = await Promise.all([
        itSearchArtist(q).catch(() => null),
        itSearchAlbums(q, 14).catch(() => []),
        itSearchSongs(q, 20).catch(() => []),
      ]);
      const out = { artists: a ? [itArtist(a)] : [], albums: albums.map(itAlbum), tracks: songs.map(itTrack), source: 'itunes' };
      return cSet(ck, out);
    } catch { return empty; }
  }
}

/** ¿El primer artista corresponde de verdad a lo escrito? (evita "mejor resultado" falso). */
export function bestArtistFor(term, artists = []) {
  const t = norm(term);
  if (!t) return null;
  const words = t.split(' ').filter((w) => w.length > 1);
  const hit = artists.find((a) => {
    const n = norm(a.name);
    if (!n) return false;
    if (n === t || n.includes(t) || t.includes(n)) return true;
    return words.length > 0 && words.filter((w) => n.includes(w)).length / words.length >= 0.7;
  });
  return hit || null;
}

// ---------- artista ----------
const parseRef = (ref) => {
  const m = String(ref || '').match(/^(dz|it)-(\d+)$/);
  return m ? { src: m[1], id: m[2] } : null;
};

/** Perfil completo: datos + populares + discografía (recientes primero) + similares. */
export async function getArtistBundle(ref) {
  const r = parseRef(ref);
  if (!r) return null;
  const ck = `ab:${ref}`;
  const hit = cGet(ck);
  if (hit) return hit;
  if (r.src === 'dz') {
    try {
      const [info, top, albs, rel] = await Promise.all([
        dz(`/artist/${r.id}`),
        dz(`/artist/${r.id}/top?limit=10`).catch(() => ({ data: [] })),
        dz(`/artist/${r.id}/albums?limit=60`).catch(() => ({ data: [] })),
        dz(`/artist/${r.id}/related?limit=12`).catch(() => ({ data: [] })),
      ]);
      const artist = mapArtist(info);
      if (!artist) return null;
      const albums = dedupe((albs.data || []).map((x) => mapAlbum(x, artist)).filter(Boolean), (x) => norm(x.title)).sort(byDateDesc);
      return cSet(ck, {
        artist,
        top: (top.data || []).map((x) => mapTrack(x)).filter(Boolean),
        albums: albums.filter((a) => a.type === 'album' || a.type === 'ep' || !a.type),
        singles: albums.filter((a) => a.type === 'single'),
        latest: albums.slice(0, 12),
        related: (rel.data || []).map(mapArtist).filter(Boolean),
      });
    } catch { return null; }
  }
  try {
    const [albs] = await Promise.all([itAlbums(r.id, 30)]);
    const name = albs[0]?.artist || '';
    const top = name ? await itTop(name, 10) : [];
    return cSet(ck, {
      artist: { kind: 'artist', src: 'it', ref, id: `art_${r.id}`, name, art: '', fans: 0 },
      top: top.map(itTrack), albums: albs.map(itAlbum), singles: [], latest: albs.slice(0, 12).map(itAlbum), related: [],
    });
  } catch { return null; }
}

// ---------- álbum ----------
export async function getAlbumBundle(ref) {
  const r = parseRef(ref);
  if (!r) return null;
  const ck = `alb:${ref}`;
  const hit = cGet(ck);
  if (hit) return hit;
  if (r.src === 'dz') {
    try {
      const j = await dz(`/album/${r.id}`);
      const album = mapAlbum(j);
      if (!album) return null;
      const tracks = (j.tracks?.data || []).map((x) => mapTrack({ ...x, album: { id: j.id, title: j.title, cover_xl: j.cover_xl, cover_big: j.cover_big } }, album)).filter(Boolean);
      return cSet(ck, { album: { ...album, label: j.label || '', genre: j.genres?.data?.[0]?.name || '', duration: j.duration || 0 }, tracks });
    } catch { return null; }
  }
  try {
    const tracks = await itAlbumTracks(r.id, 40);
    if (!tracks.length) return null;
    const first = tracks[0];
    return cSet(ck, { album: { kind: 'album', src: 'it', ref, id: `al_${r.id}`, title: first.album || 'Álbum', artist: first.artist, art: first.art, year: '', releaseDate: '', trackCount: tracks.length, type: 'album' }, tracks: tracks.map(itTrack) });
  } catch { return null; }
}

// ---------- charts y lanzamientos (inicio) ----------
/** Canciones más escuchadas ahora (chart global de Deezer). */
export async function chartTracks(limit = 20) {
  try { const j = await dz(`/chart/0/tracks?limit=${limit}`); return (j.tracks?.data || j.data || []).map((x, i) => ({ ...mapTrack(x), rank: i + 1 })).filter((x) => x.title); } catch { return []; }
}
export async function chartAlbums(limit = 20) {
  try { const j = await dz(`/chart/0/albums?limit=${limit}`); return (j.albums?.data || j.data || []).map((x) => mapAlbum(x)).filter(Boolean); } catch { return []; }
}
export async function chartArtists(limit = 20) {
  try { const j = await dz(`/chart/0/artists?limit=${limit}`); return (j.artists?.data || j.data || []).map(mapArtist).filter(Boolean); } catch { return []; }
}
/** Lanzamientos recientes (editorial de Deezer, más nuevos primero). */
export async function newReleases(limit = 24) {
  try {
    const j = await dz(`/editorial/0/releases?limit=${limit}`);
    return (j.data || []).map((x) => mapAlbum(x)).filter(Boolean).sort(byDateDesc);
  } catch { return []; }
}

/** Álbumes de un conjunto de artistas (para "álbumes que te gustan"): recientes primero, sin repetidos. */
export async function albumsOfArtists(names = [], perArtist = 3) {
  const out = [];
  await Promise.all(names.map(async (name) => {
    try {
      const s = await dz(`/search/artist?q=${encodeURIComponent(name)}&limit=3`);
      const a = bestArtistFor(name, (s.data || []).map(mapArtist).filter(Boolean));
      if (!a) return;
      const j = await dz(`/artist/${a.dzId}/albums?limit=20`);
      const albs = dedupe((j.data || []).map((x) => mapAlbum(x, a)).filter(Boolean), (x) => norm(x.title))
        .filter((x) => x.type === 'album' || x.type === 'ep').sort(byDateDesc).slice(0, perArtist);
      out.push(...albs.map((x) => ({ ...x, why: a.name })));
    } catch { /* sin álbumes de este artista */ }
  }));
  return dedupe(out, (x) => x.ref);
}

/** Foto real de un artista por nombre (para historial/recomendaciones). '' si no hay coincidencia fiable. */
export async function artistPhoto(name) {
  const q = String(name || '').split(',')[0].trim();
  if (!q) return '';
  try {
    const s = await dz(`/search/artist?q=${encodeURIComponent(q)}&limit=3`);
    const a = bestArtistFor(q, (s.data || []).map(mapArtist).filter(Boolean));
    return a?.art || '';
  } catch { return ''; }
}

/** Artista por nombre -> objeto completo con ref (o null). */
export async function findArtistByName(name) {
  const q = String(name || '').split(',')[0].trim();
  if (!q) return null;
  try {
    const s = await dz(`/search/artist?q=${encodeURIComponent(q)}&limit=3`);
    return bestArtistFor(q, (s.data || []).map(mapArtist).filter(Boolean));
  } catch { return null; }
}

// ---------- URLs de la app ----------
export const artistPath = (a) => (a?.ref ? `/musica/artista/${a.ref}` : '/musica');
export const albumPath = (a) => (a?.ref ? `/musica/album/${a.ref}` : '/musica');

export const compactNum = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(1).replace(/\.0$/, '')} M` : n >= 1e3 ? `${(n / 1e3).toFixed(1).replace(/\.0$/, '')} K` : String(n || 0));
