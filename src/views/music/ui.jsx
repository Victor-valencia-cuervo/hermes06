import { useRef, useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Play, Pause, Loader2, MoreVertical, User, Shuffle } from 'lucide-react';
import Cover from '../../components/Cover';
import Marquee from '../../components/Marquee';
import { fmtTime } from '../../lib/format';

/** Título de sección: grande y llamativo, solo tipografía Hermes y el color actual (sin iconos). */
export function SectionTitle({ title, sub, action, className = '' }) {
  return (
    <div className={`flex items-end justify-between gap-3 mb-3 ${className}`}>
      <div className="min-w-0">
        <h3 className="serif text-[2rem] sm:text-4xl font-semibold leading-none tracking-tight truncate">{title}</h3>
        {/* Sin subtítulo descriptivo: las secciones solo llevan el título (el parámetro `sub` se ignora a propósito) */}
      </div>
      {action}
    </div>
  );
}

export function Section({ title, sub, action, children, className = '', glass = false }) {
  return (
    <section className={className}>
      <SectionTitle title={title} sub={sub} action={action} />
      {glass ? <GlassPanel>{children}</GlassPanel> : children}
    </section>
  );
}

/** Panel de vidrio degradado (blur + brillo), el mismo efecto del modo inmersivo del reproductor. */
export function GlassPanel({ children, className = '' }) {
  return <div className={`glass-panel ${className}`}>{children}</div>;
}

/** Fondo de la página con la imagen difuminada, para que el vidrio tenga color que traspasar. */
export function GlassBackdrop({ img }) {
  if (!img) return null;
  return <div className="glass-backdrop" aria-hidden="true"><img src={img} alt="" referrerPolicy="no-referrer" /></div>;
}

/** Carrusel horizontal (overflow): se desliza con el dedo/trackpad y en PC tiene flechas. */
export function Shelf({ children, className = '' }) {
  const ref = useRef(null);
  const [edge, setEdge] = useState({ l: false, r: false });
  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setEdge({ l: el.scrollLeft > 8, r: el.scrollLeft + el.clientWidth < el.scrollWidth - 8 });
  }, []);
  useEffect(() => {
    measure();
    const el = ref.current;
    if (!el) return undefined;
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, [measure, children]);
  const go = (dir) => ref.current?.scrollBy({ left: dir * Math.max(240, ref.current.clientWidth * 0.8), behavior: 'smooth' });
  const arrow = 'hidden lg:grid absolute top-[38%] -translate-y-1/2 z-10 w-10 h-10 rounded-full place-items-center glass shadow-lg active:scale-90 transition';
  return (
    <div className={`relative group/shelf ${className}`}>
      <div ref={ref} onScroll={measure}
        className="flex gap-4 overflow-x-auto pb-2 -mx-5 px-5 lg:-mx-10 lg:px-10 snap-x snap-proximity overscroll-x-contain">
        {children}
      </div>
      {edge.l && <button className={`${arrow} left-1`} onClick={() => go(-1)} aria-label="Anterior"><ChevronLeft size={20} /></button>}
      {edge.r && <button className={`${arrow} right-1`} onClick={() => go(1)} aria-label="Siguiente"><ChevronRight size={20} /></button>}
    </div>
  );
}

/** Tarjeta cuadrada (álbum, canción, playlist). Sin botón de descargar: eso vive en el menú ⋮. */
export function SquareCard({ art, title, sub, onClick, spinning, badge, active, playing, label }) {
  return (
    <button onClick={onClick} aria-label={label || `Abrir ${title}`}
      className="snap-start w-[10.25rem] sm:w-[12.5rem] text-left shrink-0 group rounded-2xl focus-visible:outline-2 focus-visible:outline-[var(--a)] focus-visible:outline-offset-2">
      <div className="relative w-[10.25rem] h-[10.25rem] sm:w-[12.5rem] sm:h-[12.5rem] rounded-2xl overflow-hidden shadow-xl transition-transform group-hover:-translate-y-0.5 group-active:scale-[.97]"
        style={active ? { boxShadow: '0 0 0 2px var(--a)' } : undefined}>
        <Cover src={art} className="w-full h-full" iconSize={28} alt={title} />
        <span className="absolute inset-0 grid place-items-center bg-black/35 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity" aria-hidden="true">
          {spinning ? <Loader2 size={26} className="animate-spin text-white" /> : active && playing ? <Pause size={26} className="text-white" fill="currentColor" /> : <Play size={26} className="text-white" fill="currentColor" />}
        </span>
        {!!badge && <span className="absolute top-1.5 left-1.5 text-[10px] font-bold px-2 py-1 rounded-full text-white max-w-[calc(100%-12px)] truncate" style={{ background: 'color-mix(in srgb, var(--a) 88%, #000)' }}>{badge}</span>}
      </div>
      <Marquee className="text-[15px] font-semibold mt-2 leading-snug">{title}</Marquee>
      <Marquee className="text-[13px] leading-snug" style={{ color: 'var(--m)' }}>{sub}</Marquee>
    </button>
  );
}

