import { useMemo, useState } from 'react';
import { Search, Plus, LayoutGrid, List, Heart, Pin, Play } from 'lucide-react';
import Cover from '../../components/Cover';
import Marquee from '../../components/Marquee';
import TrackRow from '../../components/TrackRow';
import { Chips, Section } from './ui';
import useStore from '../../hooks/useStore';
import { getFollowed } from '../../lib/follow';
import { FAV_ART, playlistArt } from '../../lib/vectorArt';
import { artistPath, albumPath } from '../../services/catalog';

const FILTERS = [['all', 'Todo'], ['playlists', 'Playlists'], ['artists', 'Artistas'], ['albums', 'Álbumes']];

/** Tu biblioteca (estilo Spotify): Favoritos fijado arriba, tus playlists, artistas que sigues y álbumes de tus favoritas.
 *  Cuadrícula o lista; al final, tus canciones favoritas listas para sonar. */
export default function LibraryPage({ p, playlists = [], plStats = {}, nav, onCreate, openPl, openMenu }) {
  const [filter, setFilter] = useState('all');
  const [view, setView] = useStore('h_lib_view', 'list');
  const favs = p.favs || [];
  const grid = view === 'grid';

  const items = useMemo(() => {
    const out = [];
    out.push({ key: 'fav', type: 'playlists', pinned: true, title: 'Tus Me Gusta', sub: `Playlist · ${favs.length} canciones`, art: FAV_ART, onOpen: () => openPl('fav') });
    [...playlists].sort((a, b) => ((plStats[b.id] || 0) - (plStats[a.id] || 0)) || (b.tracks.length - a.tracks.length)).forEach((pl) => out.push({
      key: pl.id, type: 'playlists', title: pl.name, sub: `Playlist · ${pl.tracks.length} canciones`, art: pl.tracks[0]?.art || playlistArt(pl.name, pl.color), onOpen: () => openPl(pl.id),
    }));
    getFollowed().forEach((a) => out.push({ key: `a-${a.ref}`, type: 'artists', round: true, title: a.name, sub: 'Artista', art: a.art, onOpen: () => nav(artistPath(a)) }));
    const seen = new Set();
    favs.forEach((t) => {
      if (!t.albumRef || seen.has(t.albumRef) || !t.album) return; seen.add(t.albumRef);
      out.push({ key: `al-${t.albumRef}`, type: 'albums', title: t.album, sub: `Álbum · ${t.artist}`, art: t.art, onOpen: () => nav(albumPath({ ref: t.albumRef })) });
    });
    return out;
  }, [favs, playlists, plStats]); // eslint-disable-line react-hooks/exhaustive-deps
  const shown = items.filter((i) => filter === 'all' || i.type === filter);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between pt-1">
        <h2 className="serif text-4xl tracking-wide">Biblioteca</h2>
        <div className="flex items-center gap-1">
          <button className="ico-btn" aria-label="Buscar música" onClick={() => nav('/musica/buscar')}><Search size={21} /></button>
          <button className="ico-btn" aria-label="Crear playlist" onClick={onCreate}><Plus size={23} /></button>
        </div>
      </div>
      <Chips items={FILTERS} value={filter} onChange={setFilter} />
      <div className="flex items-center justify-between px-0.5">
        <span className="text-[13px] font-semibold" style={{ color: 'var(--m)' }}>Recientes</span>
        <button className="ico-btn !w-9 !h-9" aria-label={grid ? 'Ver como lista' : 'Ver como cuadrícula'} onClick={() => setView(grid ? 'list' : 'grid')}>{grid ? <List size={18} /> : <LayoutGrid size={18} />}</button>
      </div>

      {grid ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-3 gap-y-5">
          {shown.map((i) => (
            <button key={i.key} onClick={i.onOpen} className="text-left active:scale-[.97] transition-transform min-w-0">
              <Cover src={i.art} alt="" className={`w-full aspect-square shadow-lg ${i.round ? 'rounded-full' : 'rounded-2xl'}`} iconSize={30} />
              <Marquee className={`text-[14px] font-semibold mt-2 ${i.round ? 'text-center' : ''}`}>{i.title}</Marquee>
              <p className={`text-[12px] truncate ${i.round ? 'text-center' : ''}`} style={{ color: 'var(--m)' }}>{i.sub}</p>
            </button>
          ))}
        </div>
      ) : (
        <div className="space-y-0.5">
          {shown.map((i) => (
            <button key={i.key} onClick={i.onOpen} className="w-full flex items-center gap-3.5 px-1.5 py-2 text-left rounded-2xl hover:bg-[var(--s2)] active:scale-[.99] transition">
              <Cover src={i.art} alt="" className={`w-16 h-16 shrink-0 ${i.round ? 'rounded-full' : 'rounded-xl'}`} iconSize={22} />
              <span className="flex-1 min-w-0">
                <Marquee className="text-[15px] font-semibold">{i.title}</Marquee>
                <span className="flex items-center gap-1.5 text-[12.5px] mt-0.5" style={{ color: 'var(--m)' }}>
                  {i.pinned && <Pin size={12} style={{ color: 'var(--a)' }} fill="currentColor" />}<span className="truncate">{i.sub}</span>
                </span>
              </span>
            </button>
          ))}
        </div>
      )}
      {!shown.length && <p className="text-sm px-1" style={{ color: 'var(--m)' }}>Aquí aparecerán los {filter === 'artists' ? 'artistas que sigas' : filter === 'albums' ? 'álbumes de tus favoritas' : 'elementos de tu biblioteca'}.</p>}

      {(filter === 'all' || filter === 'playlists') && (
        <Section title="Canciones favoritas" action={favs.length > 0 ? <button className="inline-flex items-center gap-1.5 text-xs px-3 py-2 rounded-full font-semibold" style={{ background: 'var(--a)', color: '#fff' }} onClick={() => p.play(favs[0], favs)}><Play size={12} fill="currentColor" /> Reproducir</button> : null}>
          {favs.length ? (
            <div className="space-y-0.5">{favs.slice(0, 8).map((t) => <TrackRow key={t.id} t={t} p={p} list={favs} onMenu={(x) => openMenu(x, favs, { kind: 'fav' })} />)}</div>
          ) : (
            <p className="text-sm flex items-center gap-2" style={{ color: 'var(--m)' }}><Heart size={16} /> Dale corazón a lo que te guste y aparece aquí.</p>
          )}
          {favs.length > 8 && <button className="mt-2 text-sm font-semibold px-1" style={{ color: 'var(--a)' }} onClick={() => openPl('fav')}>Ver todas ({favs.length})</button>}
        </Section>
      )}
    </div>
  );
}
