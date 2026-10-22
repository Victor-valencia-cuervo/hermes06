import { useEffect, useMemo, useState } from 'react';
import { Play, Loader2, Radio, SearchX } from 'lucide-react';
import TrackRow from '../../components/TrackRow';
import Cover from '../../components/Cover';
import { Section, Shelf, SquareCard, ArtistBubble, SongRow, BackBar, Chips, ShelfSkeleton, RowsSkeleton } from './ui';
import { bestArtistFor, getArtistBundle, artistPath, albumPath, compactNum } from '../../services/catalog';
import { isNow } from './helpers';
import { setPageContext } from '../../lib/playContext';

const TABS = [['all', 'Todo'], ['songs', 'Canciones'], ['artists', 'Artistas'], ['albums', 'Álbumes'], ['videos', 'Videos']];

/** Resultados de búsqueda estilo Spotify: mejor resultado, canciones, artistas con foto real,
 *  álbumes y últimos lanzamientos en carruseles, y debajo las canciones y videos que coinciden. */
export default function SearchResults({ q, cat, catLoading, videos, videosLoading, fuente, ctx, fallback }) {
  const { p, nav, playEntry, resolvingId, openMenu, onBack } = ctx;
  const [tab, setTab] = useState('all');
  useEffect(() => { setTab('all'); }, [q]);
  useEffect(() => { setPageContext({ from: 'Buscar', title: q }); return () => setPageContext(null); }, [q]);

  const best = useMemo(() => bestArtistFor(q, cat.artists), [q, cat.artists]);
  const [bundle, setBundle] = useState(null);
  useEffect(() => {
    setBundle(null);
    if (!best) return undefined;
    let dead = false;
    getArtistBundle(best.ref).then((b) => { if (!dead) setBundle(b); }).catch(() => {});
    return () => { dead = true; };
  }, [best?.ref]); // eslint-disable-line react-hooks/exhaustive-deps

  // Canciones: las del artista buscado primero (como Spotify), después el resto.
  const tracks = useMemo(() => {
    if (!best) return cat.tracks;
    const mine = cat.tracks.filter((t) => t.artistRef === best.ref);
    const rest = cat.tracks.filter((t) => t.artistRef !== best.ref);
    return [...mine, ...rest];
  }, [cat.tracks, best]);

  const latest = bundle?.latest || [];
  const latestRefs = new Set(latest.map((a) => a.ref));
  const albumsRest = cat.albums.filter((a) => !latestRefs.has(a.ref));
  const hasAny = cat.artists.length || cat.albums.length || cat.tracks.length || videos.length;
  const loading = catLoading && !hasAny;

  const trackRow = (t, i, list, n) => {
    const on = isNow(p.track, t);
    return (
      <SongRow key={t.id} n={n} art={t.art} title={t.title} sub={`${t.artist}${t.album ? ` · ${t.album}` : ''}`} duration={t.duration} explicit={t.explicit}
        active={on} playing={p.playing} loading={resolvingId === t.id}
        onPlay={() => (on ? p.openFull?.() : playEntry(t))}
        onMenu={() => openMenu({ ...t, source: 'YouTube' }, list, { kind: 'chart', onPlay: playEntry })} />
    );
  };

  const artistsShelf = (list, sizeLg) => (
    <Shelf>{list.map((a) => <ArtistBubble key={a.ref} artist={a} size={sizeLg ? 'lg' : 'md'} onClick={() => nav(artistPath(a))} />)}</Shelf>
  );
  const albumCards = (list) => list.map((a) => (
    <SquareCard key={a.ref} art={a.art} title={a.title} sub={`${a.year || ''}${a.year && a.artist ? ' · ' : ''}${a.artist}`} onClick={() => nav(albumPath(a))} />
  ));

  const videosBlock = !!videos.length && (
    <Section title="Videos" sub={fuente === 'audius' ? 'Audius · completas' : 'Toca uno y la radio sigue'}>
      <div className="card !p-2">
        {videos.map((t) => (
          <TrackRow key={t.id} t={t} p={p} list={videos} asRadio={fuente === 'youtube' ? true : undefined}
            onMenu={(x) => openMenu(x, videos, { asRadio: fuente === 'youtube' ? true : undefined, kind: fuente })} />
        ))}
      </div>
    </Section>
  );

  return (
    <div className="space-y-7">
      <BackBar title={`“${q}”`} onBack={onBack} />
      <Chips items={TABS} value={tab} onChange={setTab} />

      {loading && (
        <div className="space-y-7">
          <div className="skel h-44 rounded-3xl" />
          <ShelfSkeleton round n={5} />
          <RowsSkeleton />
        </div>
      )}

      {!loading && !hasAny && !videosLoading && (
        <div className="card text-center py-10">
          <SearchX size={34} className="mx-auto mb-3" style={{ color: 'var(--m)' }} />
          <p className="serif text-2xl font-semibold">Sin resultados para “{q}”</p>
          <p className="text-sm mt-1" style={{ color: 'var(--m)' }}>Revisa la ortografía o prueba con otro artista o canción.</p>
        </div>
      )}
      {!hasAny && !loading && !!fallback?.length && (
        <Section title="Recomendado para ti" sub="Lo que más suena ahora">
          <div className="card !p-2">{fallback.slice(0, 6).map((t, i) => trackRow(t, i, fallback, i + 1))}</div>
        </Section>
      )}

      {/* ---- TODO ---- */}
      {tab === 'all' && !loading && hasAny > 0 && (
        <>
          <div className="grid gap-5 lg:grid-cols-5">
            {/* Mejor resultado */}
            {(best || tracks[0]) && (
              <section className="lg:col-span-2">
                <h3 className="serif text-[2rem] font-semibold leading-none mb-3">Mejor resultado</h3>
                {best ? (
                  <button onClick={() => nav(artistPath(best))} className="w-full text-left rounded-3xl p-5 transition active:scale-[.99] hover:brightness-110" style={{ background: 'var(--s)', border: '1px solid var(--bd)' }}>
                    {best.art
                      ? <img src={best.art} alt="" referrerPolicy="no-referrer" className="w-28 h-28 rounded-full object-cover shadow-xl" />
                      : <span className="w-28 h-28 rounded-full grid place-items-center text-4xl font-bold text-white" style={{ background: 'linear-gradient(135deg, var(--a), #312e81)' }}>{best.name[0]}</span>}
                    <p className="serif text-4xl font-semibold leading-tight mt-4 line-clamp-2">{best.name}</p>
                    <p className="text-sm mt-1" style={{ color: 'var(--m)' }}>Artista{best.fans ? ` · ${compactNum(best.fans)} seguidores` : ''}</p>
                  </button>
                ) : (
                  <button onClick={() => playEntry(tracks[0])} className="w-full text-left rounded-3xl p-5 transition active:scale-[.99]" style={{ background: 'var(--s)', border: '1px solid var(--bd)' }}>
                    <Cover src={tracks[0].art} className="w-28 h-28 rounded-2xl shadow-xl" />
                    <p className="serif text-3xl font-semibold leading-tight mt-4 line-clamp-2">{tracks[0].title}</p>
                    <p className="text-sm mt-1" style={{ color: 'var(--m)' }}>Canción · {tracks[0].artist}</p>
                  </button>
                )}
                {best && !!bundle?.top?.length && (
                  <div className="flex gap-2 mt-3">
                    <button className="btn flex-1" onClick={() => playEntry(bundle.top[0])} disabled={!!resolvingId}>
                      {resolvingId ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} fill="currentColor" />} Escuchar
                    </button>
                    <button className="btn btn-o flex-1" onClick={() => ctx.playRadioOf(bundle.top[0])}><Radio size={16} /> Radio</button>
                  </div>
                )}
              </section>
            )}
            {/* Canciones (las 4 primeras) */}
            {tracks.length > 0 && (
              <section className="lg:col-span-3 min-w-0">
                <h3 className="serif text-[2rem] font-semibold leading-none mb-3">Canciones</h3>
                <div>{tracks.slice(0, 4).map((t, i) => trackRow(t, i, tracks, null))}</div>
              </section>
            )}
          </div>

          {cat.artists.length > 0 && <Section title="Artistas">{artistsShelf(cat.artists.slice(0, 10))}</Section>}

          {latest.length > 0 && (
            <Section title="Últimos lanzamientos" sub={`De ${best?.name} · del más nuevo al más antiguo`}>
              <Shelf>{albumCards(latest)}</Shelf>
            </Section>
          )}

          {albumsRest.length > 0 && <Section title="Álbumes"><Shelf>{albumCards(albumsRest.slice(0, 14))}</Shelf></Section>}

          {tracks.length > 4 && (
            <Section title="Más canciones" sub="Las que coinciden con tu búsqueda">
              <div className="card !p-2">{tracks.slice(4, 24).map((t, i) => trackRow(t, i, tracks, i + 5))}</div>
            </Section>
          )}
          {videosBlock}
          {!videosLoading && !videos.length && !!tracks.length && null}
          {videosLoading && <RowsSkeleton n={3} />}
        </>
      )}

      {/* ---- SOLO CANCIONES ---- */}
      {tab === 'songs' && !loading && (
        <div className="card !p-2">
          {tracks.map((t, i) => trackRow(t, i, tracks, i + 1))}
          {!tracks.length && <p className="text-sm p-3" style={{ color: 'var(--m)' }}>Sin canciones para esta búsqueda.</p>}
        </div>
      )}
      {tab === 'artists' && !loading && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-y-6 gap-x-3 justify-items-center">
          {cat.artists.map((a) => <ArtistBubble key={a.ref} artist={a} size="md" onClick={() => nav(artistPath(a))} />)}
          {!cat.artists.length && <p className="text-sm col-span-full" style={{ color: 'var(--m)' }}>Sin artistas para esta búsqueda.</p>}
        </div>
      )}
      {tab === 'albums' && !loading && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-y-5 gap-x-3 justify-items-center">
          {[...latest.filter((a) => !cat.albums.some((x) => x.ref === a.ref)), ...cat.albums].map((a) => (
            <SquareCard key={a.ref} art={a.art} title={a.title} sub={`${a.year || ''}${a.year && a.artist ? ' · ' : ''}${a.artist}`} onClick={() => nav(albumPath(a))} />
          ))}
          {!cat.albums.length && <p className="text-sm col-span-full" style={{ color: 'var(--m)' }}>Sin álbumes para esta búsqueda.</p>}
        </div>
      )}
      {tab === 'videos' && (
        <>
          {videosBlock}
          {videosLoading && <RowsSkeleton n={4} />}
          {!videosLoading && !videos.length && <p className="text-sm" style={{ color: 'var(--m)' }}>Sin videos para esta búsqueda.</p>}
        </>
      )}
      {tab === 'songs' && videosBlock}
    </div>
  );
}