/** Artista: foto real redonda + nombre (como Spotify). */
export function ArtistBubble({ artist, onClick, size = 'md' }) {
  const d = size === 'lg' ? 'w-[10.25rem] h-[10.25rem] sm:w-[12.5rem] sm:h-[12.5rem]' : 'w-[8.5rem] h-[8.5rem] sm:w-[10.5rem] sm:h-[10.5rem]';
  const w = size === 'lg' ? 'w-[10.25rem] sm:w-[12.5rem]' : 'w-[8.5rem] sm:w-[10.5rem]';
  const [err, setErr] = useState(false);
  useEffect(() => { setErr(false); }, [artist?.art]);
  const initial = (String(artist?.name || '?').trim()[0] || '?').toUpperCase();
  return (
    <button onClick={onClick} aria-label={`Abrir artista ${artist?.name}`} className={`snap-start ${w} shrink-0 group text-center focus-visible:outline-2 focus-visible:outline-[var(--a)] rounded-2xl`}>
      {artist?.art && !err ? (
        <img src={artist.art} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setErr(true)}
          className={`${d} mx-auto rounded-full object-cover shadow-lg transition-transform group-hover:scale-[1.03] group-active:scale-95`} style={{ background: 'var(--s2)' }} />
      ) : (
        <span className={`${d} mx-auto rounded-full grid place-items-center text-white text-4xl font-bold shadow-lg`}
          style={{ background: 'linear-gradient(135deg, var(--a), #312e81)' }}>{initial || <User />}</span>
      )}
      <Marquee className="text-[15px] font-semibold mt-2.5 leading-snug">{artist?.name}</Marquee>
      <p className="text-[12px]" style={{ color: 'var(--m)' }}>Artista</p>
    </button>
  );
}

/** Fila de canción estilo Spotify: n.º / carátula, título, artista, duración, ▶ y ⋮. */
export function SongRow({ n, art, title, sub, duration, explicit, active, playing, loading, onPlay, onMenu, extra }) {
  return (
    <div className={`group flex items-center gap-3.5 px-2 py-2 rounded-2xl transition-colors ${active ? 'acc-soft' : 'hover:bg-[var(--s2)]'}`}>
      {n != null && <span className="w-6 text-center text-sm tabular-nums shrink-0" style={{ color: active ? 'var(--a)' : 'var(--m)' }}>{n}</span>}
      <button onClick={onPlay} className="relative shrink-0" aria-label={`Reproducir ${title}`}>
        <Cover src={art} className="w-14 h-14 rounded-xl" alt={title} />
        <span className="absolute inset-0 grid place-items-center rounded-xl bg-black/45 text-white opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity">
          {loading ? <Loader2 size={18} className="animate-spin" /> : active && playing ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
        </span>
      </button>
      <button onClick={onPlay} className="flex-1 min-w-0 text-left py-1.5">
        <div className="flex items-center gap-1.5 min-w-0" style={{ color: active ? 'var(--a)' : undefined }}>
          <Marquee className="text-[15px] flex-1">{title}</Marquee>
          {explicit && <span className="text-[9px] font-bold px-1 rounded shrink-0" style={{ background: 'var(--s2)', color: 'var(--m)' }}>E</span>}
        </div>
        <Marquee className="text-[13px]" style={{ color: 'var(--m)' }}>{sub}</Marquee>
      </button>
      {extra}
      {!!duration && <span className="text-xs tabular-nums shrink-0 hidden sm:block" style={{ color: 'var(--m)' }}>{fmtTime(duration)}</span>}
      {onMenu && (
        <button className="ico-btn shrink-0 !min-w-[44px] !min-h-[44px]" onClick={onMenu} aria-label={`Opciones de ${title}`}><MoreVertical size={19} /></button>
      )}
    </div>
  );
}

/** (Antes: barra con botón de volver.) Ahora la flecha de volver vive en la cabecera de la app, junto al menú. */
export function BackBar() { return null; }

/** Chips de filtro (Todo / Canciones / Artistas / Álbumes). */
export function Chips({ items, value, onChange }) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 -mx-5 px-5 lg:mx-0 lg:px-0" role="tablist">
      {items.map(([id, label]) => {
        const on = value === id;
        return (
          <button key={id} role="tab" aria-selected={on} onClick={() => onChange(id)}
            className="shrink-0 px-4 h-10 rounded-full text-sm font-semibold transition active:scale-95"
            style={on ? { background: 'var(--a)', color: '#fff' } : { background: 'var(--s2)', color: 'var(--t)', border: '1px solid var(--bd)' }}>
            {label}
          </button>
        );
      })}
    </div>
  );
}

