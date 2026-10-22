import { useRef, useState } from 'react';
import { Heart, MoreHorizontal, Quote, ListMusic, Headphones, Share2, Volume1, Volume2, Loader2 } from 'lucide-react';
import { fmtTime } from '../lib/format';
import Cover from './Cover';
import useArtColors from '../hooks/useArtColors';
import useParallax from '../hooks/useParallax';
import { contextOf } from '../lib/playContext';
import { FONT, useAudioOutput, usePlayerBits, lyricPreview, shareTrack, LyricsMode, PlayerSheet, CloseArrow } from './player/common';

const Rew = ({ s = 50 }) => <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M11 6v12l-8.5-6zM21 6v12l-8.5-6z" /></svg>;
const Fwd = ({ s = 50 }) => <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M13 6v12l8.5-6zM3 6v12l8.5-6z" /></svg>;
const PlayI = ({ s = 58 }) => <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4.5v15l13-7.5z" /></svg>;
const PauseI = ({ s = 58 }) => <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 4h4.2v16H6zM13.8 4H18v16h-4.2z" /></svg>;

/** Hermes 04 · BitChord — carátula que cubre la mitad superior y se difumina con su color,
 *  "Reproduciendo desde…", letra en vivo a pantalla completa, cola y opciones. */
export default function FullPlayerWave({ p, toast, onClose: onCloseProp }) {
  const t = p.track;
  const bits = usePlayerBits(p, toast, onCloseProp);
  const colors = useArtColors(t?.art);
  const device = useAudioOutput(true);
  const { trackRef, bgRef } = useParallax({ bg: 20, fg: 10 });
  const [sheet, setSheet] = useState(null); // null | 'cola' | 'mas'
  const [lyricsOpen, setLyricsOpen] = useState(false);
  const barRef = useRef(null);
  const scrub = useRef(false);
  const touch = useRef(null);
  const [dragY, setDragY] = useState(0);
  if (!t) return null;

  const swipe = {
    onTouchStart: (e) => { touch.current = e.touches[0].clientY; },
    onTouchMove: (e) => { if (touch.current != null) setDragY(Math.max(0, e.touches[0].clientY - touch.current)); },
    onTouchEnd: () => { if (dragY > 110) bits.onClose(); setDragY(0); touch.current = null; },
  };
  const dur = (isFinite(p.time?.dur) && p.time.dur > 0 ? p.time.dur : t.duration) || 0;
  const tReal = bits.tReal;
  const pct = dur > 0 ? Math.min(100, (tReal / dur) * 100) : 0;
  const main = colors?.main || '#8a5a2b';
  const ctx = contextOf(t);
  const seekBar = (x) => {
    const el = barRef.current;
    if (!el || !dur) return;
    const r = el.getBoundingClientRect();
    if (r.width) p.seek(Math.min(1, Math.max(0, (x - r.left) / r.width)) * dur);
  };

  const progress = (
    <div>
      <div ref={barRef} className="cursor-pointer touch-none select-none py-3.5 -my-3" tabIndex={0} role="slider" aria-label="Progreso"
        aria-valuemin={0} aria-valuemax={Math.round(dur)} aria-valuenow={Math.round(tReal)}
        onPointerDown={(e) => { if (!dur) return; scrub.current = true; e.currentTarget.setPointerCapture?.(e.pointerId); seekBar(e.clientX); }}
        onPointerMove={(e) => { if (scrub.current) seekBar(e.clientX); }}
        onPointerUp={() => { scrub.current = false; }} onPointerCancel={() => { scrub.current = false; }}
        onKeyDown={(e) => { if (!dur) return; if (e.key === 'ArrowRight') { e.preventDefault(); p.seek(Math.min(dur, tReal + 10)); } else if (e.key === 'ArrowLeft') { e.preventDefault(); p.seek(Math.max(0, tReal - 10)); } }}>
        <div className="h-[5px] rounded-full pointer-events-none" style={{ background: 'rgba(255,255,255,.3)' }}><div className="h-full rounded-full bg-white" style={{ width: `${pct}%` }} /></div>
      </div>
      <div className="flex justify-between text-[14px] tabular-nums mt-1.5" style={{ color: 'rgba(255,255,255,.75)' }}>
        <span>{fmtTime(tReal)}</span><span>{p.resolving ? 'cargando…' : `-${fmtTime(Math.max(0, dur - tReal))}`}</span>
      </div>
    </div>
  );
  const transport = (s1 = 50, s2 = 58) => (
    <div className="flex items-center justify-between px-6">
      <button onClick={p.prev} aria-label="Anterior" className="text-white min-w-[64px] min-h-[64px] grid place-items-center active:scale-90 transition"><Rew s={s1} /></button>
      <button onClick={p.toggle} aria-label={p.playing ? 'Pausar' : 'Reproducir'} aria-busy={p.resolving ? 'true' : undefined} className="text-white min-w-[76px] min-h-[76px] grid place-items-center active:scale-90 transition">
        {p.resolving ? <Loader2 size={s2} className="animate-spin" /> : p.playing ? <PauseI s={s2} /> : <PlayI s={s2} />}
      </button>
      <button onClick={() => p.next(false)} aria-label="Siguiente" className="text-white min-w-[64px] min-h-[64px] grid place-items-center active:scale-90 transition"><Fwd s={s1} /></button>
    </div>
  );
  // Botón de letra: se ve claramente si está activo (círculo blanco) o apagado (solo icono)
  const lyricsBtn = (
    <button onClick={() => setLyricsOpen((v) => !v)} aria-pressed={lyricsOpen} aria-label={lyricsOpen ? 'Cerrar la letra' : 'Ver la letra'}
      className="justify-self-start min-w-[52px] min-h-[52px] rounded-full grid place-items-center transition active:scale-90"
      style={lyricsOpen ? { background: '#fff', color: '#111' } : { color: 'rgba(255,255,255,.92)' }}>
      <Quote size={24} fill="currentColor" />
    </button>
  );
  const pill = (
    <div className="justify-self-center flex items-center rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,.16)' }}>
      <button className="px-6 py-3 min-h-[48px]" onClick={() => p.swapToBg?.(true)} aria-label="Seguir en segundo plano" title="Segundo plano"><Headphones size={22} strokeWidth={1.8} color="#fff" /></button>
      <span className="w-px h-6 bg-white/25" />
      <button className="px-6 py-3 min-h-[48px]" onClick={() => shareTrack(t, toast)} aria-label="Compartir"><Share2 size={21} strokeWidth={1.8} color="#fff" /></button>
    </div>
  );
  const queueBtn = (
    <button className="justify-self-end min-w-[52px] min-h-[52px] grid place-items-center active:scale-90 transition" onClick={() => setSheet('cola')} aria-label={`Cola, ${p.queue.length} temas`}><ListMusic size={27} strokeWidth={1.7} color="rgba(255,255,255,.92)" /></button>
  );
  const toolbar = <div className="grid grid-cols-3 items-center">{lyricsBtn}{pill}{queueBtn}</div>;

  return (
    <div className={`fixed inset-0 z-40 overflow-hidden ${bits.closing ? 'player-out' : 'player-in'}`} role="dialog" aria-modal="true" aria-label="Sonando"
      style={{ fontFamily: FONT, color: '#fff', background: main, ...(dragY ? { transform: `translateY(${dragY}px)`, transition: 'none' } : undefined) }}>
      {/* Carátula: cubre la mitad superior y se difumina con su propio color */}
      <div className="absolute top-0 inset-x-0 overflow-hidden" style={{ height: '56dvh', minHeight: 'min(320px, 70dvh)' }}>
        {t.art
          ? <div ref={bgRef} className="parallax-bg absolute -inset-6"><img src={t.art} alt="" aria-hidden="true" draggable={false} referrerPolicy="no-referrer" fetchPriority="high" decoding="async" className="w-full h-full object-cover object-center" /></div>
          : <Cover src={t.art} alt={t.title} iconSize={48} className="absolute inset-0 w-full h-full" />}
        <div className="absolute inset-0" style={{ background: `linear-gradient(180deg, rgba(0,0,0,.28) 0%, transparent 18%, color-mix(in srgb, ${main} 45%, transparent) 55%, ${main} 90%, ${main} 100%)` }} />
      </div>

      <div ref={trackRef} className="relative h-full overflow-y-auto">
        <div className="mx-auto w-full max-w-md px-5 pt-[max(0.6rem,env(safe-area-inset-top))] pb-[max(1.2rem,env(safe-area-inset-bottom))] min-h-full flex flex-col">
          {/* Flecha hacia abajo + de dónde se escucha */}
          <div {...swipe} className="grid grid-cols-[44px_1fr_44px] items-center -mx-2" style={{ touchAction: 'pan-y' }}>
            <CloseArrow onClick={bits.onClose} />
            <button onClick={() => setSheet('cola')} className="text-center min-w-0 py-1" aria-label="Ver la cola">
              <span className="block text-[11px] tracking-wide text-white/80">Reproduciendo desde</span>
              <span className="block text-[14px] font-bold truncate" style={{ textShadow: '0 1px 8px rgba(0,0,0,.45)' }}>{ctx.from}{ctx.title ? ` · ${ctx.title}` : ''}</span>
            </button>
            <span />
          </div>

          <div {...swipe} className="flex-none" style={{ height: '36dvh', minHeight: 'min(230px, 48dvh)', touchAction: 'pan-y' }} aria-hidden="true" />

          <div className="flex items-center gap-2.5">
            <div className="flex-1 min-w-0">
              <p className="text-[26px] font-bold leading-tight truncate" title={t.title} style={{ textShadow: '0 1px 12px rgba(0,0,0,.4)' }}>{t.title}</p>
              <p className="text-[21px] truncate" title={t.artist} style={{ color: 'rgba(255,255,255,.72)' }}>{t.artist}</p>
            </div>
            <button onClick={() => p.toggleFav(t)} aria-pressed={p.isFav(t) ? 'true' : 'false'} aria-label={p.isFav(t) ? 'Quitar de me gusta' : 'Me gusta'} className="w-12 h-12 rounded-full grid place-items-center shrink-0" style={{ background: 'rgba(255,255,255,.18)' }}><Heart size={21} strokeWidth={1.8} fill={p.isFav(t) ? '#fff' : 'none'} /></button>
            <button onClick={() => setSheet('mas')} aria-label="Más opciones" className="w-12 h-12 rounded-full grid place-items-center shrink-0" style={{ background: 'rgba(255,255,255,.18)' }}><MoreHorizontal size={21} strokeWidth={1.8} /></button>
          </div>

          {/* Vista previa de la letra en vivo (toca para abrirla) */}
          <button onClick={() => setLyricsOpen(true)} className="mt-5 min-h-[2.2rem] w-full text-left" aria-label="Abrir la letra">
            <span className="block text-[20px] font-semibold leading-snug line-clamp-2" style={{ color: bits.hasLyrics ? '#fff' : 'rgba(255,255,255,.7)' }}>{lyricPreview(bits.lrc, bits.lines, bits.activeIdx)}</span>
          </button>

          <div className="mt-3">{progress}</div>
          <div className="mt-5">{transport()}</div>

          <div className="mt-5 mx-auto w-full max-w-[300px] flex items-center gap-3">
            <Volume1 size={15} color="rgba(255,255,255,.7)" />
            <input type="range" min="0" max="1" step="0.05" value={p.muted ? 0 : p.volume} onChange={(e) => p.setVolume(+e.target.value)} className="flex-1 h-[4px] cursor-pointer" style={{ accentColor: '#fff' }} aria-label="Volumen" />
            <Volume2 size={18} color="rgba(255,255,255,.8)" />
          </div>

          <div className="mt-4">{toolbar}</div>
          <p className="mt-2 text-center text-[12px] font-semibold tracking-[0.18em] uppercase" style={{ color: 'rgba(255,255,255,.6)' }}>{device}</p>
        </div>
      </div>

      {lyricsOpen && (
        <LyricsMode t={t} colors={colors} lrc={bits.lrc} lines={bits.lines} activeIdx={bits.activeIdx} onSeek={p.seek} onShare={() => shareTrack(t, toast)}
          controls={(
            <div className="space-y-3">
              {progress}
              {transport(40, 48)}
              <div className="grid grid-cols-3 items-center">{lyricsBtn}<p className="justify-self-center text-[11px] font-semibold tracking-[0.16em] uppercase text-white/60 truncate max-w-[10rem]">{device}</p>{queueBtn}</div>
            </div>
          )} />
      )}
      {sheet && <PlayerSheet p={p} toast={toast} bits={bits} initial={sheet} onClose={() => setSheet(null)} />}
    </div>
  );
}
