import { useEffect, useRef, useState } from 'react';
import { Play, Pause, Plus, ChevronDown, SkipBack, SkipForward, Heart, Volume2, VolumeX, Shuffle, Repeat, Repeat1, Maximize2 } from 'lucide-react';
import Cover from './Cover';
import Marquee from './Marquee';
import useArtColors from '../hooks/useArtColors';
import { fmtTime } from '../lib/format';

// Mini reproductor estilo Spotify con fondo BLANCO. Los controles toman el color de la canción
// (oscurecido para que se lea sobre blanco). Celular: carátula, título, +, play y ocultar.
// PC (lg): barra ancha con controles al centro, progreso y volumen. Se oculta con la flechita (sigue sonando).
const ink = (c) => `color-mix(in srgb, ${c} 72%, #000)`;

export default function MiniBarLight({ p, onOpenFull, onMin, queuePop }) {
  const t = p.track;
  const colors = useArtColors(t?.art);
  const [leaving, setLeaving] = useState(false);
  const [open, setOpen] = useState(false);
  const timer = useRef(null);
  useEffect(() => { setOpen(false); }, [t?.id]);
  useEffect(() => () => clearTimeout(timer.current), []);
  if (!t) return null;
  const hide = () => {
    if (leaving) return;
    setLeaving(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => onMin?.(), 200);
  };
  const c = ink(colors?.main || 'var(--a)'); // color de los controles
  const cur0 = p.time?.cur || 0;
  const dur0 = p.time?.dur;
  const dur = (isFinite(dur0) && dur0 > 0 ? dur0 : t.duration) || 0;
  const pct = dur > 0 ? Math.min(100, (cur0 / dur) * 100) : 0;
  const fav = p.isFav(t);
  const seekTo = (e) => { const r = e.currentTarget.getBoundingClientRect(); if (r.width && dur) p.seek(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)) * dur); };
  const seekKeys = (e) => { if (!dur) return; if (e.key === 'ArrowRight') { e.preventDefault(); p.seek(Math.min(dur, cur0 + 10)); } else if (e.key === 'ArrowLeft') { e.preventDefault(); p.seek(Math.max(0, cur0 - 10)); } };
  const btn = 'grid place-items-center min-w-[40px] min-h-[40px] rounded-full active:scale-90 transition';
  const light = { '--t': '#17171a', '--m': '#6b6b73', '--s': '#f4f4f6', '--s2': '#ececf0', '--bd': 'rgba(0,0,0,.1)', color: '#17171a' };
  const Rep = p.repeat === 'one' ? Repeat1 : Repeat;
  return (
    <div className="fixed inset-x-0 z-30 px-2 bottom-[calc(62px+env(safe-area-inset-bottom))] lg:bottom-3" role="region" aria-label={`Mini ${t.title}`}>
      <div className="relative mx-auto max-w-3xl lg:max-w-5xl">
        {open && (
          <div className="absolute bottom-[calc(100%+8px)] left-0 right-0 rounded-2xl p-3 modal-in" style={{ ...light, background: '#fff', border: '1px solid rgba(0,0,0,.08)', boxShadow: '0 -10px 40px rgba(0,0,0,.28)' }}>
            <div className="flex items-center gap-2 text-[12px] tabular-nums lg:hidden" style={{ color: '#55555d' }}>
              <span>{fmtTime(cur0)}</span>
              <div className="flex-1 rounded-full cursor-pointer py-3 -my-3" style={{ backgroundClip: 'content-box', background: 'rgba(0,0,0,.12)' }} onClick={seekTo} onKeyDown={seekKeys} tabIndex={0}
                role="slider" aria-label={`Progreso de ${t.title}`} aria-valuenow={Math.round(cur0)} aria-valuemin={0} aria-valuemax={Math.round(dur)}>
                <div className="h-1.5 rounded-full pointer-events-none" style={{ width: `${pct}%`, background: c }} />
              </div>
              <span>{fmtTime(dur)}</span>
            </div>
            <div className="mt-2 flex items-center justify-center gap-0.5 lg:hidden" style={{ color: c }}>
              <button className={btn} onClick={p.prev} aria-label="Anterior"><SkipBack size={21} fill="currentColor" /></button>
              <button className={btn} onClick={() => p.toggleFav(t)} aria-label={fav ? 'Quitar de favoritas' : 'Marcar favorita'} aria-pressed={fav ? 'true' : 'false'}><Heart size={21} fill={fav ? 'currentColor' : 'none'} /></button>
              <button className={btn} onClick={p.toggleMute} aria-label={p.muted ? 'Activar sonido' : 'Silenciar'}>{p.muted || p.volume === 0 ? <VolumeX size={21} /> : <Volume2 size={21} />}</button>
              <input type="range" min="0" max="1" step="0.05" value={p.muted ? 0 : p.volume} onChange={(e) => p.setVolume(+e.target.value)} className="w-24" style={{ accentColor: c }} aria-label="Volumen" />
              <button className={btn} onClick={() => p.next(false)} aria-label="Siguiente"><SkipForward size={21} fill="currentColor" /></button>
            </div>
            <div className="max-h-56 lg:max-h-72 overflow-y-auto mt-1">{queuePop}</div>
          </div>
        )}
        <div className={`relative overflow-hidden rounded-2xl bg-white ${leaving ? 'card-out' : 'card-in'}`}
          style={{ ...light, boxShadow: '0 10px 40px -8px rgba(0,0,0,.45), 0 0 0 1px rgba(0,0,0,.06)' }}>
          <div className="flex items-center gap-1.5 pl-2 pr-1.5 py-2 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_minmax(0,1fr)] lg:gap-4 lg:px-3">
            {/* Canción */}
            <button onClick={() => onOpenFull?.()} className="flex items-center gap-2.5 flex-1 min-w-0 text-left rounded-xl min-h-[48px] lg:flex-none" aria-label={`Abrir sonando: ${t.title} de ${t.artist}`}>
              <Cover src={t.art} className="w-11 h-11 lg:w-12 lg:h-12 !rounded-lg shrink-0" iconSize={15} alt={t.title} />
              <span className="flex-1 min-w-0">
                <Marquee className="text-[14px] font-semibold leading-tight">{t.title}</Marquee>
                <Marquee className="text-[12px] leading-tight" style={{ color: '#6b6b73' }}>{t.artist}</Marquee>
              </span>
            </button>
            {/* PC: controles centrales + progreso */}
            <div className="hidden lg:flex flex-col items-center gap-1 min-w-0" style={{ color: c }}>
              <div className="flex items-center gap-1.5">
                <button className={btn} onClick={p.toggleShuffle} aria-pressed={!!p.shuffle} aria-label="Aleatorio" style={{ opacity: p.shuffle ? 1 : 0.45 }}><Shuffle size={17} /></button>
                <button className={btn} onClick={p.prev} aria-label="Anterior"><SkipBack size={20} fill="currentColor" /></button>
                <button className="w-10 h-10 rounded-full grid place-items-center text-white active:scale-90 transition" style={{ background: c }} onClick={p.toggle} aria-label={p.playing ? 'Pausar' : 'Reproducir'}>
                  {p.playing ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-0.5" />}
                </button>
                <button className={btn} onClick={() => p.next(false)} aria-label="Siguiente"><SkipForward size={20} fill="currentColor" /></button>
                <button className={btn} onClick={p.cycleRepeat} aria-pressed={p.repeat !== 'off'} aria-label="Repetir" style={{ opacity: p.repeat !== 'off' ? 1 : 0.45 }}><Rep size={17} /></button>
              </div>
              <div className="w-full flex items-center gap-2 text-[11px] tabular-nums" style={{ color: '#6b6b73' }}>
                <span className="w-9 text-right">{fmtTime(cur0)}</span>
                <div className="flex-1 rounded-full cursor-pointer py-2 -my-2 group" style={{ backgroundClip: 'content-box', background: 'rgba(0,0,0,.12)' }} onClick={seekTo} onKeyDown={seekKeys} tabIndex={0}
                  role="slider" aria-label={`Progreso de ${t.title}`} aria-valuenow={Math.round(cur0)} aria-valuemin={0} aria-valuemax={Math.round(dur)}>
                  <div className="h-1 rounded-full pointer-events-none" style={{ width: `${pct}%`, background: c }} />
                </div>
                <span className="w-9">{fmtTime(dur)}</span>
              </div>
            </div>
            {/* Derecha */}
            <div className="flex items-center justify-end shrink-0" style={{ color: c }}>
              <button className={`${btn} hidden lg:grid`} onClick={() => p.toggleFav(t)} aria-label={fav ? 'Quitar de favoritas' : 'Marcar favorita'} aria-pressed={fav ? 'true' : 'false'}><Heart size={19} fill={fav ? 'currentColor' : 'none'} /></button>
              <span className="hidden lg:flex items-center gap-1.5">
                <button className={btn} onClick={p.toggleMute} aria-label={p.muted ? 'Activar sonido' : 'Silenciar'}>{p.muted || p.volume === 0 ? <VolumeX size={19} /> : <Volume2 size={19} />}</button>
                <input type="range" min="0" max="1" step="0.05" value={p.muted ? 0 : p.volume} onChange={(e) => p.setVolume(+e.target.value)} className="w-24" style={{ accentColor: c }} aria-label="Volumen" />
              </span>
              <button className={`${btn} hidden lg:grid`} onClick={() => onOpenFull?.()} aria-label="Abrir en pantalla completa" title="Pantalla completa"><Maximize2 size={17} /></button>
              <button className={btn} onClick={() => setOpen((o) => !o)} aria-label={open ? 'Cerrar ajustes y cola' : 'Abrir ajustes y cola'} aria-expanded={open ? 'true' : 'false'} title="Ajustes y cola">
                <Plus size={22} className={`transition-transform ${open ? 'rotate-45' : ''}`} />
              </button>
              <button className="lg:hidden w-11 h-11 rounded-full grid place-items-center text-white mx-0.5 active:scale-90 transition" style={{ background: c }} onClick={p.toggle} aria-label={p.playing ? `Pausar ${t.title}` : `Reproducir ${t.title}`}>
                {p.playing ? <Pause size={22} fill="currentColor" /> : <Play size={22} fill="currentColor" className="ml-0.5" />}
              </button>
              <button className={btn} style={{ color: '#8a8a93' }} onClick={hide} aria-label="Ocultar mini (sigue sonando)" title="Ocultar (sigue sonando)"><ChevronDown size={19} /></button>
            </div>
          </div>
          {/* Móvil: hilo de progreso en el borde inferior */}
          <div className="lg:hidden h-[3px] w-full" style={{ background: 'rgba(0,0,0,.08)' }} aria-hidden="true"><div className="h-full" style={{ width: `${pct}%`, background: c }} /></div>
        </div>
      </div>
    </div>
  );
}
