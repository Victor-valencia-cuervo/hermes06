import { useState, useEffect, useRef, useMemo } from 'react';
import {
  Search, AlertTriangle, BadgeCheck, Check, Loader2, Play, Plus, Pencil,
  Trash2, X, ListMusic, History, Sparkles, Disc3, Shuffle, LayoutGrid,
  TrendingUp, Heart, ChevronLeft, Radio, Pause, User, Library, MessageCircle,
  FolderOpen, HardDrive, Trophy, Users, Download, Dumbbell, Wind, BookOpen, PartyPopper, Car, ArrowUpDown, MoreVertical, ImageIcon, RefreshCw,
  Radar, FolderSearch, RotateCw,
} from 'lucide-react';
import Cover from '../components/Cover';
import TrackRow from '../components/TrackRow';
import TrackMenu from '../components/TrackMenu';
import PlaylistHero from '../components/PlaylistHero';
import RoomIcon from '../components/RoomIcon';
import useArtColors from '../hooks/useArtColors';
import { fmtTime } from '../lib/format';
import usePlaylists from '../hooks/usePlaylists';
import useStore from '../hooks/useStore';
import { searchYouTube, rankCandidates, filterPublic, resolveOfficial, getSuggestions, prewarmYouTube } from '../services/youtube';
import { searchTracks as searchAudius, trendingTracks as trendingAudius } from '../services/audius';
import { topSongs, newMusic, CHART_COUNTRIES } from '../services/charts';
import { getArtistProfile, getAlbumTracks, getCategoryPack } from '../services/artist';
import { notifyJob } from '../lib/notify';
import { DL_TOOLS, videoUrlOf } from '../lib/dltools';
import { loadRoomPlaylists, loadRooms, loadProfileCloud } from '../services/social';
import SpotifyPanel from '../components/SpotifyPanel';
import { enrichOnlineCovers } from '../services/covers';