export function ShelfSkeleton({ round = false, n = 6 }) {
  return (
    <div className="flex gap-3.5 overflow-hidden -mx-5 px-5" aria-hidden="true">
      {Array.from({ length: n }, (_, i) => (
        <div key={i} className="shrink-0">
          <div className={`skel ${round ? 'rounded-full w-[7.5rem] h-[7.5rem] sm:w-[9.5rem] sm:h-[9.5rem]' : 'rounded-2xl w-[8.75rem] h-[8.75rem] sm:w-[11rem] sm:h-[11rem]'}`} />
          <div className="skel h-3.5 w-24 mt-3" />
          <div className="skel h-3 w-16 mt-2" />
        </div>
      ))}
    </div>
  );
}

export function RowsSkeleton({ n = 5 }) {
  return (
    <div className="space-y-2" aria-hidden="true">
      {Array.from({ length: n }, (_, i) => (
        <div key={i} className="flex items-center gap-3 px-2 py-1.5">
          <div className="skel w-12 h-12 rounded-lg shrink-0" />
          <div className="flex-1"><div className="skel h-3.5 w-1/2" /><div className="skel h-3 w-1/3 mt-2" /></div>
        </div>
      ))}
    </div>
  );
}

/** Cabecera inmersiva (artista/álbum): imagen que cubre la parte superior y se difumina con su propio color.
 *  El menú y la flecha de volver (de la cabecera de la app) flotan sobre la imagen. */
export function ImmersivePage({ img, tint, onBack, children, alt = '' }) {
  const c = tint || 'var(--s2)';
  return (
    <div className="-mx-5 -mt-4 lg:mx-0 lg:mt-0 lg:rounded-[2rem] overflow-hidden pb-6" style={{ background: `linear-gradient(180deg, ${c} 0%, color-mix(in srgb, ${c} 35%, var(--bg)) 60%, var(--bg) 100%)` }}>
      <div className="relative h-[54dvh] max-h-[34rem] min-h-[20rem] lg:h-[26rem]">
        {img
          ? <img src={img} alt={alt} referrerPolicy="no-referrer" fetchPriority="high" decoding="async" className="absolute inset-0 w-full h-full object-cover object-top" />
          : <div className="absolute inset-0 skel" />}
        <div className="absolute inset-0" style={{ background: `linear-gradient(180deg, rgba(0,0,0,.38) 0%, transparent 24%, transparent 40%, color-mix(in srgb, ${c} 60%, transparent) 72%, ${c} 100%)` }} />
      </div>
      <div className="relative -mt-14 px-5 lg:px-8">{children}</div>
    </div>
  );
}

/** Botones redondos de acción: aleatorio · reproducir (grande) · seguir/estrella. */
export function ActionRow({ onShuffle, onPlay, busy, extra, disabled }) {
  return (
    <div className="flex items-center justify-center gap-5 mt-4">
      <button onClick={onShuffle} disabled={disabled} aria-label="Aleatorio" className="w-14 h-14 rounded-full grid place-items-center active:scale-90 transition disabled:opacity-40" style={{ background: 'rgba(255,255,255,.14)', color: 'var(--t)' }}><Shuffle size={22} /></button>
      <button onClick={onPlay} disabled={disabled} aria-label="Reproducir" className="w-[4.6rem] h-[4.6rem] rounded-full grid place-items-center active:scale-95 transition disabled:opacity-40" style={{ background: '#fff', color: '#000' }}>
        {busy ? <Loader2 size={30} className="animate-spin" /> : <Play size={32} fill="currentColor" style={{ marginLeft: 3 }} />}
      </button>
      {extra}
    </div>
  );
}
