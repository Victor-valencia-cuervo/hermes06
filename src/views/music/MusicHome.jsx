import { useMemo } from 'react';
import { Play, Pause, Loader2, Plus, Shuffle, Heart } from 'lucide-react';
import Cover from '../../components/Cover';
import { Section, SectionTitle, Shelf, SquareCard, SongRow, ShelfSkeleton, RowsSkeleton } from './ui';
import { PlaylistCard, RoomPlCard } from './RoomCards';
import { CATEGORIES, MOODS } from './data';
import { albumPath, artistPath } from '../../services/catalog';
import { getFollowed } from '../../lib/follow';
import { CHART_COUNTRIES } from '../../services/charts';

const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9 ]/g, '').trim();
const keyOf = (t) => `${norm(t?.title)}|${norm(String(t?.artist || '').split(',')[0])}`;
const mainArtist = (a) => String(a || '').split(/,| & | feat\.?| ft\.?| x /i)[0].trim();

function ago(ts) {
  if (!ts) return '';
  const m = Math.max(0, Math.round((Date.now() - ts) / 60000));
  if (m < 1) return 'ahora';
  if (m < 60) return `hace ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24);
  return d === 1 ? 'ayer' : `hace ${d} días`;
}

/** Hero: lo que suena ahora, o una sugerencia destacada real. */
function Hero({ p, feat, onPlayFeat, resolving }) {
  const t = p.track || feat;
  if (!t) return <div className="h-52 rounded-[2rem] animate-pulse" style={{ background: 'var(--s2)' }} />;
  const live = !!p.track;
  const go = () => { if (live) p.toggle(); else onPlayFeat(feat); };
  return (
    <section className="relative overflow-hidden rounded-[2rem] min-h-[13.5rem] sm:min-h-[16rem] flex items-end text-white" style={{ background: '#111' }}>
      {t.art && <img src={t.art} alt="" className="absolute inset-0 w-full h-full object-cover scale-125 blur-2xl opacity-70" />}
      <div className="absolute inset-0" style={{ background: 'linear-gradient(120deg, color-mix(in srgb, var(--a) 40%, transparent), rgba(0,0,0,.72))' }} />
      <div className="relative w-full p-5 sm:p-7 flex items-center gap-5">
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-bold tracking-[0.25em] uppercase opacity-80 flex items-center gap-2">
            {live && p.playing && <span className="inline-block w-1.5 h-1.5 rounded-full bg-white animate-pulse" />}
            {live ? (p.playing ? 'Sonando ahora' : 'En pausa') : 'Para empezar'}
          </p>
          <h3 className="serif text-3xl sm:text-5xl font-semibold leading-[1.05] mt-2 line-clamp-2" title={t.title}>{t.title}</h3>
          <p className="mt-1 text-base sm:text-lg opacity-85 line-clamp-2" title={t.artist}>{t.artist}</p>
          <div className="mt-4 flex gap-2">
            <button onClick={go} disabled={resolving} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white text-black font-semibold text-sm active:scale-95 transition-transform">
              {resolving ? <Loader2 size={16} className="animate-spin" /> : live && p.playing ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
              {live ? (p.playing ? 'Pausar' : 'Continuar') : 'Reproducir'}
            </button>
            {live && <button onClick={() => p.openFull?.()} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-sm border border-white/35 backdrop-blur active:scale-95 transition-transform">Abrir reproductor</button>}
          </div>
        </div>
        <Cover src={t.art} className={`hidden sm:block w-40 h-40 rounded-3xl shadow-2xl shrink-0 ${live && p.playing ? 'breathe' : ''}`} iconSize={40} />
      </div>
    </section>
  );
}

/** Pantalla de inicio de música. Todo sale de datos reales: tu historial, tus playlists,
 *  los charts de iTunes/Deezer y búsquedas de YouTube. Nada inventado ni repetido entre secciones. */
export default function MusicHome({ h }) {
  const { p, toast, nav, fuente, resolvingId, playEntry, playTrack, openMenu, goSearch, openCategory, openPl, onCreatePl,
    recs, recAlbums, charts, chartsLoading, cc, changeCountry, randomSongs, randomLoading, reshuffle,
    popTracks, popAlbums, audTrend, roomPls, peers, myAvatar, onOpenRoom, openRoom, pls, plStats, hero } = h;

  // ---- Volver a escuchar: Me gusta + lo que más oyes + álbumes de tus artistas + tus playlists + Crear ----
  const replay = useMemo(() => {
    const hist = p.history || [];
    const count = new Map();
    const first = new Map();
    for (const t of hist) { const k = keyOf(t); count.set(k, (count.get(k) || 0) + 1); if (!first.has(k)) first.set(k, t); }
    // Más escuchadas primero; a igualdad, la más reciente (orden de aparición en el historial).
    return [...first.entries()].sort((a, b) => (count.get(b[0]) - count.get(a[0]))).map(([, t]) => t).slice(0, 10);
  }, [p.history]);

  // Historial en columnas de 5 temas hacia abajo, deslizable a derecha e izquierda
  const historyCols = useMemo(() => {
    const list = (p.history || []).slice(0, 40);
    const cols = [];
    for (let i = 0; i < list.length; i += 5) {
      cols.push(list.slice(i, i + 5));
    }
    return cols;
  }, [p.history]);

  // ---- Sin repetir entre secciones de descubrimiento ----
  const used = new Set();
  const take = (list, n) => {
    const out = [];
    for (const t of list || []) {
      const k = keyOf(t);
      if (!k || used.has(k)) continue;
      used.add(k); out.push(t);
      if (out.length >= n) break;
    }
    return out;
  };
  const quick = take([...(recs || []), ...(popTracks || [])], 8);
  const discover = take(randomSongs, 12);
  const popular = take(popTracks, 14);

  // ---- Tendencias: datos simples calculados del chart real del país ----
  const trend = useMemo(() => {
    if (!charts?.length) return null;
    const art = new Map(); const gen = new Map();
    for (const c of charts) {
      const a = mainArtist(c.artist); if (a) art.set(a, (art.get(a) || 0) + 1);
      const g = c.genre; if (g && !/^music$/i.test(g)) gen.set(g, (gen.get(g) || 0) + 1);
    }
    const topA = [...art.entries()].sort((a, b) => b[1] - a[1])[0];
    const topG = [...gen.entries()].sort((a, b) => b[1] - a[1])[0];
    return { n1: charts[0], topA, topG, total: charts.length };
  }, [charts]);

  const play = (t, list) => (p.track?.id === t.id ? p.openFull?.() : (playTrack ? playTrack(t, list) : p.play(t, list)));
  const countryName = (CHART_COUNTRIES.find(([v]) => v === cc) || [cc, cc])[1];

  const hasReplay = !!(p.favs || []).length || getFollowed().length || replay.length || (recAlbums || []).length || pls.playlists.length;

  return (
    <div className="space-y-9">
      <Hero p={p} feat={hero} onPlayFeat={h.playFeat} resolving={!!resolvingId} />

      {fuente === 'audius' && (
        <Section title="Tendencias en Audius" sub="Completas y descargables · catálogo independiente">
          <Shelf>
            {audTrend.map((c) => <SquareCard key={c.id} art={c.art} title={c.title} sub={c.artist} onClick={() => p.play(c, audTrend)} badge="Audius" label={`Reproducir ${c.title}`} />)}
            {!audTrend.length && <ShelfSkeleton n={4} />}
          </Shelf>
        </Section>
      )}

      {/* ===== Volver a escuchar ===== */}
      <Section title="Volver a escuchar" sub={hasReplay ? 'Tus canciones, álbumes y playlists' : undefined}>
        <Shelf>
          {!!(p.favs || []).length && (
            <PlaylistCard pl={{ id: 'fav', name: 'Tus Me Gusta', tracks: p.favs }} plays={plStats.fav || 0} onClick={() => openPl('fav')} />
          )}
          {getFollowed().slice(0, 8).map((a) => (
            <SquareCard key={`f-${a.ref}`} art={a.art} title={a.name} sub="Artista" badge="Sigues" onClick={() => nav(artistPath(a))} />
          ))}
          {replay.map((t) => (
            <SquareCard key={`r-${t.id}`} art={t.art} title={t.title} sub={t.artist} label={`Reproducir ${t.title}`}
              onClick={() => play(t)} active={p.track?.id === t.id} playing={p.playing} />
          ))}
          {(recAlbums || []).map((a) => (
            <SquareCard key={a.ref || a.id} art={a.art} title={a.title} sub={a.artist} badge="Álbum" onClick={() => nav(albumPath(a))} />
          ))}
          {pls.playlists.map((pl) => (
            <PlaylistCard key={pl.id} pl={pl} plays={plStats[pl.id] || 0} onClick={() => openPl(pl.id)} />
          ))}
          {/* Al deslizar hasta el final aparece Crear playlist */}
          <button onClick={onCreatePl} aria-label="Crear playlist"
            className="snap-start w-[8.75rem] sm:w-[11rem] shrink-0 text-left group">
            <span className="grid place-items-center w-[8.75rem] h-[8.75rem] sm:w-[11rem] sm:h-[11rem] rounded-2xl transition group-active:scale-95"
              style={{ border: '2px dashed var(--bd)', background: 'var(--s)' }}>
              <span className="w-12 h-12 rounded-full grid place-items-center text-white" style={{ background: 'var(--a)' }}><Plus size={24} /></span>
            </span>
            <p className="text-[15px] font-semibold mt-2">Crear playlist</p>
            <p className="text-[13px]" style={{ color: 'var(--m)' }}>Empieza una nueva</p>
          </button>
        </Shelf>
        {!hasReplay && <p className="text-sm mt-1" style={{ color: 'var(--m)' }}>Aún no hay nada aquí: reproduce una canción o dale ♥ y aparece.</p>}
      </Section>

      {/* ===== Historial ===== */}
      {(p.history || []).length > 0 && (
        <Section title="Historial" sub={`${(p.history || []).length} canciones · Desliza para explorar`} action={
          <button className="text-xs px-3 py-2 rounded-full transition-transform active:scale-95" style={{ background: 'var(--s2)', color: 'var(--m)' }} onClick={() => p.clearHistory()}>Limpiar</button>
        }>
          <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory pb-2 pt-0.5 -mx-5 px-5 sm:mx-0 sm:px-0"
            style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}>
            {historyCols.map((colSongs, colIdx) => (
              <div key={colIdx} className="w-[88vw] max-w-[360px] shrink-0 snap-start card !p-2 space-y-0.5">
                {colSongs.map((t) => (
                  <SongRow key={`${t.id}-${t.at || ''}-${colIdx}`} art={t.art} title={t.title} sub={`${t.artist}${t.at ? ` · ${ago(t.at)}` : ''}`}
                    active={p.track?.id === t.id} playing={p.playing} loading={resolvingId === t.id}
                    onPlay={() => play(t)} onMenu={() => openMenu(t, p.history, { kind: 'yt' })} />
                ))}
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* ===== Comunidad (playlists de grupos y de a 2) ===== */}
      {!!roomPls.length && (
        <Section title="Comunidad" sub="Playlists de tus grupos y chats">
          <Shelf>
            {roomPls.map((pl) => (
              <RoomPlCard key={pl.id} pl={pl} peer={peers[pl.roomId]} myAvatar={myAvatar}
                onOpen={() => nav(`/musica/sala/${pl.roomId}`)}
                onPlay={() => { const l = (pl.tracks || []).filter((t) => t.videoId || t.src); if (l.length) p.play(l[0], l); else toast('Esa playlist no tiene temas reproducibles'); }}
                onChat={() => (onOpenRoom ? onOpenRoom(pl.roomId) : toast('Abre Comunidad para chatear'))} />
            ))}
          </Shelf>
        </Section>
      )}

      {/* ===== Para cada momento ===== */}
      <Section title="Para cada momento">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          {MOODS.map(([label, query, bg]) => (
            <button key={label} onClick={() => goSearch(query, label)}
              className="relative overflow-hidden rounded-2xl px-4 h-[4.5rem] text-left text-white active:scale-95 transition-transform flex items-end pb-3"
              style={{ background: bg }}>
              <span className="serif text-xl font-semibold leading-tight" style={{ textShadow: '0 2px 10px rgba(0,0,0,.4)' }}>{label}</span>
            </button>
          ))}
        </div>
      </Section>

      {/* ===== Descubre: tendencias con datos reales ===== */}
      <section>
        <SectionTitle title="Descubre" sub={`Tendencias en ${countryName} ahora`} action={
          <select className="inp !w-auto !py-1.5 !min-h-[40px] !rounded-full text-xs" value={cc} aria-label="País del top" onChange={(e) => changeCountry(e.target.value)}>
            {CHART_COUNTRIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        } />
        <div className="card !p-4 space-y-4">
          {chartsLoading && !trend && <RowsSkeleton n={4} />}
          {trend && (
            <>
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-2xl p-3" style={{ background: 'var(--s2)' }}>
                  <p className="text-[10px] font-bold tracking-widest uppercase" style={{ color: 'var(--m)' }}>N.º 1</p>
                  <p className="text-sm font-semibold mt-1 line-clamp-2 leading-snug">{trend.n1?.title}</p>
                  <p className="text-[11px] truncate" style={{ color: 'var(--m)' }}>{trend.n1?.artist}</p>
                </div>
                <div className="rounded-2xl p-3" style={{ background: 'var(--s2)' }}>
                  <p className="text-[10px] font-bold tracking-widest uppercase" style={{ color: 'var(--m)' }}>Artista del momento</p>
                  <p className="text-sm font-semibold mt-1 line-clamp-2 leading-snug">{trend.topA?.[0] || '—'}</p>
                  <p className="text-[11px]" style={{ color: 'var(--m)' }}>{trend.topA ? `${trend.topA[1]} en el top ${trend.total}` : ''}</p>
                </div>
                <div className="rounded-2xl p-3" style={{ background: 'var(--s2)' }}>
                  <p className="text-[10px] font-bold tracking-widest uppercase" style={{ color: 'var(--m)' }}>Género dominante</p>
                  <p className="text-sm font-semibold mt-1 line-clamp-2 leading-snug">{trend.topG?.[0] || '—'}</p>
                  <p className="text-[11px]" style={{ color: 'var(--m)' }}>{trend.topG ? `${trend.topG[1]} de ${trend.total} temas` : ''}</p>
                </div>
              </div>
              <div>
                {charts.slice(0, 5).map((c) => (
                  <SongRow key={c.id} n={c.rank} art={c.art} title={c.title} sub={c.artist}
                    active={false} loading={resolvingId === c.id} onPlay={() => playEntry(c)}
                    onMenu={() => openMenu({ ...c, source: 'YouTube' }, charts, { kind: 'chart', onPlay: playEntry })} />
                ))}
              </div>
            </>
          )}
          {!chartsLoading && !trend && <p className="text-sm" style={{ color: 'var(--m)' }}>No se pudo cargar el top de {countryName}. Prueba con otro país.</p>}
        </div>
      </section>

      {/* ===== Selecciones rápidas ===== */}
      {quick.length > 0 && (
        <Section title="Selecciones rápidas" sub={(recs || []).length ? 'Basadas en lo que más escuchas' : 'Lo que más suena ahora'}>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
            {quick.map((t) => {
              const on = p.track?.id === t.id;
              return (
                <button key={t.id} onClick={() => play(t)} className="flex items-center gap-3 rounded-xl overflow-hidden text-left active:scale-[.98] transition pr-2"
                  style={{ background: on ? 'color-mix(in srgb, var(--a) 18%, var(--s2))' : 'var(--s2)' }} aria-label={`Reproducir ${t.title}`}>
                  <Cover src={t.art} className="w-14 h-14 shrink-0" />
                  <span className="min-w-0 py-1">
                    <span className="block text-[13px] font-semibold line-clamp-2 leading-tight" style={{ color: on ? 'var(--a)' : undefined }}>{t.title}</span>
                    <span className="block text-[11px] truncate" style={{ color: 'var(--m)' }}>{t.artist}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </Section>
      )}

      {/* ===== Descubrimiento rápido ===== */}
      <Section title="Descubrimiento rápido" sub="Música distinta cada vez" action={
        <button className="text-xs px-3 py-2 rounded-full inline-flex items-center gap-1.5" style={{ background: 'var(--s2)', color: 'var(--m)' }} onClick={reshuffle} aria-label="Mezclar descubrimiento">
          <Shuffle size={13} /> Mezclar
        </button>
      }>
        {discover.length ? (
          <Shelf>
            {discover.map((t) => (
              <SquareCard key={t.id} art={t.art} title={t.title} sub={t.artist} label={`Reproducir ${t.title}`}
                active={p.track?.id === t.id} playing={p.playing} badge={t.official ? 'Oficial' : undefined} onClick={() => play(t, discover)} />
            ))}
          </Shelf>
        ) : (randomLoading ? <ShelfSkeleton n={5} /> : <p className="text-sm" style={{ color: 'var(--m)' }}>Toca Mezclar para traer canciones.</p>)}
      </Section>

      {/* ===== Canciones y álbumes populares ===== */}
      {(popular.length > 0 || (popAlbums || []).length > 0) && (
        <section className="space-y-7">
          <SectionTitle title="Populares ahora" sub="Los más escuchados del mundo" className="!mb-0" />
          {popular.length > 0 && (
            <div>
              <p className="text-sm font-semibold mb-2" style={{ color: 'var(--m)' }}>Canciones</p>
              <Shelf>
                {popular.map((t) => (
                  <SquareCard key={t.id} art={t.art} title={t.title} sub={t.artist} badge={t.rank ? `#${t.rank}` : undefined} label={`Reproducir ${t.title}`}
                    spinning={resolvingId === t.id} onClick={() => playEntry(t)} />
                ))}
              </Shelf>
            </div>
          )}
          {(popAlbums || []).length > 0 && (
            <div>
              <p className="text-sm font-semibold mb-2" style={{ color: 'var(--m)' }}>Álbumes</p>
              <Shelf>
                {popAlbums.map((a) => (
                  <SquareCard key={a.ref} art={a.art} title={a.title} sub={a.artist} badge={a.year || undefined} onClick={() => nav(albumPath(a))} />
                ))}
              </Shelf>
            </div>
          )}
        </section>
      )}

      {/* ===== Categorías ===== */}
      <Section title="Categorías">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          {CATEGORIES.map(([name, query, bg, term]) => (
            <button key={name} onClick={() => openCategory(name)}
              className="cat-btn rounded-[1.25rem] px-4 h-20 flex flex-col items-center justify-center text-center text-white relative overflow-hidden" style={{ background: bg }}>
              <span className="cat-glow" aria-hidden="true" />
              <span className="relative text-lg font-bold leading-tight tracking-wide" style={{ textShadow: '0 2px 10px rgba(0,0,0,.45)' }}>{name}</span>
              <Play size={15} className="cat-play absolute top-2.5 right-2.5" fill="currentColor" />
            </button>
          ))}
        </div>
      </Section>
    </div>
  );
}