const compact = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}K` : String(n || 0));

const CATEGORIES = [
  ['Pop', 'top pop hits 2026', 'linear-gradient(135deg,#7c3aed,#4c1d95)', 'pop hits'],
  ['Electrónica', 'electronic dance music hits', 'linear-gradient(135deg,#2563eb,#1e3a8a)', 'electronic dance music'],
  ['Hip-Hop', 'hip hop hits 2026', 'linear-gradient(135deg,#ea580c,#7c2d12)', 'hip hop hits'],
  ['Clásica', 'classical music best', 'linear-gradient(135deg,#4b5563,#111827)', 'classical music'],
  ['Rock', 'rock hits clasicos y nuevos', 'linear-gradient(135deg,#dc2626,#450a0a)', 'rock hits'],
  ['Salsa', 'salsa clasica y nueva', 'linear-gradient(135deg,#f59e0b,#78350f)', 'salsa'],
  ['Reguetón', 'reggaeton hits 2026', 'linear-gradient(135deg,#db2777,#500f28)', 'reggaeton'],
  ['Urbano', 'musica urbana latina hits', 'linear-gradient(135deg,#059669,#022c22)', 'musica urbana latina'],
  ['Vallenato', 'vallenato clasicos y nuevos', 'linear-gradient(135deg,#eab308,#422006)', 'vallenato'],
  ['Phonk', 'phonk drift music', 'linear-gradient(135deg,#6d28d9,#0f0f0f)', 'phonk'],
];

// [etiqueta, búsqueda por género (corta, la que sí responde), icono, degradado]
const MOODS = [
  ['Para entrenar', 'phonk workout', Dumbbell, 'linear-gradient(135deg,#ef4444,#7f1d1d)'],
  ['Para relajar', 'acoustic chill', Wind, 'linear-gradient(135deg,#06b6d4,#164e63)'],
  ['Para estudiar', 'lofi study', BookOpen, 'linear-gradient(135deg,#8b5cf6,#2e1065)'],
  ['De fiesta', 'reggaeton fiesta', PartyPopper, 'linear-gradient(135deg,#ec4899,#831843)'],
  ['Románticas', 'bachata romantica', Heart, 'linear-gradient(135deg,#f43f5e,#4c0519)'],
  ['Para el carro', 'pop road trip', Car, 'linear-gradient(135deg,#f59e0b,#78350f)'],
];

/** Hero: lo que suena ahora, o una sugerencia destacada. */
function Hero({ p, feat, playEntry, resolving }) {
  const t = p.track || feat;
  if (!t) return <div className="h-52 rounded-[2rem] animate-pulse" style={{ background: 'var(--s2)' }} />;
  const live = !!p.track;
  const go = () => {
    if (live) p.toggle();
    else if (feat.rank != null || feat.artist && !feat.videoId && !feat.src) playEntry(feat);
    else (p.playRadio ? p.playRadio(feat) : p.play(feat));
  };
  return (
    <section className="relative overflow-hidden rounded-[2rem] min-h-[13.5rem] sm:min-h-[16rem] flex items-end text-white"
      style={{ background: '#111' }}>
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
            <button onClick={go} disabled={resolving}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white text-black font-semibold text-sm active:scale-95 transition-transform">
              {resolving ? <Loader2 size={16} className="animate-spin" /> : live && p.playing ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
              {live ? (p.playing ? 'Pausar' : 'Continuar') : 'Reproducir'}
            </button>
            {live && (
              <button onClick={() => p.startRadio?.(p.track)} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-sm border border-white/35 backdrop-blur active:scale-95 transition-transform">
                <Radio size={15} /> Radio similar
              </button>
            )}
          </div>
        </div>
        <Cover src={t.art} className={`hidden sm:block w-40 h-40 rounded-3xl shadow-2xl shrink-0 ${live && p.playing ? 'breathe' : ''}`} iconSize={40} />
      </div>
    </section>
  );
}

function Meta({ t }) {
  const parts = [
    t.duration ? fmtTime(t.duration) : '',
    t.views ? `${compact(t.views)} vistas` : '',
    t.official ? 'Oficial' : t.source === 'YouTube' ? 'YouTube' : t.source || '',
    t.full === false ? 'vista previa 30s' : 'completa',
  ].filter(Boolean);
  if (!parts.length) return null;
  return (
    <p className="text-[11px] pl-[3.75rem] leading-relaxed break-words" style={{ color: 'var(--m)' }}>
      {t.official && <BadgeCheck size={11} className="inline mr-1 -mt-0.5" style={{ color: 'var(--a)' }} />}
      {parts.join(' · ')}
    </p>
  );
}

function Section({ icon: I, title, action, children }) {
  return (
    <section>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xl font-semibold flex items-center gap-2">
          {I && <I size={18} style={{ color: 'var(--a)' }} />}{title}
        </h3>
        {action}
      </div>
      {children}
    </section>
  );
}

/** Pantalla dedicada de búsqueda: entra con animación, despeja la pantalla,
 * muestra el historial acomodado y predicciones en vivo al escribir. */
function SearchOverlay({ q, onType, sugs, loading, onPick, onSubmit, onClose,
  hist, onPickHist, onDelHist, onClearHist, inputRef }) {
  const typing = q.trim().length >= 2;
  return (
    <div className="fixed inset-0 z-50 modal-in flex flex-col" style={{ background: 'var(--bg)' }} role="dialog" aria-modal="true" aria-label="Buscar música">
      <div className="max-w-3xl w-full mx-auto flex flex-col min-h-0 flex-1 px-4 sm:px-5 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]">
        <form onSubmit={onSubmit} className="flex items-center gap-2 shrink-0">
          <button type="button" className="ico-btn shrink-0" onClick={onClose} aria-label="Cerrar búsqueda"><ChevronLeft size={22} /></button>
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--m)' }} />
            <input ref={inputRef} className="inp !pl-10 !pr-4 !py-4 !text-lg !rounded-2xl" placeholder="Artista o canción…"
              value={q} onChange={(e) => onType(e.target.value)} aria-label="Buscar música" autoComplete="off" />
          </div>
          <button className="btn shrink-0" aria-label="Buscar">
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}Buscar
          </button>
        </form>

        <div className="flex-1 min-h-0 overflow-y-auto mt-3 pb-4">
          {!typing && (
            <>
              <div className="flex items-center justify-between px-1 mb-1.5">
                <p className="text-[11px] font-bold tracking-[0.2em] uppercase" style={{ color: 'var(--m)' }}>Historial de búsqueda</p>
                {!!hist.length && (
                  <button className="text-[11px] underline" style={{ color: 'var(--m)' }} onClick={onClearHist}>Limpiar todo</button>
                )}
              </div>
              {!hist.length && (
                <div className="card text-center">
                  <History size={24} className="mx-auto mb-2" style={{ color: 'var(--a)' }} />
                  <p className="text-sm font-semibold">Sin búsquedas todavía</p>
                  <p className="text-xs" style={{ color: 'var(--m)' }}>Escribe arriba y aparecen predicciones al instante.</p>
                </div>
              )}
              {!!hist.length && (
                <div className="card !p-2">
                  {hist.map((s) => (
                    <div key={s} className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-[var(--s2)]">
                      <History size={15} className="shrink-0" style={{ color: 'var(--m)' }} />
                      <button onClick={() => onPickHist(s)} className="flex-1 min-w-0 text-left text-sm truncate" title={s}>{s}</button>
                      <button className="ico-btn shrink-0" aria-label={`Borrar ${s}`} onClick={() => onDelHist(s)}><X size={14} /></button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {typing && (
            <>
              <p className="text-[11px] font-bold tracking-[0.2em] uppercase px-1 mb-1.5" style={{ color: 'var(--m)' }}>Predicciones</p>
              {!sugs.length && (
                <p className="text-xs px-1 py-3" style={{ color: 'var(--m)' }}>Escribe al menos 2 letras…</p>
              )}
              {!!sugs.length && (
                <div className="card !p-2">
                  {sugs.map((s, i) => (
                    <button key={`${s.label}-${i}`} type="button" onClick={() => onPick(s.label)}
                      className="w-full flex items-center gap-2.5 px-3 py-3 text-sm text-left rounded-xl hover:bg-[var(--s2)] active:scale-[.99] transition">
                      {s.from === 'web' ? <Search size={15} className="shrink-0" style={{ color: 'var(--a)' }} /> : <History size={15} className="shrink-0" style={{ color: 'var(--m)' }} />}
                      <span className="truncate flex-1" title={s.label}>{s.label}</span>
                      <ChevronLeft size={14} className="rotate-180 shrink-0" style={{ color: 'var(--m)' }} />
                    </button>
                  ))}
                </div>
              )}
              <button className="btn w-full mt-3" onClick={onSubmit}>
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />} Buscar “{q.trim().slice(0, 30)}”
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/** Selector de fuente: texto Local | YouTube | Audius; la activa toma el color de la canción. */
function FuenteTabs({ fuente, setFuente, art }) {
  const colors = useArtColors(art);
  const accent = colors?.accent || 'var(--a)';
  const tabs = [['local', 'Local'], ['youtube', 'YouTube'], ['audius', 'Audius']];
  return (
    <div className="flex items-center justify-center gap-5 sm:gap-7 select-none" role="group" aria-label="Fuente de música">
      {tabs.map(([id, label]) => {
        const on = fuente === id;
        return (
          <button key={id} onClick={() => setFuente(id)} aria-pressed={on}
            className="relative text-sm font-semibold tracking-wide transition-all pb-1.5 active:scale-95"
            style={on
              ? { color: accent, textShadow: `0 0 14px ${accent}` }
              : { color: 'var(--m)' }}>
            {label}
            {on && <span className="absolute left-1/2 -translate-x-1/2 -bottom-0.5 w-1.5 h-1.5 rounded-full" style={{ background: accent, boxShadow: `0 0 8px ${accent}` }} />}
          </button>
        );
      })}
    </div>
  );
}

/** Tarjeta horizontal (historial, recomendaciones, lanzamientos, aleatorias). Altura fija para alinear el grid. */
function HCard({ art, title, sub, onClick, spinning, badge, onDownload, downloading }) {
  return (
    <button onClick={onClick} aria-label={`Reproducir ${title} de ${sub}`} className="min-w-[8.5rem] w-[8.5rem] sm:min-w-[11rem] sm:w-[11rem] text-left shrink-0 group rounded-2xl focus-visible:outline-2 focus-visible:outline-[var(--a)] focus-visible:outline-offset-2">
      <div className="relative w-[8.5rem] h-[8.5rem] sm:w-[11rem] sm:h-[11rem] rounded-3xl overflow-hidden shadow-lg transition-transform group-hover:-translate-y-0.5 group-active:scale-[.97]">
        <Cover src={art} className="w-full h-full" iconSize={28} alt={title} />
        <span className="absolute inset-0 grid place-items-center bg-black/35 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity" aria-hidden="true">
          {spinning ? <Loader2 size={26} className="animate-spin text-white" /> : <Play size={26} className="text-white" fill="currentColor" />}
        </span>
        {badge && <span className="absolute top-1.5 left-1.5 text-[10px] font-bold px-2 py-1 rounded-full text-white max-w-[calc(100%-12px)] truncate" style={{ background: 'var(--a)' }}>{badge}</span>}
        {onDownload && (
          <span role="button" tabIndex={0} aria-label={`Guardar sin wifi: ${title}`}
            onClick={(e) => { e.stopPropagation(); onDownload(); }}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); e.preventDefault(); onDownload(); } }}
            className="absolute bottom-1.5 right-1.5 w-10 h-10 rounded-full grid place-items-center bg-black/65 text-white active:scale-90 transition focus-visible:outline-2 focus-visible:outline-white"
            title="Guardar sin wifi en Local">
            {downloading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
          </span>
        )}
      </div>
      <p className="text-[15px] font-semibold mt-2 line-clamp-2 break-words min-h-[2.7em] leading-snug" title={title}>{title}</p>
      <p className="text-[13px] line-clamp-1 min-h-[1.4em]" style={{ color: 'var(--m)' }} title={sub}>{sub}</p>
    </button>
  );
}

// Pool para "Canciones aleatorias": queries variadas que sí devuelven música real.
const RANDOM_POOL = [
  'top pop hits 2026',
  'reggaeton hits 2026',
  'rock clasicos en español',
  'salsa clasica hits',
  'musica electronica hits',
  'baladas romanticas en español',
  'hip hop hits 2026',
  'vallenato clasicos',
  'musica urbana latina hits',
  'phonk drift music',
];

/** Tarjeta playlist: collage 2x2 con las 4 primeras carátulas agregadas. */
function PlaylistCard({ pl, plays, onClick }) {
  const arts = (pl.tracks || []).slice(0, 4).map((t) => t.art);
  while (arts.length < 4) arts.push(null);
  return (
    <button onClick={onClick} className="min-w-[9rem] w-[9rem] sm:min-w-[11rem] sm:w-[11rem] text-left shrink-0 group">
      <div className="relative w-[9rem] h-[9rem] sm:w-[11rem] sm:h-[11rem] rounded-3xl overflow-hidden shadow-lg grid grid-cols-2 grid-rows-2 transition-transform group-hover:-translate-y-0.5 group-active:scale-[.97]" style={{ background: 'var(--s2)' }}>
        {arts.map((a, i) => (a
          ? <Cover key={i} src={a} className="w-full h-full min-w-0" iconSize={20} />
          : <div key={i} className="w-full h-full grid place-items-center" style={{ background: 'color-mix(in srgb, var(--a) 22%, var(--s2))' }}><ListMusic size={20} style={{ color: 'var(--a)' }} /></div>
        ))}
        <span className="absolute inset-0 grid place-items-center bg-black/35 opacity-0 group-hover:opacity-100 transition-opacity">
          <Play size={26} className="text-white" />
        </span>
      </div>
      <p className="text-[15px] font-semibold truncate mt-2">{pl.name}</p>
      <p className="text-[13px] truncate" style={{ color: 'var(--m)' }}>
        {(pl.tracks || []).length} temas{(plays || 0) > 0 ? ` · ${plays} escuchas` : ''}
      </p>
    </button>
  );
}

/** Tarjeta de playlist de sala: tocarla abre la lista de una;
 * los otros dos botones (escuchar / chatear) van encogidos. */
function RoomPlCard({ pl, peer, myAvatar, onOpen, onPlay, onChat }) {
  const isDuo = pl.kind === 'dm';
  const title = isDuo ? (peer?.name || peer?.handle || pl.name) : pl.name;
  return (
    <div className="min-w-[13rem] w-[13rem] sm:min-w-[14rem] sm:w-[14rem] shrink-0 card !p-3 flex flex-col gap-2.5">
      <button onClick={onOpen} className="flex items-center gap-2.5 text-left active:opacity-70" aria-label={`Abrir ${title}`}>
        {isDuo ? (
          <span className="flex items-center shrink-0" aria-hidden="true">
            <AvatarImg src={myAvatar} label="Tú" size={40} />
            <AvatarImg src={peer?.avatar} label={title} size={40} overlap />
          </span>
        ) : (
          <RoomIcon room={{ icon: pl.icon, color: pl.color }} size={44} radius={16} />
        )}
        <span className="flex-1 min-w-0">
          <span className="block text-sm font-semibold truncate" title={title}>{title}</span>
          <span className="block text-[11px] truncate" style={{ color: 'var(--m)' }}>
            {isDuo ? 'De a 2' : 'Grupo'}{` · ${(pl.tracks || []).length} temas`}
          </span>
        </span>
        <ChevronLeft size={16} className="rotate-180 shrink-0" style={{ color: 'var(--m)' }} />
      </button>
      <div className="flex gap-2">
        <button className="ico-btn shrink-0" onClick={onPlay} aria-label={`Escuchar ${title}`} title="Escuchar">
          <Play size={16} />
        </button>
        <button className="ico-btn shrink-0" onClick={onChat} aria-label={`Chatear en ${title}`} title="Chatear" style={{ color: 'var(--a)' }}>
          <MessageCircle size={16} />
        </button>
        <button className="btn btn-o flex-1 !py-1.5 !px-3 text-[11px]" onClick={onOpen}>
          Abrir playlist
        </button>
      </div>
    </div>
  );
}

function AvatarImg({ src, label, size = 40, overlap = false }) {
  const st = { width: size, height: size, ...(overlap ? { marginLeft: -size * 0.35, border: '2px solid var(--s)' } : {}) };
  if (src) return <img src={src} alt={label || ''} loading="lazy" className="rounded-full object-cover" style={st} />;
  return (
    <span className="rounded-full grid place-items-center text-white font-bold shrink-0"
      style={{ ...st, background: 'linear-gradient(135deg, var(--a), #4c1d95)', fontSize: size * 0.4 }}>
      {(String(label || '?').trim()[0] || '?').toUpperCase()}
    </span>
  );
}

export default function MusicView({ p, toast, local, auth, onOpenRoom }) {
  const [q, setQ] = useState('');
  const [searchOpen, setSearchOpen] = useState(false); // pantalla dedicada de búsqueda
  const searchInputRef = useRef(null);
  useEffect(() => {
    if (!searchOpen) return undefined;
    const t = setTimeout(() => { try { searchInputRef.current?.focus(); } catch {} }, 80);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => { if (e.key === 'Escape') setSearchOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => { clearTimeout(t); document.body.style.overflow = prev; window.removeEventListener('keydown', onKey); };
  }, [searchOpen]);
  const [mode, setMode] = useState('home'); // home | results | playlist | roompl | album | category
  const [selRoom, setSelRoom] = useState(null); // roomId de playlist de comunidad abierta
  // Menú único (⋮ o long-press) para cualquier canción: { t, list, asRadio, kind }
  // kind: 'local' | 'yt' | 'audius' | 'pl' | 'fav' | 'chart' | 'room'
  const [menuTrack, setMenuTrack] = useState(null);
  const openMenu = (t, list, opts = {}) => setMenuTrack({ t, list: list || [], ...opts });
  const [pendingDel, setPendingDel] = useState(null); // id de carpeta esperando elección de borrado
  const [artBusy, setArtBusy] = useState(null); // {done,total} buscando carátulas
  /** Busca carátulas reales con wifi para la biblioteca local. */
  const buscarCaratulas = async () => {
    if (artBusy || local?.importing) return;
    if (!navigator.onLine) { toast('Necesitas wifi para buscar carátulas', AlertTriangle); return; }
    setArtBusy({ done: 0, total: 0 });
    try {
      const r = await local?.enrichAllArt?.((p) => setArtBusy({ done: p.done, total: p.total }));
      setArtBusy(null);
      if (r?.offline) { toast('Necesitas wifi para buscar carátulas', AlertTriangle); return; }
      if (!r?.total) { toast('Todo con carátula real', Check); return; }
      toast(r.done ? `Carátulas listas: ${r.done} de ${r.total}` : 'Sin carátulas nuevas', r.done ? Check : AlertTriangle);
    } catch {
      setArtBusy(null);
      toast('No se pudo completar', AlertTriangle);
    }
  };
  const [fuenteRaw, setFuenteRaw] = useStore('h_fuente', 'youtube'); // local | youtube | audius
  // Migra valores viejos y guarda la posición actual (persiste en este dispositivo)
  const fuente = fuenteRaw === 'audius' || fuenteRaw === 'local' || fuenteRaw === 'youtube' ? fuenteRaw : 'youtube';
  const setFuente = (v) => setFuenteRaw(v);
  const lampOn = fuente !== 'local';
  const [autoArt, setAutoArt] = useStore('h_auto_art', true); // auto-actualizar carátulas
  // Auto: cada 5 min en Local con wifi, busca carátulas a lo nuevo sin arte real.
  // Nunca junto a un escaneo (comparten red + IndexedDB y se traba todo).
  useEffect(() => {
    if (lampOn || !autoArt) return undefined;
    let dead = false;
    let iv = null;
    const run = () => {
      if (dead || !navigator.onLine || artBusy || local?.importing) return;
      local?.enrichAllArt?.().catch(() => {});
    };
    const t = setTimeout(run, 15000);
    iv = setInterval(run, 5 * 60 * 1000);
    return () => { dead = true; clearTimeout(t); if (iv) clearInterval(iv); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lampOn, autoArt, local?.importing]);
  const [results, setResults] = useState([]);
  const [resultsLabel, setResultsLabel] = useState('');
  const [selCat, setSelCat] = useState(null); // { name, query, bg, term }
  const [catSongs, setCatSongs] = useState([]);
  const [catAlbums, setCatAlbums] = useState([]);
  const [catVideos, setCatVideos] = useState([]);
  const [catLoading, setCatLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [cc, setCc] = useState('CO');
  const [charts, setCharts] = useState([]);
  const [releases, setReleases] = useState([]);
  const [randomSongs, setRandomSongs] = useState([]);
  const [randomLoading, setRandomLoading] = useState(false);
  const [randomKey, setRandomKey] = useState(0);
  const [recs, setRecs] = useState([]);
  const [recAlbums, setRecAlbums] = useState([]);
  const [audTrend, setAudTrend] = useState([]); // tendencias Audius (solo se cargan en esa fuente)
  const [plStats, setPlStats] = useStore('h_pl_stats', {}); // { plId: reproducciones }
  const [artistHit, setArtistHit] = useState(null);
  const [artistTop, setArtistTop] = useState([]);
  const [artistAlbums, setArtistAlbums] = useState([]);
  const [selAlbum, setSelAlbum] = useState(null);
  const [albumBack, setAlbumBack] = useState('home'); // a dónde vuelve el detalle
  const [albumTracks, setAlbumTracks] = useState([]);
  const [albumLoading, setAlbumLoading] = useState(false);
  const [resolvingId, setResolvingId] = useState(null);
  const [selectedPl, setSelectedPl] = useState(null);
  const [addTarget, setAddTarget] = useState(null);
  const [selPls, setSelPls] = useState([]); // multi-seleccion en la hoja de agregar
  useEffect(() => { setSelPls([]); }, [addTarget]);
  const [newPlName, setNewPlName] = useState('');
  const [renaming, setRenaming] = useState(false);
  const [renameVal, setRenameVal] = useState('');
  const [sugs, setSugs] = useState([]); // predicciones (remotas + historial)
  const [sugOpen, setSugOpen] = useState(false);
  const sugTimer = useRef(null);
  const fileRef = useRef(null); // input de carpeta local
  const [localSort, setLocalSort] = useStore('h_local_sort', 'recent'); // recent | title | artist | duration
  const [localTab, setLocalTab] = useStore('h_local_tab', 'songs'); // songs | playlists | covers | add
  const [autoRescan, setAutoRescan] = useStore('h_auto_rescan', true); // actualiza carpetas al entrar (activable)
  const [localShown, setLocalShown] = useState(48);
  const autoRescanDone = useRef(false);
  // Auto-rescan al entrar: en segundo plano (sin barra de progreso ni racha de
  // toasts), solo carpetas con permiso ya concedido (sin pedir nada).
  // Espera a que la app se asiente para no competir con la hidratación.
  useEffect(() => {
    if (autoRescanDone.current || !autoRescan || !local?.ready) return;
    const dirs = local?.dirs || [];
    if (!dirs.length) return;
    autoRescanDone.current = true;
    const t = setTimeout(() => {
      (async () => {
        try {
          if (local?.importing) return;
          let added = 0;
          for (const d of dirs) {
            const h = d.handle;
            if (!h?.queryPermission) continue;
            let granted = false;
            try { granted = (await h.queryPermission({ mode: 'read' }).catch(() => 'prompt')) === 'granted'; } catch { granted = false; }
            if (!granted) continue;
            try {
              const r = await local?.scanDirectory?.(h, null, { silent: true, background: true }).catch(() => null);
              if (r?.busy) break;
              added += r?.added || 0;
            } catch { /* sigue con la siguiente */ }
          }
          if (added > 0) toast?.(`Actualizado: ${added} nueva${added > 1 ? 's' : ''}`, Check);
        } catch { /* silencioso */ }
      })();
    }, 6000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRescan, local?.ready]);
  const [roomPls, setRoomPls] = useState([]);
  const [peers, setPeers] = useState({}); // roomId -> { name, handle, avatar } del otro en DMs
  const myId = auth?.user?.id || null;
  const myAvatar = auth?.user?.user_metadata?.avatar_url || '';
  useEffect(() => {
    let dead = false;
    (async () => {
      const list = await loadRoomPlaylists(myId).catch(() => []);
      if (dead) return;
      setRoomPls(list);
      // Dúos: foto y nombre del otro (perfil nube = espejo de su Google)
      if (myId) {
        const rooms = await loadRooms().catch(() => []);
        if (dead) return;
        const out = {};
        await Promise.all(list.filter((x) => x.kind === 'dm').map(async (x) => {
          const r = rooms.find((r) => r.id === x.roomId);
          const other = r ? (r.member_a === myId ? r.member_b : r.member_a) : null;
          if (!other) return;
          const prof = await loadProfileCloud(other).catch(() => null);
          if (prof && !dead) out[x.roomId] = { name: prof.name || prof.handle || '', handle: prof.handle || '', avatar: prof.avatar || '' };
        }));
        if (!dead) setPeers(out);
      } else if (!dead) setPeers({});
    })();
    return () => { dead = true; };
  }, [myId]);
  const [searchHist, setSearchHist] = useStore('h_search_hist', []);
  const pls = usePlaylists(toast);

  // Predicciones al escribir: en modo local filtra tus archivos;
  // en YouTube, remotas primero e historial como repliegue.
  const onTypeQ = (v) => {
    setQ(v);
    clearTimeout(sugTimer.current);
    if (v.trim().length < 2) { setSugs([]); setSugOpen(false); return; }
    sugTimer.current = setTimeout(async () => {
      const lowL = v.trim().toLowerCase();
      if (!lampOn) {
        const seen = new Set();
        const out = [];
        for (const t of local?.tracks || []) {
          for (const cand of [t.title, t.artist]) {
            if (cand && cand.toLowerCase().includes(lowL)) {
              const k = cand.toLowerCase();
              if (!seen.has(k)) { seen.add(k); out.push({ label: cand, from: 'hist' }); }
            }
          }
          if (out.length >= 8) break;
        }
        setSugs(out);
        setSugOpen(out.length > 0);
        return;
      }
      const seen = new Set();
      const out = [];
      // Sugerencias remotas solo en YouTube (Piped); en Audius solo historial.
      if (fuente === 'youtube') {
        try {
          for (const s of await getSuggestions(v.trim())) {
            const k = s.toLowerCase();
            if (!seen.has(k)) { seen.add(k); out.push({ label: s, from: 'web' }); }
          }
        } catch { /* solo historial */ }
      }
      // Tus búsquedas pasadas que coincidan (siempre disponible, en local)
      const low = v.trim().toLowerCase();
      for (const past of searchHist) {
        if (past.toLowerCase().includes(low)) {
          const k = past.toLowerCase();
          if (!seen.has(k)) { seen.add(k); out.push({ label: past, from: 'search' }); }
        }
        if (out.length >= 8) break;
      }
      for (const h of p.history || []) {
        for (const cand of [h.title, h.artist]) {
          if (cand && cand.toLowerCase().includes(low)) {
            const k = cand.toLowerCase();
            if (!seen.has(k)) { seen.add(k); out.push({ label: cand, from: 'hist' }); }
          }
        }
        if (out.length >= 8) break;
      }
      setSugs(out.slice(0, 8));
      setSugOpen(true);
    }, 300);
  };
  const pickSug = (label) => {
    setSugs([]); setSugOpen(false);
    setQ(label);
    if (lampOn) { setSearchOpen(false); runSearch(label); } // en local, el filtro es en vivo
  };

  // Carga inicial: top + lanzamientos + aleatorias (en paralelo, cada uno con repliegue)
  const loadRandom = async () => {
    setRandomLoading(true);
    try {
      const pool = [...RANDOM_POOL].sort(() => Math.random() - 0.5).slice(0, 3);
      const out = [];
      await Promise.all(pool.map(async (qry) => {
        try {
          const items = await searchYouTube(qry, 5);
          const ranked = rankCandidates(items, { title: qry });
          const pub = await filterPublic(ranked);
          out.push(...pub.filter((x) => (x.duration || 0) < 600).slice(0, 4));
        } catch { /* salta esta query */ }
      }));
      const seen = new Set();
      const final = out.filter((x) => !seen.has(x.id) && seen.add(x.id)).sort(() => Math.random() - 0.5).slice(0, 10);
      setRandomSongs(final);
      enrichOnlineCovers(final, setRandomSongs).catch(() => {});
    } catch { /* sin aleatorias por ahora */ }
    setRandomLoading(false);
  };
  useEffect(() => {
    prewarmYouTube(); // instancia Piped en fondo desde el arranque (primera canción más rápida)
    topSongs('CO', 10).then(setCharts).catch(() => {});
    newMusic('CO', 10).then(setReleases).catch(() => {});
    // Las aleatorias (3 búsquedas + oEmbed) esperan 1.5s: en 4G competían con
    // la primera canción y la dejaban "cargando". La música primero, el resto después.
    const t = setTimeout(() => loadRandom(), 1500);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => { if (randomKey > 0) loadRandom(); }, [randomKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Tendencias Audius: solo se piden al pararse en esa fuente (con cache de 5 min).
  useEffect(() => {
    if (fuente !== 'audius' || audTrend.length) return undefined;
    let dead = false;
    trendingAudius({ limit: 12, time: 'week' }).then((l) => { if (!dead) setAudTrend(l || []); }).catch(() => {});
    return () => { dead = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fuente]);

  // Recomendaciones desde el historial (top artistas escuchados)
  // + álbumes recomendados del artista más escuchado.
  useEffect(() => {
    let dead = false;
    (async () => {
      const count = {};
      for (const h of p.history || []) {
        const a = String(h.artist || '').split(',')[0].trim();
        if (a && a !== 'YouTube' && a !== 'Desconocido') count[a] = (count[a] || 0) + 1;
      }
      const tops = Object.entries(count).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([a]) => a);
      const queries = tops.length ? tops : (charts.slice(0, 3).map((c) => c.artist));
      const out = [];
      await Promise.all(queries.map(async (a) => {
        try {
          const items = await searchYouTube(`${a} greatest hits`, 4);
          const ranked = rankCandidates(items, { artist: a });
          const pub = await filterPublic(ranked);
          if (!dead) out.push(...pub.filter((x) => (x.duration || 0) < 600).slice(0, 3).map((x) => ({ ...x, why: a })));
        } catch { /* salta este artista */ }
      }));
      if (!dead) { const seen = new Set(); setRecs(out.filter((x) => !seen.has(x.id) && seen.add(x.id)).slice(0, 9)); }
    })();
    return () => { dead = true; };
  }, [charts]); // eslint-disable-line react-hooks/exhaustive-deps

  // Álbumes recomendados: del artista más escuchado (o del top si no hay historial).
  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        const count = {};
        for (const h of p.history || []) {
          const a = String(h.artist || '').split(',')[0].trim();
          if (a && a !== 'YouTube' && a !== 'Desconocido') count[a] = (count[a] || 0) + 1;
        }
        const topArtist = Object.entries(count).sort((a, b) => b[1] - a[1])[0]?.[0]
          || charts[0]?.artist || '';
        if (!topArtist) return;
        const prof = await getArtistProfile(topArtist);
        if (dead) return;
        if (prof.artist && prof.albums?.length) {
          setRecAlbums(prof.albums.slice(0, 6).map((a) => ({ ...a, why: prof.artist.name })));
        }
      } catch { /* sin álbumes por ahora */ }
    })();
    return () => { dead = true; };
  }, [charts]); // eslint-disable-line react-hooks/exhaustive-deps

  const runSearch = async (term) => {
    if (!term.trim()) return;
    setSugs([]); setSugOpen(false);
    // Guarda la búsqueda (máx 12, sin duplicados, la reciente primero)
    const clean = term.trim().slice(0, 60);
    setSearchHist((h) => [clean, ...(h || []).filter((x) => x.toLowerCase() !== clean.toLowerCase())].slice(0, 12));
    setLoading(true);
    setArtistHit(null); setArtistTop([]); setArtistAlbums([]);
    // Fuente Audius: canciones completas de catálogo independiente (puede
    // no traer hits comerciales). Suenan directo, sin resolver en YouTube.
    if (fuente === 'audius') {
      try {
        const [tracks, prof] = await Promise.all([
          searchAudius(term.trim(), { limit: 20 }).catch(() => []),
          getArtistProfile(term.trim()).catch(() => ({ artist: null, top: [], albums: [] })),
        ]);
        setResults(tracks || []);
        if (!(tracks || []).length) toast('Audius no trajo nada: prueba con indie o electrónica', AlertTriangle);
        setArtistHit(prof.artist);
        setArtistTop(prof.top || []);
        setArtistAlbums(prof.albums || []);
        setResultsLabel(term.trim());
        setMode('results');
        setSelectedPl(null);
      } catch {
        toast('Audius no responde, intenta de nuevo', AlertTriangle);
      }
      setLoading(false);
      return;
    }
    try {
      // Videos + perfil de artista en paralelo: el perfil nunca frena los videos.
      const [videoRes, prof] = await Promise.all([
        (async () => {
          const items = await searchYouTube(term.trim(), 15);
          const ranked = rankCandidates(items, { title: term.trim(), artist: term.trim() });
          const pub = await filterPublic(ranked);
          return { ranked, pub };
        })(),
        getArtistProfile(term.trim()).catch(() => ({ artist: null, top: [], albums: [] })),
      ]);
      const { ranked, pub } = videoRes;
      if (pub.length) {
        const dropped = ranked.length - pub.length;
        if (dropped > 0) toast(`Se ocultaron ${dropped} no disponibles`);
        setResults(pub);
        // Carátulas originales en segundo plano (no bloquea la lista)
        enrichOnlineCovers(pub, setResults).catch(() => {});
      } else if (ranked.length) {
        toast('Verificación sin respuesta: mostrando sin filtrar', AlertTriangle);
        setResults(ranked);
        enrichOnlineCovers(ranked, setResults).catch(() => {});
      } else {
        setResults([]);
      }
      setArtistHit(prof.artist);
      setArtistTop(prof.top || []);
      setArtistAlbums(prof.albums || []);
      setResultsLabel(term.trim());
      setMode('results');
      setSelectedPl(null);
    } catch {
      toast('YouTube no responde, intenta de nuevo', AlertTriangle);
    }
    setLoading(false);
  };
  const submit = (e) => { e.preventDefault(); if (lampOn) runSearch(q); };

  // Herramienta web para bajar MP3 (ver ../lib/dltools): copia el link y abre
  // la herramienta elegida en Ajustes; el MP3 va a la carpeta escaneada.
  const [dlTool] = useStore('h_dl_tool', 'savefrom');
  /** Descargar MP3 vía web: copia el link y abre la herramienta.
   *  El usuario baja el MP3 en su carpeta escaneada y al entrar aparece en Local. */
  const descargarWeb = async (t) => {
    const url = videoUrlOf(t);
    if (!url) { toast('Este tema no tiene link de YouTube para descargar', AlertTriangle); return; }
    let copied = false;
    try {
      await navigator.clipboard.writeText(url);
      copied = true;
    } catch {
      try {
        const ta = document.createElement('textarea');
        ta.value = url;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        copied = document.execCommand('copy');
        ta.remove();
      } catch { copied = false; }
    }
    const tool = DL_TOOLS[dlTool] || DL_TOOLS.savefrom;
    try { window.open(tool.url, '_blank', 'noopener'); } catch { /* popup bloqueado */ }
    toast(copied
      ? `Link copiado: pégalo en ${tool.name}, baja el MP3 a tu carpeta escaneada`
      : `Copia este link en ${tool.name}: ${url}`, copied ? Check : AlertTriangle);
    if (!copied) {
      try { window.prompt?.(`Copia el link y pégalo en ${tool.name}:`, url); } catch {}
    }
  };
  /** Router de descarga: audio directo (Audius) se baja tal cual;
   *  YouTube va a la herramienta web (el gemelo nunca acertaba y se quitó). */
  const descargarSong = (t) => {
    if (!t) return;
    if (t.src) guardarOffline(t);
    else descargarWeb(t);
  };

  // Descarga directa para oír sin wifi: guarda el audio en tu biblioteca Local.
  // Solo audios directos (Audius/Local). YouTube usa descargarWeb (herramienta externa).
  const [dlId, setDlId] = useState(null);
  const guardarOffline = async (t) => {
    if (!t || dlId) return;
    const src = t.src || '';
    const art = t.art || '';
    if (!src) {
      // Sin audio directo (tema YouTube): va por herramienta web.
      descargarWeb(t);
      return;
    }
    setDlId(t.id);
    try {
      toast('Descargando…');
      let blob = null;
      try {
        const r = await fetch(src);
        if (!r.ok) throw new Error(`http${r.status}`);
        blob = await r.blob();
      } catch (e) {
        const msg = String(e?.message || '');
        if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || e?.name === 'TypeError') {
          toast('El servidor bloqueó la descarga directa: suena con internet, pero no se puede guardar', AlertTriangle);
        } else {
          toast('No se pudo descargar (red)', AlertTriangle);
        }
        return;
      }
      if (!blob?.size) { toast('La descarga llegó vacía, intenta de nuevo', AlertTriangle); return; }
      const mt = blob.type || 'audio/mpeg';
      const ext = mt.includes('flac') ? 'flac' : mt.includes('wav') ? 'wav' : mt.includes('ogg') ? 'ogg' : mt.includes('mp4') || mt.includes('m4a') ? 'm4a' : 'mp3';
      const file = new File([blob], `${t.artist || 'Desconocido'} - ${t.title || 'Tema'}.${ext}`, { type: mt });
      const res = await local?.importFiles([file]).catch(() => null);
      if (res?.added) {
        toast('Guardada en Local: ya suena sin wifi');
        setFuente('local');
        setMode('home');
      } else if ((res?.skipped || 0) > 0 && !res?.added) {
        toast('Esa ya estaba en Local', AlertTriangle);
        setFuente('local');
        setMode('home');
      } else {
        toast('No se pudo guardar en Local', AlertTriangle);
      }
    } catch {
      toast('No se pudo descargar', AlertTriangle);
    } finally {
      setDlId(null);
    }
  };

  /** Descarga una entrada de chart/lanzamiento: la resuelve a video y abre la herramienta web. */
  const downloadEntry = async (entry) => {
    if (!entry || dlId || resolvingId) return;
    setResolvingId(entry.id);
    try {
      const t = await resolveOfficial(entry.artist, entry.title);
      if (!t) { toast('No se encontró versión descargable de ese tema', AlertTriangle); return; }
      setResolvingId(null);
      await descargarWeb(t);
    } catch {
      toast('No se pudo descargar ese tema', AlertTriangle);
    } finally {
      setResolvingId(null);
    }
  };

  /** Resuelve metadata (chart/lanzamiento/álbum) a video oficial y suena en modo radio. */
  const playEntry = async (entry) => {
    if (resolvingId) return;
    setResolvingId(entry.id);
    try {
      const t = await resolveOfficial(entry.artist, entry.title);
      if (!t) { toast('No se encontró versión reproducible', AlertTriangle); return; }
      if (p.playRadio) p.playRadio(t);
      else p.play(t);
      if (!t.official) toast('Versión no oficial (la oficial no está disponible)');
    } catch {
      toast('No se pudo abrir ese tema', AlertTriangle);
    } finally {
      setResolvingId(null);
    }
  };

  /** Abre el detalle de un álbum con sus canciones (vista detalle). */
  const openAlbum = async (album) => {
    if (!album?.collectionId) return;
    setAlbumBack(mode);
    setSelAlbum(album);
    setAlbumTracks([]);
    setMode('album');
    setAlbumLoading(true);
    try {
      const tracks = await getAlbumTracks(album.collectionId, 30);
      setAlbumTracks(tracks);
      if (!tracks.length) toast('Ese álbum no trajo canciones', AlertTriangle);
    } catch {
      toast('No se pudo abrir el álbum', AlertTriangle);
    } finally {
      setAlbumLoading(false);
    }
  };

  /** Reproduce el álbum completo en orden: aviso cargando → listo/fallo. */
  const playAlbum = async (album, tracks) => {
    const list = tracks?.length ? tracks : await getAlbumTracks(album.collectionId, 30);
    if (!list?.length) return toast('Ese álbum no trajo canciones', AlertTriangle);
    if (resolvingId) return;
    setResolvingId(album.id);
    try {
      const job = Promise.all(
        list.map((s) => resolveOfficial(s.artist || album.artist, s.title, 6).catch(() => null)),
      ).then((r) => {
        const ok = r.filter(Boolean);
        if (!ok.length) throw new Error('empty');
        return ok;
      });
      const resolved = await notifyJob(job, {
        loading: { title: 'Buscando el álbum…', description: `Resolviendo ${list.length} temas` },
        ok: (ok) => (ok.length < list.length
          ? { title: 'Álbum casi listo', description: `${ok.length} de ${list.length} tenían versión` }
          : { title: 'Álbum listo', description: `${ok.length} temas en cola` }),
        fail: { title: 'Ese álbum no se dejó', description: 'Prueba con otro' },
      });
      p.play(resolved[0], resolved);
    } catch {
      /* el aviso de fallo ya lo mostró sileo */
    } finally {
      setResolvingId(null);
    }
  };

  /** Radio del artista: top del artista resuelto a YouTube. */
  const playArtistRadio = async () => {
    if (!artistTop.length || !artistHit) return;
    const first = artistTop[0];
    await playEntry({ id: first.id, artist: first.artist, title: first.title });
  };

  /** Abre una categoría como ficha con disco: canciones + álbumes (iTunes)
   *  + videos (YouTube). Si una fuente falla, las otras igual muestran. */
  const openCategory = async (name, query, bg, term) => {
    const cat = { name, query, bg, term: term || query };
    setSelCat(cat);
    setCatSongs([]); setCatAlbums([]); setCatVideos([]);
    setMode('category');
    setCatLoading(true);
    try {
      const [pack, vids] = await Promise.all([
        getCategoryPack(cat.term).catch(() => ({ songs: [], albums: [] })),
        (async () => {
          try {
            const items = await searchYouTube(query, 12);
            return await filterPublic(rankCandidates(items, { title: query }));
          } catch { return []; }
        })(),
      ]);
      setCatSongs(pack.songs || []);
      setCatAlbums(pack.albums || []);
      setCatVideos(vids || []);
      if (!(pack.songs?.length || pack.albums?.length || vids?.length)) {
        toast('Esa categoría no trajo nada, intenta de nuevo', AlertTriangle);
      }
    } finally {
      setCatLoading(false);
    }
  };

  const playPlaylist = (pl) => {
    if (!pl.tracks.length) return toast('Playlist vacía, agrega temas primero', AlertTriangle);
    if (pl.id) setPlStats((s) => ({ ...s, [pl.id]: (s[pl.id] || 0) + 1 }));
    p.play(pl.tracks[0], pl.tracks);
  };

  /** Local en aleatorio: baraja lo visible y suena sin conexión. */
  const playLocalShuffle = () => {
    const pool = (localVisible.length ? localVisible : (local?.tracks || [])).slice();
    if (!pool.length) return toast('Vacío por aquí. Toca Escanear canciones', AlertTriangle);
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    p.play(pool[0], pool);
    toast('Modo aleatorio');
  };

  const createPl = (e) => {
    e?.preventDefault();
    const pl = pls.create(newPlName);
    if (pl) { setNewPlName(''); setSelectedPl(pl.id); setMode('playlist'); }
  };

  const openPl = (id) => { setSelectedPl(id); setMode('playlist'); setRenaming(false); };
  // Me Gusta cuenta como playlist (id 'fav') con su propio detalle.
  const sel = selectedPl === 'fav'
    ? { id: 'fav', name: 'Tus Me Gusta', tracks: p.favs || [] }
    : pls.playlists.find((x) => x.id === selectedPl);
  const isFavPl = sel?.id === 'fav';
  // Customs ordenadas por escuchas (Me Gusta va fija de primera).
  const topPls = [...pls.playlists]
    .sort((a, b) => ((plStats[b.id] || 0) - (plStats[a.id] || 0)) || (b.tracks.length - a.tracks.length))
    .slice(0, 5);

  // --- modo local: filtro en vivo + utilidades de carpeta ---
  const lowQ = q.trim().toLowerCase();
  const localVisible = useMemo(() => {
    const list = ((local?.tracks) || []).filter((t) =>
      !lowQ || `${t.title || ''} ${t.artist || ''}`.toLowerCase().includes(lowQ));
    if (localSort === 'title') return [...list].sort((a, b) => String(a.title).localeCompare(String(b.title), 'es'));
    if (localSort === 'artist') return [...list].sort((a, b) => String(a.artist).localeCompare(String(b.artist), 'es') || String(a.title).localeCompare(String(b.title), 'es'));
    if (localSort === 'duration') return [...list].sort((a, b) => (Number(b.duration) || 0) - (Number(a.duration) || 0));
    // Recientes = orden de llegada al dispositivo (addedAt al importar/descargar).
    // Lo nuevo siempre de primero; desempate por título para orden estable.
    return [...list].sort((a, b) => ((Number(b.addedAt) || 0) - (Number(a.addedAt) || 0))
      || String(a.title || '').localeCompare(String(b.title || ''), 'es'));
  }, [local?.tracks, lowQ, localSort]);
  useEffect(() => { setLocalShown(48); }, [lowQ, localSort, localTab]);
  // Scroll infinito: al ver el final, muestra 48 más (sin botón).
  const moreRef = useRef(null);
  useEffect(() => {
    const el = moreRef.current;
    if (!el || mode !== 'home' || lampOn) return undefined;
    const io = new IntersectionObserver((es) => {
      if (es.some((e) => e.isIntersecting)) setLocalShown((n) => (n < localVisible.length ? n + 48 : n));
    }, { rootMargin: '400px' });
    io.observe(el);
    return () => io.disconnect();
  }, [mode, lampOn, localVisible.length, localTab]);
  const fmtMB = (b) => (b || 0) >= 1048576
    ? `${(b / 1048576).toFixed(1)} MB`
    : `${Math.max(1, Math.round((b || 0) / 1024))} KB`;
  const pickFolder = () => {
    const el = fileRef.current;
    if (!el) return;
    try { el.setAttribute('webkitdirectory', ''); } catch { /* solo archivos */ }
    el.click();
  };
  // Escaneo con 1 toque: pide acceso y busca sola en subcarpetas.
  const scanning = !!local?.scan?.active || !!local?.importing;
  const scanPct = local?.scan?.total
    ? Math.round((local.scan.done / Math.max(1, local.scan.total)) * 100) : 0;
  const handleEscanear = async () => {
    if (scanning) return;
    if (!window.showDirectoryPicker) {
      // iPhone/Firefox: no hay acceso a carpeta, se usa el selector clásico.
      toast('Elige una carpeta y acepta: puedes repetir para agregar varias', Check);
      pickFolder();
      return;
    }
    toast('Elige una carpeta y acepta: se suma a tu lista (puedes agregar varias)', Check);
    await local?.requestScan?.(pickFolder);
  };
  const handleRescan = async () => {
    if (scanning) return;
    await local?.rescanSaved?.();
  };

  return (
    <>
      <h2 className="serif text-4xl tracking-wide mb-1">Música</h2>

      {/* Fuente Local | YouTube | Audius: texto que toma el color de la canción */}
      {mode === 'home' && (
        <FuenteTabs fuente={fuente} setFuente={setFuente} art={p.track?.art} />
      )}

      {mode === 'home' && (fuente === 'youtube' || window.location.hash.includes('spotify')) && (
        <SpotifyPanel p={p} toast={toast} />
      )}

      {!lampOn ? (
        <form onSubmit={submit} className="flex gap-2">
          <div className="relative flex-1">
            <input className="inp" placeholder="Filtrar tu música local…" value={q}
              onChange={(e) => onTypeQ(e.target.value)}
              aria-label="Filtrar música local" autoComplete="off" />
          </div>
        </form>
      ) : (
        <button onClick={() => { setSugs([]); setSugOpen(false); setSearchOpen(true); }}
          className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-left active:scale-[.99] transition"
          style={{ background: 'var(--s2)', border: '1px solid var(--bd)' }} aria-label="Abrir búsqueda">
          <Search size={17} className="shrink-0" style={{ color: 'var(--a)' }} />
          <span className="flex-1 min-w-0 text-sm truncate" style={{ color: q ? 'var(--t)' : 'var(--m)' }}>
            {q || 'Artista o canción…'}
          </span>
          <ChevronLeft size={16} className="rotate-180 shrink-0" style={{ color: 'var(--m)' }} />
        </button>
      )}

      {searchOpen && lampOn && (
        <SearchOverlay
          q={q} onType={onTypeQ} sugs={sugs} loading={loading}
          onPick={pickSug}
          onSubmit={(e) => { e?.preventDefault?.(); if (!q.trim()) return; setSearchOpen(false); runSearch(q); }}
          onClose={() => setSearchOpen(false)}
          hist={searchHist || []}
          onPickHist={(s) => { setQ(s); setSearchOpen(false); runSearch(s); }}
          onDelHist={(s) => setSearchHist((h) => (h || []).filter((x) => x !== s))}
          onClearHist={() => setSearchHist([])}
          inputRef={searchInputRef}
        />
      )}

      {mode === 'results' && (
        <>
          {artistHit && (
            <div className="card !p-4 flex items-center gap-4">
              {artistHit.art
                ? <Cover src={artistHit.art} className="w-20 h-20 !rounded-full shrink-0" iconSize={26} />
                : <div className="w-20 h-20 rounded-full grid place-items-center shrink-0" style={{ background: 'var(--s2)' }}><User size={28} /></div>}
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-bold tracking-[0.2em] uppercase" style={{ color: 'var(--a)' }}>Artista</p>
                <p className="serif text-2xl font-semibold leading-tight truncate">{artistHit.name}</p>
                {!!artistHit.genre && <p className="text-xs truncate" style={{ color: 'var(--m)' }}>{artistHit.genre}{artistAlbums.length ? ` · ${artistAlbums.length} álbumes` : ''}</p>}
                <div className="mt-2 flex gap-2">
                  <button className="btn !py-1.5 !px-4 text-xs" onClick={playArtistRadio} disabled={!artistTop.length || !!resolvingId}>
                    <Play size={14} /> Escuchar
                  </button>
                  {!!artistTop.length && (
                    <button className="btn btn-o !py-1.5 !px-4 text-xs" onClick={playArtistRadio}>
                      <Radio size={14} /> Radio
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {!!artistAlbums.length && (
            <Section icon={Library} title={`Álbumes de ${artistHit?.name || 'el artista'}`}>
              <div className="flex gap-3 overflow-x-auto pb-1">
                {artistAlbums.map((a) => (
                  <HCard key={a.id} art={a.art} title={a.title} sub={`${a.releaseDate || ''}${a.trackCount ? ` · ${a.trackCount} temas` : ''}`}
                    onClick={() => openAlbum(a)} spinning={resolvingId === a.id} badge={a.releaseDate || undefined} />
                ))}
              </div>
            </Section>
          )}

          {!!artistTop.length && (
            <div className="card">
              <p className="text-xs mb-2 font-semibold flex items-center gap-1.5">
                <Sparkles size={14} style={{ color: 'var(--a)' }} /> Populares de {artistHit?.name}
              </p>
              {artistTop.slice(0, 5).map((s, i) => (
                <div key={s.id} className="flex items-center gap-3 p-2 rounded-2xl hover:bg-[var(--s2)]">
                  <span className="text-sm font-semibold w-6 text-center shrink-0 tabular-nums" style={{ color: 'var(--m)' }}>{i + 1}</span>
                  <Cover src={s.art} className="w-11 h-11 rounded-xl" />
                  <button onClick={() => playEntry(s)} className="flex-1 min-w-0 text-left">
                    <p className="text-sm truncate">{s.title}</p>
                    <p className="text-xs truncate" style={{ color: 'var(--m)' }}>{s.artist}{s.duration ? ` · ${fmtTime(s.duration)}` : ''}</p>
                  </button>
                  <button className="ico-btn shrink-0" onClick={() => playEntry(s)} aria-label={`Reproducir ${s.title}`} disabled={!!resolvingId}>
                    {resolvingId === s.id ? <Loader2 size={17} className="animate-spin" /> : <Play size={17} />}
                  </button>
                  <button className="ico-btn shrink-0" onClick={() => openMenu({ ...s, source: s.source || 'YouTube' }, artistTop, { kind: 'chart', onPlay: playEntry })} aria-label={`Opciones de ${s.title}`} title="Opciones"><MoreVertical size={17} /></button>
                </div>
              ))}
            </div>
          )}

          <div className="card">
            <button className="btn btn-o !py-1 !px-3 text-xs mb-2" onClick={() => setMode('home')}>
              <ChevronLeft size={14} /> Volver
            </button>
            <p className="text-xs mb-2" style={{ color: 'var(--m)' }}>
              {fuente === 'audius'
                ? `Audius: completas de “${resultsLabel}” · ⬇ las guarda en Local para oír sin wifi`
                : `Videos de “${resultsLabel}” · toca uno y la radio sigue · ⬇ guarda la versión sin wifi cuando existe`}
            </p>
            {results.map((t) => (
              <TrackRow key={t.id} t={t} p={p} list={results}
                asRadio={fuente === 'youtube' ? true : undefined}
                onMenu={(x) => openMenu(x, results, { asRadio: fuente === 'youtube' ? true : undefined, kind: fuente })}
                meta={<Meta t={t} />} />
            ))}
            {!results.length && !loading && !artistHit && <p className="text-sm" style={{ color: 'var(--m)' }}>Sin resultados.</p>}
          </div>
        </>
      )}

      {mode === 'category' && selCat && (
        <>
          <div className="relative overflow-hidden rounded-[2rem] p-5 text-white" style={{ background: selCat.bg }}>
            <span className="cat-glow" aria-hidden="true" />
            <button className="btn btn-o !py-1 !px-3 text-xs mb-2 !text-white !border-white/40 relative" onClick={() => setMode('home')}>
              <ChevronLeft size={14} /> Volver
            </button>
            <div className="relative flex items-center gap-4">
              <div className="w-20 h-20 rounded-full grid place-items-center shrink-0 bg-black/30 border border-white/30">
                <Disc3 size={38} className="text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-bold tracking-[0.2em] uppercase opacity-80">Categoría</p>
                <p className="serif text-3xl font-semibold leading-tight truncate">{selCat.name}</p>
                <p className="text-xs opacity-80 truncate">
                  {[catSongs.length ? `${catSongs.length} canciones` : '', catAlbums.length ? `${catAlbums.length} álbumes` : '', catVideos.length ? `${catVideos.length} videos` : ''].filter(Boolean).join(' · ') || 'Buscando…'}
                </p>
                {!!catSongs.length && (
                  <button className="mt-2 inline-flex items-center gap-2 px-5 py-2 rounded-full bg-white text-black font-semibold text-sm active:scale-95 transition-transform"
                    onClick={() => playEntry(catSongs[0])} disabled={!!resolvingId}>
                    {resolvingId ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} fill="currentColor" />} Escuchar
                  </button>
                )}
              </div>
            </div>
          </div>

          {!!catAlbums.length && (
            <Section icon={Library} title={`Álbumes de ${selCat.name}`}>
              <div className="flex gap-3 overflow-x-auto pb-1">
                {catAlbums.map((a) => (
                  <HCard key={a.id} art={a.art} title={a.title} sub={a.artist || a.releaseDate || ''}
                    onClick={() => openAlbum(a)} badge={a.releaseDate || undefined} />
                ))}
              </div>
            </Section>
          )}

          {!!catSongs.length && (
            <div className="card">
              <p className="text-xs mb-2 font-semibold flex items-center gap-1.5">
                <Sparkles size={14} style={{ color: 'var(--a)' }} /> Canciones de {selCat.name}
              </p>
              {catSongs.map((s, i) => (
                <div key={s.id} className="flex items-center gap-3 p-2 rounded-2xl hover:bg-[var(--s2)]">
                  <span className="text-sm font-semibold w-6 text-center shrink-0 tabular-nums" style={{ color: 'var(--m)' }}>{i + 1}</span>
                  <Cover src={s.art} className="w-11 h-11 rounded-xl" />
                  <button onClick={() => playEntry(s)} className="flex-1 min-w-0 text-left">
                    <p className="text-sm truncate">{s.title}</p>
                    <p className="text-xs truncate" style={{ color: 'var(--m)' }}>{s.artist}{s.duration ? ` · ${fmtTime(s.duration)}` : ''}</p>
                  </button>
                  <button className="ico-btn shrink-0" onClick={() => playEntry(s)} aria-label={`Reproducir ${s.title}`} disabled={!!resolvingId}>
                    {resolvingId === s.id ? <Loader2 size={17} className="animate-spin" /> : <Play size={17} />}
                  </button>
                  <button className="ico-btn shrink-0" onClick={() => openMenu({ ...s, source: s.source || 'YouTube' }, catSongs, { kind: 'chart', onPlay: playEntry })} aria-label={`Opciones de ${s.title}`} title="Opciones"><MoreVertical size={17} /></button>
                </div>
              ))}
            </div>
          )}

          <div className="card">
            <p className="text-xs mb-2" style={{ color: 'var(--m)' }}>Videos de {selCat.name} · toca uno y sigue la radio</p>
            {catLoading && !catVideos.length && !catSongs.length && (
              <p className="text-xs py-2 flex items-center gap-2" style={{ color: 'var(--m)' }}><Loader2 size={14} className="animate-spin" /> Buscando en la categoría…</p>
            )}
            {catVideos.map((t) => (
              <TrackRow key={t.id} t={t} p={p} list={catVideos}
                onMenu={(x) => openMenu(x, catVideos, { asRadio: true, kind: fuente })}
                asRadio meta={<Meta t={t} />} />
            ))}
            {!catVideos.length && !catLoading && !!catSongs.length && (
              <p className="text-xs" style={{ color: 'var(--m)' }}>Videos no disponibles por ahora; arriba tienes canciones y álbumes.</p>
            )}
          </div>
        </>
      )}

      {mode === 'album' && selAlbum && (
        <div className="card">
          <button className="btn btn-o !py-1 !px-3 text-xs mb-3" onClick={() => setMode(albumBack || 'home')}>
            <ChevronLeft size={14} /> Volver
          </button>
          <div className="flex items-center gap-4 mb-3">
            <Cover src={selAlbum.art} className="w-24 h-24 rounded-3xl shadow-lg shrink-0" iconSize={30} />
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-bold tracking-[0.2em] uppercase" style={{ color: 'var(--a)' }}>Álbum{selAlbum.releaseDate ? ` · ${selAlbum.releaseDate}` : ''}</p>
              <p className="serif text-2xl font-semibold leading-tight line-clamp-2">{selAlbum.title}</p>
              <p className="text-sm truncate" style={{ color: 'var(--m)' }}>{selAlbum.artist}</p>
              {!!selAlbum.trackCount && <p className="text-[11px]" style={{ color: 'var(--m)' }}>{albumTracks.length || selAlbum.trackCount} canciones</p>}
            </div>
          </div>
          <button className="btn w-full mb-2" onClick={() => playAlbum(selAlbum, albumTracks)} disabled={albumLoading || !!resolvingId}>
            {resolvingId === selAlbum.id ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} />}
            {resolvingId === selAlbum.id ? 'Resolviendo álbum…' : 'Reproducir álbum'}
          </button>
          {albumLoading && <p className="text-xs py-2 flex items-center gap-2" style={{ color: 'var(--m)' }}><Loader2 size={14} className="animate-spin" /> Cargando canciones…</p>}
          {!albumLoading && albumTracks.map((s) => (
            <div key={s.id} className="flex items-center gap-3 p-2 rounded-2xl hover:bg-[var(--s2)]">
              <span className="text-xs w-6 text-center shrink-0 tabular-nums" style={{ color: 'var(--m)' }}>{s.trackNumber || '•'}</span>
              <button onClick={() => playEntry(s)} className="flex-1 min-w-0 text-left">
                <p className="text-sm truncate">{s.title}</p>
                <p className="text-xs truncate" style={{ color: 'var(--m)' }}>{s.artist}{s.duration ? ` · ${fmtTime(s.duration)}` : ''}</p>
              </button>
              <button className="ico-btn shrink-0" onClick={() => playEntry(s)} aria-label={`Reproducir ${s.title}`} disabled={!!resolvingId}>
                {resolvingId === s.id ? <Loader2 size={17} className="animate-spin" /> : <Play size={17} />}
              </button>
              <button className="ico-btn shrink-0" onClick={() => openMenu({ ...s, source: s.source || 'YouTube' }, albumTracks, { kind: 'chart', onPlay: playEntry })} aria-label={`Opciones de ${s.title}`} title="Opciones"><MoreVertical size={17} /></button>
            </div>
          ))}
        </div>
      )}

      {mode === 'playlist' && sel && (
        <>
          <button className="btn btn-o !py-1 !px-3 text-xs" onClick={() => setMode('home')}>
            <ChevronLeft size={14} /> Volver
          </button>
          <PlaylistHero
            art={sel.tracks[0]?.art}
            icon={<ListMusic size={30} />}
            eyebrow={isFavPl ? 'Favoritos' : 'Playlist'}
            title={sel.name}
            meta={`${sel.tracks.length} canciones`}
            actions={
              <button className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white text-black font-semibold text-sm active:scale-95 transition-transform"
                onClick={() => playPlaylist(sel)} disabled={!sel.tracks.length}>
                <Play size={16} fill="currentColor" /> Reproducir todo
              </button>
            }
          />
          <div className="card">
            <div className="flex items-center gap-2 mb-2">
              {renaming ? (
                <form onSubmit={(e) => { e.preventDefault(); pls.rename(sel.id, renameVal); setRenaming(false); }} className="flex gap-1 flex-1">
                  <input className="inp !py-1.5" value={renameVal} onChange={(e) => setRenameVal(e.target.value)} maxLength={40} aria-label="Nombre" />
                  <button className="btn !py-1.5 shrink-0">OK</button>
                </form>
              ) : (
                <p className="text-xs flex-1 truncate" style={{ color: 'var(--m)' }}>
                  {isFavPl ? 'Tus me gusta en un solo lugar.' : 'Tu playlist, lista para sonar.'}
                </p>
              )}
              {!isFavPl && (
                <button className="ico-btn shrink-0" onClick={() => { setRenameVal(sel.name); setRenaming((r) => !r); }} aria-label="Renombrar"><Pencil size={16} /></button>
              )}
              {!isFavPl && (
                <button className="ico-btn shrink-0" onClick={() => { pls.remove(sel.id); setMode('home'); }} aria-label="Eliminar playlist"><Trash2 size={16} /></button>
              )}
            </div>
          {sel.tracks.map((t) => (
            <div key={t.id} className="flex items-center gap-1">
              <div className="flex-1 min-w-0"><TrackRow t={t} p={p} list={sel.tracks} onMenu={(x) => openMenu(x, sel.tracks, { kind: isFavPl ? 'fav' : 'pl' })} /></div>
              {!isFavPl && (
                <button className="ico-btn shrink-0" onClick={() => pls.removeTrack(sel.id, t.id)} aria-label={`Quitar ${t.title}`}><X size={15} /></button>
              )}
            </div>
          ))}
          {!sel.tracks.length && <p className="text-sm" style={{ color: 'var(--m)' }}>{isFavPl ? 'Vacía. Dale corazón a lo que te guste y aparece aquí.' : 'Vacía. Agrega temas con ＋ desde cualquier lista.'}</p>}
          </div>
        </>
      )}

      {mode === 'roompl' && (() => {
        const pl = roomPls.find((x) => x.roomId === selRoom);
        if (!pl) return (
          <>
            <button className="btn btn-o !py-1 !px-3 text-xs" onClick={() => setMode('home')}>
              <ChevronLeft size={14} /> Volver
            </button>
            <div className="card"><p className="text-sm" style={{ color: 'var(--m)' }}>Esa playlist ya no está disponible.</p></div>
          </>
        );
        const isDuo = pl.kind === 'dm';
        const peer = peers[pl.roomId];
        const title = isDuo ? (peer?.name || peer?.handle || pl.name) : pl.name;
        const list = (pl.tracks || []).filter((t) => t.videoId || t.src);
        return (
          <>
            <button className="btn btn-o !py-1 !px-3 text-xs" onClick={() => setMode('home')}>
              <ChevronLeft size={14} /> Volver
            </button>
            <PlaylistHero
              art={pl.tracks[0]?.art}
              icon={isDuo ? <Users size={30} /> : (pl.icon || <Users size={30} />)}
              eyebrow={isDuo ? 'Playlist de a 2' : 'Playlist del grupo'}
              title={title}
              meta={`${pl.tracks.length} canciones`}
              actions={
                <>
                  <button className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white text-black font-semibold text-sm active:scale-95 transition-transform"
                    onClick={() => { if (list.length) p.play(list[0], list); else toast('Esa playlist no tiene temas reproducibles', AlertTriangle); }}
                    disabled={!list.length}>
                    <Play size={16} fill="currentColor" /> Escuchar
                  </button>
                  <button className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-sm border border-white/35 backdrop-blur active:scale-95 transition-transform"
                    onClick={() => { if (onOpenRoom) onOpenRoom(pl.roomId); else toast('Abre Comunidad para chatear', AlertTriangle); }}>
                    <MessageCircle size={15} /> Chatear
                  </button>
                </>
              }
            />
            <div className="card">
              {!pl.tracks.length && <p className="text-sm" style={{ color: 'var(--m)' }}>Vacía por ahora: comparte temas en el chat y aparecen aquí.</p>}
              {pl.tracks.map((t) => (
                <TrackRow key={t.id} t={t} p={p} list={pl.tracks}
                  onMenu={(x) => openMenu(x, pl.tracks, { kind: 'room' })}
                  meta={<Meta t={t} />} />
              ))}
            </div>
          </>
        );
      })()}

      {mode === 'home' && lampOn && (
        <>
          <Hero p={p} feat={recs[0] || releases[0] || charts[0]} playEntry={playEntry} resolving={!!resolvingId} />
          {fuente === 'audius' && (
            <Section icon={Disc3} title="Tendencias Audius">
              <p className="text-[11px] mb-2" style={{ color: 'var(--m)' }}>
                Completas y descargables · catálogo independiente (el mainstream suele faltar aquí)
              </p>
              <div className="flex gap-3 overflow-x-auto pb-1">
                {audTrend.map((c) => (
                  <HCard key={c.id} art={c.art} title={c.title} sub={c.artist}
                    onClick={() => p.play(c, audTrend)} spinning={resolvingId === c.id} badge="Audius" />
                ))}
                {!audTrend.length && <p className="text-xs" style={{ color: 'var(--m)' }}>Cargando…</p>}
              </div>
            </Section>
          )}
          <div className="grid grid-cols-3 gap-2">
            {MOODS.map(([label, query, I, bg]) => (
              <button key={label} onClick={() => { setQ(label); runSearch(query); }}
                className="relative overflow-hidden rounded-2xl p-3 text-left text-white active:scale-95 transition-transform min-h-[76px]"
                style={{ background: bg }}>
                <I size={34} className="absolute -right-1.5 -bottom-1.5 opacity-25" />
                <I size={16} />
                <span className="block text-[13px] font-semibold leading-tight mt-2">{label}</span>
              </button>
            ))}
          </div>

          {/* Radio automática siempre activa: toca un tema y siguen otros distintos del mismo estilo */}
          <div className="card flex items-center gap-3 !py-3">
            <div className="w-10 h-10 rounded-2xl grid place-items-center text-white shrink-0"
              style={{ background: 'linear-gradient(135deg, var(--a), #4c1d95)' }}>
              {p.radioBusy ? <Loader2 size={18} className="animate-spin" /> : <Radio size={18} />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">Radio automática activa{p.radioBusy ? ' · buscando…' : ''}</p>
              <p className="text-[11px] truncate" style={{ color: 'var(--m)' }}>
                Recomendadas primero y luego aleatorias: viejitas, otros géneros y populares
              </p>
            </div>
            <span className="text-[11px] px-2.5 py-1 rounded-full text-white shrink-0"
              style={{ background: 'var(--a)' }}>
              Activa
            </span>
          </div>

          {(p.history || []).length > 0 && (
            <Section icon={History} title="Historial" action={
              <button className="text-[11px]" style={{ color: 'var(--m)' }} onClick={() => p.clearHistory()}>Limpiar</button>
            }>
              <div className="flex gap-3 overflow-x-auto pb-1">
                {(p.history || []).slice(0, 12).map((h) => (
                  <HCard key={`${h.id}-${h.at}`} art={h.art} title={h.title} sub={h.artist}
                    onClick={() => (p.track?.id === h.id ? p.openFull?.() : (p.playRadio ? p.playRadio(h) : p.play(h)))} spinning={resolvingId === h.id}
                    onDownload={() => descargarSong(h)} downloading={dlId === h.id} />
                ))}
              </div>
            </Section>
          )}

          {(!!(p.favs || []).length || pls.playlists.length > 0) && (
            <Section icon={Trophy} title="Tus más escuchadas">
              <div className="flex gap-3 overflow-x-auto pb-1">
                {!!(p.favs || []).length && (
                  <PlaylistCard pl={{ id: 'fav', name: 'Tus Me Gusta', tracks: p.favs }}
                    plays={plStats.fav || 0} onClick={() => openPl('fav')} />
                )}
                {topPls.map((pl) => (
                  <PlaylistCard key={pl.id} pl={pl}
                    plays={plStats[pl.id] || 0} onClick={() => openPl(pl.id)} />
                ))}
              </div>
            </Section>
          )}

          {!!recs.length && (
            <Section icon={Sparkles} title="Hecho para ti">
              <div className="flex gap-3 overflow-x-auto pb-1">
                {recs.map((t) => (
                  <HCard key={t.id} art={t.art} title={t.title} sub={t.artist}
                    onClick={() => (p.track?.id === t.id ? p.openFull?.() : (p.playRadio ? p.playRadio(t) : p.play(t, recs)))} badge={t.why ? `Como ${t.why}`.slice(0, 18) : undefined}
                    onDownload={() => descargarSong(t)} downloading={dlId === t.id} />
                ))}
              </div>
            </Section>
          )}

          {!!recAlbums.length && (
            <Section icon={Library} title="Álbumes para ti">
              <div className="flex gap-3 overflow-x-auto pb-1">
                {recAlbums.map((a) => (
                  <HCard key={a.id} art={a.art} title={a.title} sub={a.artist}
                    onClick={() => openAlbum(a)} badge={a.releaseDate || undefined} />
                ))}
              </div>
            </Section>
          )}

          {/* Comunidad: playlists hechas en grupos y de a 2, con chatear */}
          {!!roomPls.length && (() => {
            const duos = roomPls.filter((x) => x.kind === 'dm');
            const groups = roomPls.filter((x) => x.kind !== 'dm');
            const playRoom = (pl) => {
              const list = (pl.tracks || []).filter((t) => t.videoId || t.src);
              if (list.length) p.play(list[0], list);
              else toast('Esa playlist no tiene temas reproducibles', AlertTriangle);
            };
            const chatRoom = (pl) => {
              if (onOpenRoom) onOpenRoom(pl.roomId);
              else toast('Abre Comunidad para chatear', AlertTriangle);
            };
            const openRoom = (pl) => { setSelRoom(pl.roomId); setMode('roompl'); };
            return (
              <Section icon={Users} title="Comunidad">
                {!!duos.length && (
                  <>
                    <p className="text-[11px] font-semibold mb-1.5 px-1" style={{ color: 'var(--m)' }}>De a 2</p>
                    <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 mb-2">
                      {duos.map((pl) => (
                        <RoomPlCard key={pl.id} pl={pl} peer={peers[pl.roomId]} myAvatar={myAvatar}
                          onOpen={() => openRoom(pl)} onPlay={() => playRoom(pl)} onChat={() => chatRoom(pl)} />
                      ))}
                    </div>
                  </>
                )}
                {!!groups.length && (
                  <>
                    <p className="text-[11px] font-semibold mb-1.5 px-1" style={{ color: 'var(--m)' }}>Grupos</p>
                    <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1">
                      {groups.map((pl) => (
                        <RoomPlCard key={pl.id} pl={pl} myAvatar={myAvatar}
                          onOpen={() => openRoom(pl)} onPlay={() => playRoom(pl)} onChat={() => chatRoom(pl)} />
                      ))}
                    </div>
                  </>
                )}
              </Section>
            );
          })()}
          {!roomPls.length && (
            <div className="card flex items-center gap-3 !py-3">
              <div className="w-10 h-10 rounded-2xl grid place-items-center text-white shrink-0"
                style={{ background: 'linear-gradient(135deg, var(--a), #4c1d95)' }}>
                <Users size={18} />
              </div>
              <p className="text-xs flex-1" style={{ color: 'var(--m)' }}>
                Comparte canciones en Comunidad o en el chat y sus playlists aparecen aquí.
              </p>
            </div>
          )}

          <Section icon={Shuffle} title="Canciones aleatorias" action={
            <button className="text-[11px] px-2.5 py-1.5 rounded-full inline-flex items-center gap-1" style={{ background: 'var(--s2)', color: 'var(--m)' }}
              onClick={() => setRandomKey((k) => k + 1)} aria-label="Mezclar canciones aleatorias">
              <Shuffle size={12} /> Mezclar
            </button>
          }>
            <div className="flex gap-3 overflow-x-auto pb-1">
              {randomSongs.map((t) => (
                <HCard key={t.id} art={t.art} title={t.title} sub={t.artist}
                  onClick={() => (p.track?.id === t.id ? p.openFull?.() : (p.playRadio ? p.playRadio(t) : p.play(t, randomSongs)))} badge={t.official ? 'Oficial' : undefined}
                  onDownload={() => descargarSong(t)} downloading={dlId === t.id} />
              ))}
              {!randomSongs.length && <p className="text-xs" style={{ color: 'var(--m)' }}>{randomLoading ? 'Mezclando…' : 'Toca Mezclar para traer canciones.'}</p>}
            </div>
          </Section>

          <Section icon={LayoutGrid} title="Categorías">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
              {CATEGORIES.map(([name, query, bg, term]) => (
                <button key={name} onClick={() => openCategory(name, query, bg, term)}
                  className="cat-btn rounded-[1.25rem] px-4 h-20 flex flex-col items-center justify-center text-center text-white relative overflow-hidden"
                  style={{ background: bg }}>
                  <span className="cat-glow" aria-hidden="true" />
                  <span className="relative text-lg font-bold leading-tight tracking-wide" style={{ textShadow: '0 2px 10px rgba(0,0,0,.45)' }}>{name}</span>
                  <Play size={15} className="cat-play absolute top-2.5 right-2.5" fill="currentColor" />
                </button>
              ))}
            </div>
          </Section>

          <Section icon={TrendingUp} title="Tendencias" action={
            <select className="inp !w-auto !py-1.5 !rounded-full text-xs" value={cc} aria-label="País del top"
              onChange={(e) => { setCc(e.target.value); topSongs(e.target.value, 10).then(setCharts).catch(() => toast('No se cargó el top', AlertTriangle)); }}>
              {CHART_COUNTRIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          }>
            <div className="card !p-2">
              {charts.slice(0, 8).map((c) => (
                <div key={c.id} className="flex items-center gap-3 p-2 rounded-2xl hover:bg-[var(--s2)]">
                  <span className="text-sm font-semibold w-6 text-center shrink-0 tabular-nums" style={{ color: 'var(--m)' }}>{c.rank}</span>
                  <Cover src={c.art} className="w-11 h-11 rounded-xl" />
                  <button onClick={() => playEntry(c)} className="flex-1 min-w-0 text-left">
                    <p className="text-sm truncate">{c.title}</p>
                    <p className="text-xs truncate" style={{ color: 'var(--m)' }}>{c.artist}</p>
                  </button>
                  <button className="ico-btn shrink-0" onClick={() => downloadEntry(c)} aria-label={`Descargar ${c.title}`} title="Guardar sin wifi en Local" disabled={!!resolvingId || !!dlId}>
                    {dlId === c.id ? <Loader2 size={17} className="animate-spin" /> : <Download size={17} />}
                  </button>
                  <button className="ico-btn shrink-0" onClick={() => playEntry(c)} aria-label={`Reproducir ${c.title}`} disabled={!!resolvingId}>
                    {resolvingId === c.id ? <Loader2 size={17} className="animate-spin" /> : <Play size={17} />}
                  </button>
                </div>
              ))}
              {!charts.length && <p className="text-xs p-2" style={{ color: 'var(--m)' }}>Cargando top…</p>}
            </div>
          </Section>

          <Section icon={ListMusic} title="Tus playlists">
            <div className="grid gap-2">
              <div className="flex items-center gap-3 p-3 rounded-2xl text-white" style={{ background: 'linear-gradient(135deg, var(--a), #4c1d95)' }}>
                <Heart size={22} fill="currentColor" className="shrink-0" />
                <button onClick={() => openPl('fav')} className="flex-1 text-left" aria-label="Abrir me gusta">
                  <p className="font-bold text-[15px]">Tus Me Gusta</p>
                  <p className="text-xs opacity-80">{p.favs.length} canciones</p>
                </button>
                <button className="ico-btn !text-white" aria-label="Reproducir me gusta"
                  onClick={() => p.favs.length ? playPlaylist({ id: 'fav', tracks: p.favs }) : toast('Aún no tienes favoritos', AlertTriangle)}>
                  <Play size={18} />
                </button>
              </div>
              {pls.playlists.map((pl) => (
                <div key={pl.id} className="flex items-center gap-3 p-2 rounded-2xl hover:bg-[var(--s2)] card !p-2">
                  {pl.tracks[0]?.art
                    ? <Cover src={pl.tracks[0].art} className="w-11 h-11 rounded-xl" />
                    : <div className="w-11 h-11 rounded-xl grid place-items-center shrink-0" style={{ background: 'var(--s2)' }}><ListMusic size={17} /></div>}
                  <button onClick={() => openPl(pl.id)} className="flex-1 min-w-0 text-left">
                    <p className="text-sm font-medium truncate">{pl.name}</p>
                    <p className="text-xs" style={{ color: 'var(--m)' }}>{pl.tracks.length} canciones</p>
                  </button>
                  <button className="ico-btn shrink-0" onClick={() => playPlaylist(pl)} aria-label={`Reproducir ${pl.name}`}><Play size={17} /></button>
                </div>
              ))}
              <form onSubmit={createPl} className="flex gap-2">
                <input className="inp" placeholder="Nueva playlist…" value={newPlName}
                  onChange={(e) => setNewPlName(e.target.value)} maxLength={40} aria-label="Nombre de playlist" />
                <button className="btn shrink-0" aria-label="Crear playlist"><Plus size={16} />Crear</button>
              </form>
            </div>
          </Section>

          {!!p.favs.length && (
            <Section icon={Heart} title="Favoritos">
              <div className="card !p-2">
                {p.favs.slice(0, 6).map((t) => (
                  <TrackRow key={t.id} t={t} p={p} list={p.favs}
                    onMenu={(x) => openMenu(x, p.favs, { kind: 'fav' })}
                    meta={<Meta t={t} />} />
                ))}
              </div>
            </Section>
          )}
        </>
      )}

      {mode === 'home' && !lampOn && (
        <>
          {(() => {
            const lastLocal = (p.history || []).map((h) => (local?.tracks || []).find((t) => t.id === h.id)).find(Boolean)
              || (local?.tracks || [])[0] || null;
            if (!lastLocal) return null;
            return (
              <PlaylistHero
                art={lastLocal.art}
                icon={<FolderOpen size={30} />}
                eyebrow="Local sin conexión"
                title={lastLocal.title}
                meta={`${lastLocal.artist || 'Desconocido'} · ${(local?.tracks.length || 0)} temas en este dispositivo`}
                actions={
                  <>
                    <button className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white text-black font-semibold text-sm active:scale-95 transition-transform"
                      onClick={() => p.play(lastLocal, localVisible.length ? localVisible : local.tracks)}>
                      <Play size={16} fill="currentColor" /> Escuchar
                    </button>
                    {!!localVisible.length && (
                      <button className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-sm border border-white/35 backdrop-blur active:scale-95 transition-transform"
                        onClick={playLocalShuffle}>
                        <Shuffle size={15} /> Aleatorio
                      </button>
                    )}
                  </>
                }
              />
            );
          })()}
          {/* Tabs: Lista | Playlists | Carátulas | + */}
          <div className="flex rounded-full p-0.5 overflow-x-auto" style={{ background: 'var(--s2)' }} role="tablist" aria-label="Vista local">
            {[['songs', 'Lista'], ['playlists', 'Playlists'], ['covers', 'Carátulas'], ['add', '＋']].map(([id, label]) => (
              <button key={id} role="tab" aria-selected={localTab === id} onClick={() => setLocalTab(id)}
                className={`flex-1 px-3 py-1.5 rounded-full text-[11px] font-semibold whitespace-nowrap ${localTab === id ? 'text-white' : ''}`}
                style={localTab === id ? { background: 'var(--a)' } : { color: 'var(--m)' }}>{label}</button>
            ))}
          </div>
          <input ref={fileRef} type="file" accept="audio/*,video/*,.mp3,.m4a,.mp4,.m4v,.mov,.webm,.flac,.ogg,.oga,.opus,.wav,.aac,.wma" multiple className="hidden" aria-label="Elegir carpeta de música y videos"
            onChange={(e) => { local?.importFiles(e.target.files); e.target.value = ''; }} />

          {localTab === 'songs' && (
          <div className="card">
            <div className="flex flex-wrap gap-1.5 mb-2">
              {!!localVisible.length && (
                <button className="btn btn-o !py-1.5 !px-2.5 !text-[11px] shrink-0" onClick={() => p.play(localVisible[0], localVisible)} aria-label="Reproducir todo lo local">
                  <Play size={13} /> Todo
                </button>
              )}
              {!!localVisible.length && (
                <button className="btn btn-o !py-1.5 !px-2.5 !text-[11px] shrink-0" onClick={playLocalShuffle} aria-label="Local en aleatorio">
                  <Shuffle size={13} /> Mezclar
                </button>
              )}
              <span className="flex-1" />
              <span className="text-[11px] self-center truncate" style={{ color: 'var(--m)' }}>
                {(local?.tracks.length || 0)} temas{q ? ` · “${q.trim()}”` : ''}
              </span>
            </div>
            {!!(local?.tracks.length) && (
              <div className="flex items-center gap-1.5 mb-2">
                <span className="text-[11px] font-semibold shrink-0" style={{ color: 'var(--m)' }}>Ordenar:</span>
                <div className="flex rounded-full p-0.5 flex-1 overflow-x-auto" style={{ background: 'var(--s2)' }}>
                  {[['recent', 'Recientes'], ['title', 'Título'], ['artist', 'Artista'], ['duration', 'Duración']].map(([id, label]) => (
                    <button key={id} onClick={() => setLocalSort(id)}
                      className={`flex-1 px-2.5 py-1.5 rounded-full text-[11px] font-semibold whitespace-nowrap ${localSort === id ? 'text-white' : ''}`}
                      style={localSort === id ? { background: 'var(--a)' } : { color: 'var(--m)' }}>{label}</button>
                  ))}
                </div>
              </div>
            )}
            {localVisible.slice(0, localShown).map((t) => (
              <TrackRow key={t.id} t={t} p={p} list={localVisible}
                onMenu={(x) => openMenu(x, localVisible.length ? localVisible : local.tracks, { kind: 'local' })}
                meta={<Meta t={t} />} wrap />
            ))}
            {localVisible.length > localShown && <div ref={moreRef} className="h-2" aria-hidden="true" />}
            {!localVisible.length && (
              <p className="text-sm py-2" style={{ color: 'var(--m)' }}>
                {q ? `Nada local coincide con “${q.trim()}”.` : 'Vacío por aquí. Toca Escanear canciones y suena sin internet.'}
              </p>
            )}
          </div>
          )}

          {localTab === 'covers' && (
          <div className="card">
            <div className="flex flex-wrap gap-1.5 mb-2">
              {!!localVisible.length && (
                <button className="btn btn-o !py-1.5 !px-2.5 !text-[11px] shrink-0" onClick={playLocalShuffle} aria-label="Local en aleatorio">
                  <Shuffle size={13} /> Mezclar
                </button>
              )}
              <span className="flex-1" />
              <span className="text-[11px] self-center truncate" style={{ color: 'var(--m)' }}>
                {(local?.tracks.length || 0)} temas
              </span>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
              {localVisible.slice(0, localShown).map((t) => {
                const on = p.track?.id === t.id;
                return (
                  <div key={t.id} className="group relative [content-visibility:auto] [contain-intrinsic-size:auto_160px]">
                    <button onClick={() => p.play(t, localVisible)} className="block w-full text-left" aria-label={`Reproducir ${t.title}`} title={`${t.title} — ${t.artist}`}>
                      <div className="relative aspect-square rounded-2xl overflow-hidden" style={{ background: 'var(--s2)', boxShadow: on ? '0 0 0 2px var(--a)' : 'none' }}>
                        {t.art
                          ? <img src={t.art} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />
                          : (
                            <div className="w-full h-full grid place-items-center text-2xl font-bold text-white"
                              style={{ background: `linear-gradient(135deg, hsl(${(String(t.title).charCodeAt(0) * 37) % 360} 60% 45%), hsl(${(String(t.artist).charCodeAt(0) * 53) % 360} 60% 25%))` }}>
                              {(String(t.title || '?').trim()[0] || '?').toUpperCase()}
                            </div>
                          )}
                          <span className="absolute inset-0 grid place-items-center bg-black/35 opacity-0 group-hover:opacity-100 transition-opacity text-white">
                            {on && p.playing ? <Pause size={22} /> : <Play size={22} />}
                          </span>
                          {t.kind === 'video' && (
                            <span className="absolute bottom-1 left-1 text-[9px] font-bold px-1.5 py-0.5 rounded-md text-white" style={{ background: 'rgba(0,0,0,.6)' }}>VIDEO</span>
                          )}
                      </div>
                      <p className="text-[12px] font-semibold mt-1.5 line-clamp-2 min-h-[2.2em] leading-snug" title={t.title}>{t.title}</p>
                      <p className="text-[10px] truncate" style={{ color: 'var(--m)' }} title={t.artist}>{t.artist}</p>
                    </button>
                    <button className="absolute top-1 right-1 w-7 h-7 rounded-full grid place-items-center bg-black/55 text-white opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                      onClick={() => openMenu(t, localVisible.length ? localVisible : local.tracks, { kind: 'local' })} aria-label={`Opciones de ${t.title}`} title="Opciones"><MoreVertical size={14} /></button>
                  </div>
                );
              })}
            </div>
            {localVisible.length > localShown && <div ref={moreRef} className="h-2" aria-hidden="true" />}
            {!localVisible.length && (
              <p className="text-sm py-2" style={{ color: 'var(--m)' }}>
                {q ? `Nada local coincide con “${q.trim()}”.` : 'Vacío por aquí. Toca Escanear canciones y suena sin internet.'}
              </p>
            )}
          </div>
          )}
          {localTab === 'playlists' && (
          <div>
            <div className="flex items-center gap-3 px-1 mb-2">
              <Heart size={22} fill="currentColor" className="shrink-0" style={{ color: 'var(--a)' }} />
              <button onClick={() => openPl('fav')} className="flex-1 text-left" aria-label="Abrir me gusta">
                <p className="font-bold text-[15px]">Tus Me Gusta</p>
                <p className="text-xs" style={{ color: 'var(--m)' }}>{p.favs.length} canciones · sin conexión</p>
              </button>
              <button className="ico-btn" aria-label="Reproducir me gusta"
                onClick={() => p.favs.length ? playPlaylist({ id: 'fav', tracks: p.favs }) : toast('Aún no tienes favoritos', AlertTriangle)}>
                <Play size={18} />
              </button>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 snap-x">
              {topPls.map((pl) => (
                <span key={pl.id} className="snap-start shrink-0">
                  <PlaylistCard pl={pl} plays={plStats[pl.id] || 0} onClick={() => openPl(pl.id)} />
                </span>
              ))}
              {!topPls.length && (
                <p className="text-xs py-2" style={{ color: 'var(--m)' }}>Aún no creas playlists.</p>
              )}
            </div>
            <form onSubmit={createPl} className="flex gap-2 mt-1">
              <input className="inp" placeholder="Nueva playlist…" value={newPlName}
                onChange={(e) => setNewPlName(e.target.value)} maxLength={40} aria-label="Nombre de playlist" />
              <button className="btn shrink-0" aria-label="Crear playlist"><Plus size={16} />Crear</button>
            </form>
          </div>
          )}

          {localTab === 'add' && (
          <div className="card">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 rounded-2xl grid place-items-center text-white shrink-0"
                style={{ background: 'linear-gradient(135deg, var(--a), #4c1d95)' }}>
                {scanning ? <Loader2 size={22} className="animate-spin" /> : <Radar size={22} />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-[15px]">Tu música local</p>
                <p className="text-xs truncate" style={{ color: 'var(--m)' }}>
                  {(local?.tracks.length || 0)} temas{(local?.bytes || 0) > 0 ? ` · ${fmtMB(local.bytes)}` : ''}{(local?.dirs?.length || 0) > 0 ? ` · ${local.dirs.length} carpeta${local.dirs.length > 1 ? 's' : ''}` : ''}
                </p>
              </div>
            </div>
            {/* Progreso del escaneo en vivo: X de Y + cancelar */}
            {scanning && (
              <div className="mb-3 rounded-2xl p-3" style={{ background: 'var(--s2)' }} role="status" aria-live="polite">
                <p className="text-xs font-semibold">
                  {local?.scan?.total
                    ? `Escaneando ${local.scan.done} de ${local.scan.total}… ${local.scan.added} nuevas`
                    : 'Buscando canciones…'}
                </p>
                {!!local?.scan?.total && (
                  <div className="mt-2 h-2 rounded-full overflow-hidden" style={{ background: 'var(--bd)' }}>
                    <div className="h-full rounded-full transition-all" style={{ width: `${scanPct}%`, background: 'var(--a)' }} />
                  </div>
                )}
                {!!local?.scan?.name && (
                  <p className="text-[11px] mt-1 truncate" style={{ color: 'var(--m)' }}>{local.scan.name}</p>
                )}
                <button className="btn btn-o w-full mt-2 !py-1.5 text-xs" onClick={() => local?.cancelScan?.()}
                  aria-label="Cancelar escaneo">
                  <X size={14} /> Cancelar
                </button>
              </div>
            )}
            {/* Lista de carpetas escaneadas (multi-carpeta) */}
            {(local?.dirs?.length || 0) > 0 && (
              <div className="mb-3 rounded-2xl overflow-hidden" style={{ border: '1px solid var(--bd)' }} aria-label="Carpetas escaneadas">
                <p className="text-[11px] font-bold tracking-wide uppercase px-3 pt-2.5 pb-1" style={{ color: 'var(--m)' }}>
                  Carpetas ({local.dirs.length})
                </p>
                <div className="divide-y" style={{ borderColor: 'var(--bd)' }}>
                  {local.dirs.map((d) => {
                    const n = String(d.name || 'carpeta');
                    const count = (local?.tracks || []).filter((t) => String(t.dir || '').toLowerCase() === n.toLowerCase()).length;
                    const canRescan = !!d.handle;
                    const confirming = pendingDel === (d.id || n);
                    return (
                      <div key={d.id || n} className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span className="w-8 h-8 rounded-xl grid place-items-center shrink-0" style={{ background: 'var(--s2)' }}>
                            <FolderOpen size={15} style={{ color: 'var(--a)' }} />
                          </span>
                          <span className="flex-1 min-w-0">
                            <span className="block text-[13px] font-semibold truncate" title={n}>{n}</span>
                            <span className="block text-[11px] truncate" style={{ color: 'var(--m)' }}>
                              {count} tema{count === 1 ? '' : 's'}{d.kind === 'picker' ? ' · manual' : ''}{!count ? ' · vacía' : ''}
                            </span>
                          </span>
                          <button className="ico-btn shrink-0" disabled={scanning || !canRescan}
                            title={canRescan ? `Re-escanear ${n}` : 'Carpeta manual: usa Elegir carpeta para actualizar'}
                            aria-label={`Re-escanear ${n}`}
                            onClick={() => local?.rescanDir?.(d.id || d.name)}>
                            <RotateCw size={15} />
                          </button>
                          <button className="ico-btn shrink-0" disabled={scanning}
                            title={`Quitar ${n} de la lista`}
                            aria-label={`Quitar ${n}`}
                            onClick={() => {
                              if (!count) { local?.removeDir?.(d.id || d.name, false); return; }
                              setPendingDel(confirming ? null : (d.id || n));
                            }}>
                            <X size={15} />
                          </button>
                        </div>
                        {confirming && !!count && (
                          <div className="mt-2 rounded-xl p-2 flex flex-col gap-1.5" style={{ background: 'var(--s2)' }} role="group" aria-label={`Quitar ${n}`}>
                            <p className="text-[11px] font-semibold">Quitar “{n}” ({count} temas): ¿solo el acceso o también la música?</p>
                            <div className="flex gap-1.5">
                              <button className="btn btn-o flex-1 !py-1.5 !text-[11px]" disabled={scanning}
                                onClick={async () => { setPendingDel(null); await local?.removeDir?.(d.id || d.name, false); }}>
                                Solo acceso
                              </button>
                              <button className="btn btn-o flex-1 !py-1.5 !text-[11px]" disabled={scanning}
                                style={{ borderColor: '#ef444488', color: '#ef4444' }}
                                onClick={async () => { setPendingDel(null); await local?.removeDir?.(d.id || d.name, true); }}>
                                Borrar todo
                              </button>
                              <button className="ico-btn shrink-0" aria-label="Cancelar" onClick={() => setPendingDel(null)}><X size={14} /></button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            <div className="grid gap-2">
              {/* Botón único: en PC abre el picker de carpeta, en iPhone/Firefox el selector manual */}
              <button className="btn w-full" onClick={handleEscanear} disabled={scanning}>
                {scanning ? <Loader2 size={15} className="animate-spin" /> : <FolderSearch size={15} />} {(local?.dirs?.length || 0) > 0 ? 'Agregar otra carpeta' : 'Elegir carpeta'}
              </button>
              {(local?.dirs?.length || 0) > 1 && (
                <button className="btn btn-o w-full" onClick={handleRescan} disabled={scanning}
                  title="Vuelve a revisar todas las carpetas sin buscarlas">
                  {scanning ? <Loader2 size={15} className="animate-spin" /> : <RotateCw size={15} />} Re-escanear todo ({local.dirs.length})
                </button>
              )}
              {(local?.dirs?.length || 0) === 1 && !!local?.lastDir && (
                <button className="btn btn-o w-full" onClick={handleRescan} disabled={scanning}
                  title="Vuelve a revisar la misma carpeta sin buscarla">
                  {scanning ? <Loader2 size={15} className="animate-spin" /> : <RotateCw size={15} />} Re-escanear {local.lastDir.slice(0, 24)}
                </button>
              )}
              {(local?.dirs?.length || 0) > 0 && (
                <button className="btn btn-o w-full" onClick={() => local?.clearEmptyDirs?.()} disabled={scanning}
                  title="Borra de la lista las carpetas que quedaron con 0 canciones">
                  <Trash2 size={15} /> Limpiar vacías
                </button>
              )}
              <div className="rounded-2xl p-3" style={{ background: 'var(--s2)' }} aria-label="Descargar MP3 de YouTube">
                <p className="text-xs font-bold mb-1">Descargar MP3 de YouTube</p>
                <p className="text-[11px]" style={{ color: 'var(--m)' }}>
                  En ⋮ de una canción → Descargar MP3: se copia el link y se abre la herramienta elegida en <b>Ajustes</b>. Baja el MP3 <b>dentro de una carpeta ya escaneada</b> (ej. Download) y al entrar aparece solo en Local.
                </p>
              </div>
              {!!(local?.tracks.length) && (
                <button className="btn btn-o w-full" onClick={buscarCaratulas} disabled={!!artBusy || scanning}
                  aria-label="Buscar carátulas reales con wifi" title="Con wifi: busca la imagen real del álbum o tema">
                  {artBusy ? <Loader2 size={15} className="animate-spin" /> : <ImageIcon size={15} />}
                  {artBusy && artBusy.total ? `Buscando ${artBusy.done}/${artBusy.total}` : 'Buscar carátulas'}
                </button>
              )}
              <button className="btn btn-o w-full" onClick={() => setAutoArt(!autoArt)}
                aria-pressed={!!autoArt} aria-label="Auto-actualizar carátulas"
                title="Si está activo, cada cierto tiempo busca carátulas a lo nuevo sin imagen real"
                style={autoArt ? { borderColor: 'var(--a)', color: 'var(--a)' } : undefined}>
                <RefreshCw size={15} /> Auto-carátulas {autoArt ? 'on' : 'off'}
              </button>
              <button className="btn btn-o w-full" onClick={() => setAutoRescan(!autoRescan)}
                aria-pressed={!!autoRescan} aria-label="Actualizar carpetas al entrar"
                title="Si está activo, al entrar re-escanea tus carpetas (solo con permiso ya dado, sin pedir nada)"
                style={autoRescan ? { borderColor: 'var(--a)', color: 'var(--a)' } : undefined}>
                <RotateCw size={15} /> Actualizar al entrar {autoRescan ? 'on' : 'off'}
              </button>
              {!!(local?.tracks.length) && (
                <button className="btn btn-o w-full" style={{ borderColor: '#ef444488', color: '#ef4444' }}
                  onClick={() => { if (window.confirm('¿Vaciar toda tu música local?')) { local?.clearLocal(); local?.clearDirs?.(); } }}>
                  <Trash2 size={15} /> Vaciar música local
                </button>
              )}
            </div>
            <p className="text-[11px] flex items-center gap-1.5 mt-3" style={{ color: 'var(--m)' }}>
              <HardDrive size={12} /> Un botón agrega carpetas (se suman) · lo nuevo entra de primero en Recientes · sigue ahí aunque recargues.
            </p>
          </div>
          )}
        </>
      )}

      {/* Hoja: agregar a playlists (multi-seleccion + crear) */}
      {addTarget && (
        <div className="fixed inset-0 z-40 grid place-items-end sm:place-items-center p-4" role="dialog" aria-modal="true" aria-label="Agregar a playlists">
          <div className="absolute inset-0 bg-black/60" onClick={() => setAddTarget(null)} />
          <div className="relative card w-full max-w-sm !rounded-3xl">
            <div className="flex items-center justify-between mb-2">
              <p className="font-bold text-sm truncate">Agregar “{addTarget.title}”</p>
              <button className="ico-btn" onClick={() => setAddTarget(null)} aria-label="Cerrar"><X size={17} /></button>
            </div>
            {!pls.playlists.length && <p className="text-xs mb-2" style={{ color: 'var(--m)' }}>Crea tu primera playlist abajo.</p>}
            <div className="max-h-56 overflow-y-auto -mx-1 px-1">
              {pls.playlists.map((pl) => {
                const has = pl.tracks.some((x) => x.id === addTarget.id);
                const checked = selPls.includes(pl.id);
                return (
                  <button key={pl.id} disabled={has}
                    onClick={() => setSelPls((s) => (checked ? s.filter((id) => id !== pl.id) : [...s, pl.id]))}
                    className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-[var(--s2)] text-left disabled:opacity-50">
                    <span className="w-5 h-5 rounded-md grid place-items-center shrink-0 transition"
                      style={{ border: '1px solid var(--bd)', background: checked ? 'var(--a)' : 'transparent' }}>
                      {(checked || has) && <span className="w-2.5 h-2.5 rounded-sm bg-white" />}
                    </span>
                    <span className="flex-1 min-w-0 text-sm truncate">{pl.name}</span>
                    <span className="text-[11px] shrink-0" style={{ color: 'var(--m)' }}>{has ? 'ya está' : pl.tracks.length}</span>
                  </button>
                );
              })}
            </div>
            <button className="btn w-full mt-2" disabled={!selPls.length}
              onClick={() => {
                let n = 0;
                for (const id of selPls) { if (pls.addTrack(id, addTarget, true)) n++; }
                toast?.(n ? `Agregada a ${n} playlist${n > 1 ? 's' : ''}` : 'Ya estaba en esas playlists');
                setAddTarget(null);
              }}>
              <Plus size={15} /> Agregar{selPls.length ? ` (${selPls.length})` : ''}
            </button>
            <form onSubmit={(e) => { e.preventDefault(); const pl = pls.create(newPlName); if (pl) { setSelPls((s) => [...s, pl.id]); setNewPlName(''); } }} className="flex gap-2 mt-2">
              <input className="inp !py-2" placeholder="Nueva playlist…" value={newPlName}
                onChange={(e) => setNewPlName(e.target.value)} maxLength={40} aria-label="Nueva playlist" />
              <button className="btn !py-2 shrink-0" aria-label="Crear y seleccionar playlist"><Plus size={15} /></button>
            </form>
          </div>
        </div>
      )}

      {/* Menú único ⋮ / long-press para cualquier canción */}
      {menuTrack && (
        <TrackMenu
          entry={menuTrack}
          p={p}
          toast={toast}
          local={local}
          onAdd={(t) => { setAddTarget(t); setMenuTrack(null); }}
          onClose={() => setMenuTrack(null)}
          onRadio={(t) => {
            if (menuTrack?.kind === 'chart' && menuTrack?.onPlay) menuTrack.onPlay(t);
            else p.startRadio?.(t);
          }}
          onDownload={(t) => {
            if (menuTrack?.kind === 'chart' && t && !t.src && !t.videoId) { downloadEntry(t); return; }
            descargarSong(t);
          }}
          onEnrich={(t) => (async () => {
            if (!navigator.onLine) { toast('Necesitas wifi para buscar carátulas', AlertTriangle); return; }
            toast('Buscando carátula…');
            const ok = await local?.enrichArt?.(t.id).catch(() => false);
            toast(ok ? 'Carátula real lista' : 'Sin carátula real, queda la generada', ok ? Check : AlertTriangle);
          })()}
          onDelete={(t) => local?.removeTrack?.(t.id)}
          canRadio={menuTrack?.kind !== 'local' && menuTrack?.kind !== 'pl' && menuTrack?.kind !== 'fav'}
          canDownload={menuTrack?.kind !== 'local'}
          canEnrich={menuTrack?.kind === 'local'}
          canDelete={menuTrack?.kind === 'local'}
        />
      )}

      <p className="text-[11px]" style={{ color: 'var(--m)' }}>
        Solo YouTube, siempre completo: oficiales primero, no disponibles ocultos. Playlists en este dispositivo.
      </p>
    </>
  );
}
