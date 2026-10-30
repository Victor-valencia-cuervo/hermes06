import { useMemo } from 'react';
import { Play, Pause, Loader2, Plus, Shuffle, Heart } from 'lucide-react';
import Cover from '../../components/Cover';
import Marquee from '../../components/Marquee';
import { Section, SectionTitle, Shelf, SquareCard, SongRow, ShelfSkeleton, RowsSkeleton } from './ui';
import { PlaylistCard, RoomPlCard } from './RoomCards';
import VideoLayer from '../../components/VideoLayer';
import useStore from '../../hooks/useStore';
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

/** Hero: lo que suena ahora. Con video, funciona como la extensión "Ambient light for YouTube": el MISMO video se duplica
 *  detrás, muy desenfocado y con cristal, y su luz sale por todos los lados siguiendo el video en vivo. El video de
 *  enfrente queda limpio (sin nada encima, para poder leer la letra) y el título, el artista y los botones van debajo. */
function Hero({ p, feat, onPlayFeat, resolving }) {
  const [heroVideo] = useStore('h_hero_video', true); // video de la canción como fondo (Ajustes)
  const t = p.track || feat;
  const live = !!p.track;
  const videoBg = !!t && heroVideo && live && t.source === 'YouTube' && !!t.videoId;
  if (!t) return <div className="h-60 rounded-[2rem] animate-pulse" style={{ background: 'var(--s2)' }} />;
  const go = () => { if (live) p.toggle(); else onPlayFeat(feat); };
  const vid = (extra = {}) => (
    <div className="absolute inset-0" style={extra}>
      <VideoLayer key={t.videoId} videoId={t.videoId} playing={p.playing} getTime={() => p.getCurrentTime?.() || p.time?.cur || 0} onFail={() => {}} />
    </div>
  );
  return (
    <section className="relative overflow-hidden rounded-[2rem] text-white" style={{ background: '#0b0b0e', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.1)' }}>
      {/* Luz ambiental: el video (o la carátula) duplicado, a pantalla completa, muy difuminado y suave */}
      <div aria-hidden="true" className="absolute inset-0 overflow-hidden pointer-events-none">
        {videoBg
          ? vid({ filter: 'blur(38px) saturate(1.08) brightness(.95)', transform: 'scale(1.45)', opacity: 0.62 })
          : t.art && <img src={t.art} alt="" className="absolute inset-0 w-full h-full object-cover" style={{ filter: 'blur(38px) saturate(1.05)', transform: 'scale(1.5)', opacity: 0.6 }} />}
        <div className="absolute inset-0 backdrop-blur-2xl" style={{ background: 'linear-gradient(180deg, rgba(10,10,14,.12), rgba(10,10,14,.34))' }} />
      </div>

      <div className="relative p-3 sm:p-4">
        {/* Video limpio: nada encima, se lee todo lo que tenga el video */}
        {videoBg && (
          <div className="relative aspect-video lg:aspect-[2.2/1] rounded-[1.4rem] overflow-hidden bg-black" style={{ boxShadow: '0 10px 34px -12px rgba(0,0,0,.55), 0 0 0 1px rgba(255,255,255,.1)' }}>
            {t.art && <img src={t.art} alt="" className="absolute inset-0 w-full h-full object-cover" />}
            {vid()}
          </div>
        )}
        <div className={`flex items-center gap-3 ${videoBg ? 'pt-3.5 px-1' : 'py-2 px-1'}`}>
          <div className="flex-1 min-w-0">
            <p className="text-[10.5px] font-bold tracking-[0.25em] uppercase opacity-80 flex items-center gap-2">
              {live && p.playing && <span className="inline-block w-1.5 h-1.5 rounded-full bg-white animate-pulse" />}
              {live ? (p.playing ? 'Sonando ahora' : 'En pausa') : 'Para empezar'}
            </p>
            <h3 className={`serif font-semibold leading-[1.1] mt-1 line-clamp-2 ${videoBg ? 'text-xl sm:text-2xl' : 'text-2xl sm:text-4xl'}`} title={t.title}>{t.title}</h3>
            <p className="mt-0.5 text-sm opacity-80 line-clamp-1" title={t.artist}>{t.artist}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button onClick={go} disabled={resolving} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white text-black font-semibold text-sm active:scale-95 transition-transform">
                {resolving ? <Loader2 size={16} className="animate-spin" /> : live && p.playing ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
                {live ? (p.playing ? 'Pausar' : 'Continuar') : 'Reproducir'}
              </button>
              {live && <button onClick={() => p.openFull?.()} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-sm border border-white/30 backdrop-blur active:scale-95 transition-transform">Abrir reproductor</button>}
            </div>
          </div>
          <Cover src={t.art} className={`rounded-2xl shadow-xl shrink-0 ${videoBg ? 'w-16 h-16 sm:w-24 sm:h-24' : 'w-24 h-24 sm:w-36 sm:h-36 sm:rounded-3xl'} ${live && p.playing ? 'breathe' : ''}`} iconSize={30} />
        </div>
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
            className="snap-start w-[10.25rem] sm:w-[12.5rem] shrink-0 text-left group">
            <span className="grid place-items-center w-[10.25rem] h-[10.25rem] sm:w-[12.5rem] sm:h-[12.5rem] rounded-2xl transition group-active:scale-95"
              style={{ border: '2px dashed var(--bd)', background: 'var(--s)' }}>
              <span className="w-12 h-12 rounded-full grid place-items-center text-white" style={{ background: 'var(--a)' }}><Plus size={24} /></span>
            </span>
            <p className="text-[15px] font-semibold mt-2">Crear playlist</p>
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
              <div key={colIdx} className="w-[88vw] max-w-[380px] shrink-0 snap-start space-y-0">
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
        {chartsLoading && !charts?.length && <ShelfSkeleton n={5} />}
        {!!charts?.length && (
          <Shelf>
            {charts.slice(0, 12).map((c) => (
              <SquareCard key={c.id} art={c.art} title={c.title} sub={c.artist} badge={c.rank ? `#${c.rank}` : undefined} label={`Reproducir ${c.title}`}
                spinning={resolvingId === c.id} onClick={() => playEntry(c)} />
            ))}
          </Shelf>
        )}
        {!chartsLoading && !charts?.length && <p className="text-sm" style={{ color: 'var(--m)' }}>No se pudo cargar el top de {countryName}. Prueba con otro país.</p>}
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
                  <Cover src={t.art} className="w-16 h-16 shrink-0" />
                  <span className="min-w-0 flex-1 py-1">
                    <Marquee className="text-[13px] font-semibold leading-tight" style={{ color: on ? 'var(--a)' : undefined }}>{t.title}</Marquee>
                    <Marquee className="text-[12px]" style={{ color: 'var(--m)' }}>{t.artist}</Marquee>
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
