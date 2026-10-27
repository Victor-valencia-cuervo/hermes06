import { useRef } from 'react';
import { Play, Pause, Heart, MoreVertical } from 'lucide-react';
import Cover from './Cover';
import Marquee from './Marquee';
import ModeBadge from './ModeBadge';

// Long-press 550ms: suficiente para no chocar con scroll, sin cansar el dedo.
const LONG_MS = 550;
const MOVE_PX = 12;

export default function TrackRow({ t, p, list, onMenu, asRadio, meta, wrap }) {
  const active = p.track?.id === t.id;
  const fav = p.isFav(t);
  // Tocar la canción que ya suena abre el Sonando en grande;
  // otra cualquiera suena (en orden o por radio según la lista).
  const go = () => {
    if (active) { p.openFull?.(); return; }
    (asRadio && p.playRadio ? p.playRadio(t) : p.play(t, list));
  };
  const openMenu = () => {
    try { navigator.vibrate?.(10); } catch {}
    if (typeof onMenu === 'function') onMenu(t);
  };

  // Long-press: mantiene 900ms sin mover el dedo -> abre el menú.
  const timer = useRef(null);
  const moved = useRef(false);
  const fired = useRef(false);
  const sx = useRef(0);
  const sy = useRef(0);
  const clear = () => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
  };
  const onDown = (e) => {
    fired.current = false;
    moved.current = false;
    try {
      const pt = e.touches?.[0] || e;
      sx.current = pt.clientX || 0;
      sy.current = pt.clientY || 0;
    } catch { sx.current = 0; sy.current = 0; }
    clear();
    timer.current = setTimeout(() => {
      if (!moved.current) {
        fired.current = true;
        openMenu();
      }
    }, LONG_MS);
  };
  const onMove = (e) => {
    try {
      const pt = e.touches?.[0] || e;
      const dx = Math.abs((pt.clientX || 0) - sx.current);
      const dy = Math.abs((pt.clientY || 0) - sy.current);
      if (dx > MOVE_PX || dy > MOVE_PX) { moved.current = true; clear(); }
    } catch { /* noop */ }
  };
  const onUp = () => { clear(); };
  const onClickGo = () => {
    // Si acaba de disparar el long-press, no reproducir.
    if (fired.current) { fired.current = false; return; }
    go();
  };

  const toggleActive = () => {
    if (fired.current) { fired.current = false; return; }
    if (active) { p.toggle?.(); return; }
    go();
  };

  return (
    <div className={`rounded-2xl transition-colors ${active ? 'acc-soft' : 'hover:bg-[var(--s2)]'}`} aria-current={active ? 'true' : undefined}>
      <div className="flex items-center gap-1.5 p-1.5 sm:gap-2 sm:p-2">
        <Cover src={t.art} className="w-12 h-12 rounded-xl shrink-0" alt={t.title} />
        <button
          onClick={onClickGo}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerLeave={onUp}
          onPointerCancel={onUp}
          onContextMenu={(e) => { e.preventDefault(); openMenu(); }}
          className="flex-1 min-w-0 text-left select-none rounded-xl px-1 py-2 focus-visible:outline-2 focus-visible:outline-[var(--a)]"
          title={`${t.title} — ${t.artist}`}
          aria-label={active ? `Abrir sonando: ${t.title}` : `Reproducir ${t.title} de ${t.artist}`}
          style={{ WebkitTouchCallout: 'none' }}
        >
          {wrap
            ? <p className="text-[15px] line-clamp-2 leading-snug break-words" style={{ color: active ? 'var(--a)' : undefined }}>{t.title}</p>
            : <Marquee className="text-[15px]" style={{ color: active ? 'var(--a)' : undefined }}>{t.title}</Marquee>}
          <div className="text-[13px] flex items-center gap-1.5 min-w-0" style={{ color: active ? 'var(--a)' : 'var(--m)', opacity: active ? .85 : 1 }}><ModeBadge t={t} compact /><Marquee className="flex-1">{t.artist}</Marquee></div>
        </button>
        <button className="ico-btn shrink-0 !min-w-[44px] !min-h-[44px]" onClick={toggleActive} aria-label={active && p.playing ? `Pausar ${t.title}` : `Reproducir ${t.title}`} aria-pressed={active && p.playing ? 'true' : 'false'} title={active && p.playing ? 'Pausar' : 'Reproducir'}>{active && p.playing ? <Pause size={19} /> : <Play size={19} />}</button>
        <button className="ico-btn shrink-0 !min-w-[44px] !min-h-[44px]" onClick={() => p.toggleFav(t)} aria-label={fav ? `Quitar de me gusta: ${t.title}` : `Me gusta: ${t.title}`} aria-pressed={fav ? 'true' : 'false'} title="Me gusta"><Heart size={19} fill={fav ? 'var(--a)' : 'none'} style={{ color: fav ? 'var(--a)' : undefined }} /></button>
        <button className="ico-btn shrink-0 !min-w-[44px] !min-h-[44px]" onClick={openMenu} aria-label={`Opciones de ${t.title}`} aria-haspopup="menu" title="Opciones"><MoreVertical size={19} /></button>
      </div>
      {meta && <div className="px-2 pb-2 -mt-1 min-w-0">{meta}</div>}
    </div>
  );
}
