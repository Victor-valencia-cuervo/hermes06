import { useRef, useState } from 'react';
import { Plus, Check, MoreVertical, Shuffle, Timer, Headphones, Share2, ListMusic, Loader2, ChevronRight } from 'lucide-react';
import { fmtTime } from '../lib/format';
import Cover from './Cover';
import useArtColors from '../hooks/useArtColors';
import { contextOf } from '../lib/playContext';
import { FONT, useAudioOutput, usePlayerBits, lyricPreview, shareTrack, LyricsMode, PlayerSheet, CloseArrow } from './player/common';

const GREEN = '#1ed760';
const Prev = ({ s = 34 }) => <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 5h2.2v14H6zM20 5v14L9.5 12z" /></svg>;
const Next = ({ s = 34 }) => <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M15.8 5H18v14h-2.2zM4 5l10.5 7L4 19z" /></svg>;

/** Hermes 03 · Spotify — carátula cuadrada, fondo del color de la canción, "Reproduciendo desde",
 *  controles clásicos, dispositivo de salida y tarjeta con vista previa de la letra. */
export default function FullPlayerSpotify({ p, toast, onClose: onCloseProp }) {
  const t = p.track;
  const bits = usePlayerBits(p, toast, onCloseProp);
  const colors = useArtColors(t?.art);
  const device = useAudioOutput(true);
  const [sheet, setSheet] = useState(null);
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
  const main = colors?.main || '#7a1d1d';
  const ctx = contextOf(t);
  const fav = p.isFav(t);
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
        <div className="relative h-1 rounded-full pointer-events-none" style={{ background: 'rgba(255,255,255,.3)' }}>
          <div className="h-full rounded-full bg-white" style={{ width: `${pct}%` }} />
          <span className="absolute top-1/2 w-3 h-3 rounded-full bg-white shadow" style={{ left: `${pct}%`, transform: 'translate(-50%,-50%)' }} />
        </div>
      </div>
      <div className="flex justify-between text-[12px] tabular-nums mt-2" style={{ color: 'rgba(255,255,255,.7)' }}>
        <span>{fmtTime(tReal)}</span><span>{p.resolving ? 'cargando…' : fmtTime(dur)}</span>
      </div>
    </div>
  );
  const playBtn = (size = 64) => (
    <button onClick={p.toggle} aria-label={p.playing ? 'Pausar' : 'Reproducir'} aria-busy={p.resolving ? 'true' : undefined}
      className="rounded-full grid place-items-center active:scale-95 transition" style={{ width: size, height: size, background: '#fff', color: '#000' }}>
      {p.resolving ? <Loader2 size={size * .45} className="animate-spin" /> : p.playing
        ? <svg width={size * .4} height={size * .4} viewBox="0 0 24 24" fill="currentColor"><path d="M6 4h4.2v16H6zM13.8 4H18v16h-4.2z" /></svg>
        : <svg width={size * .42} height={size * .42} viewBox="0 0 24 24" fill="currentColor" style={{ marginLeft: 3 }}><path d="M7 4.5v15l13-7.5z" /></svg>}
    </button>
  );
  const controls = (size = 64, ps = 34) => (
    <div className="flex items-center justify-between">
      <button onClick={() => p.toggleShuffle?.()} aria-pressed={p.shuffle ? 'true' : 'false'} aria-label="Aleatorio" className="w-12 h-12 grid place-items-center active:scale-90 transition" style={{ color: p.shuffle ? GREEN : '#fff' }}>
        <span className="flex flex-col items-center"><Shuffle size={25} />{p.shuffle && <i className="w-1 h-1 rounded-full mt-0.5" style={{ background: GREEN }} />}</span>
      </button>
      <button onClick={p.prev} aria-label="Anterior" className="w-14 h-14 grid place-items-center text-white active:scale-90 transition"><Prev s={ps} /></button>
      {playBtn(size)}
      <button onClick={() => p.next(false)} aria-label="Siguiente" className="w-14 h-14 grid place-items-center text-white active:scale-90 transition"><Next s={ps} /></button>
      <button onClick={() => setSheet('mas')} aria-label="Temporizador y más" className="w-12 h-12 grid place-items-center active:scale-90 transition" style={{ color: bits.sleepMin ? GREEN : '#fff' }}>
        {bits.sleepMin ? <span className="flex flex-col items-center"><Timer size={24} /><span className="text-[9px] font-bold tabular-nums">{fmtTime(bits.sleepLeft)}</span></span> : <Timer size={25} />}
      </button>
    </div>
  );
  const previewLines = (() => {
    if (!bits.lines.length) return [lyricPreview(bits.lrc, bits.lines, bits.activeIdx)];
    const i = Math.max(0, bits.activeIdx);
    return bits.lines.slice(i, i + 4).map((l) => l.x || '♪');
  })();

  return (
    <div className={`fixed inset-0 z-40 overflow-hidden ${bits.closing ? 'player-out' : 'player-in'}`} role="dialog" aria-modal="true" aria-label="Sonando"
      style={{ fontFamily: FONT, color: '#fff', background: `linear-gradient(180deg, color-mix(in srgb, ${main} 70%, #000) 0%, color-mix(in srgb, ${main} 22%, #0b0b0b) 62%, #0b0b0b 100%)`, ...(dragY ? { transform: `translateY(${dragY}px)`, transition: 'none' } : undefined) }}>
      <div className="h-full overflow-y-auto">
        <div className="mx-auto w-full max-w-md px-6 pt-[max(0.6rem,env(safe-area-inset-top))] pb-[max(1.4rem,env(safe-area-inset-bottom))] min-h-full flex flex-col">
          {/* Cabecera: flecha ↓ · Reproduciendo desde · ⋮ */}
          <div {...swipe} className="grid grid-cols-[48px_1fr_48px] items-center -mx-3" style={{ touchAction: 'pan-y' }}>
            <CloseArrow onClick={bits.onClose} />
            <div className="text-center min-w-0">
              <p className="text-[12px] text-white/85">Reproduciendo desde {ctx.from}</p>
              <p className="text-[14px] font-bold truncate">{ctx.title || ctx.from}</p>
            </div>
            <button onClick={() => setSheet('mas')} aria-label="Más opciones" className="w-11 h-11 grid place-items-center"><MoreVertical size={22} /></button>
          </div>

          {/* Carátula cuadrada */}
          <div {...swipe} className="flex-1 grid place-items-center py-5 min-h-[18rem]" style={{ touchAction: 'pan-y' }}>
            <div className="w-full aspect-square max-h-[48dvh] max-w-[48dvh] rounded-md overflow-hidden transition-transform duration-500" style={{ boxShadow: '0 18px 50px -12px rgba(0,0,0,.65)', transform: p.playing ? 'scale(1)' : 'scale(.94)' }}>
              <Cover src={t.art} alt={t.title} iconSize={56} className="w-full h-full" />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-[24px] font-bold leading-tight line-clamp-2 break-words" title={t.title}>{t.title}</p>
              <p className="text-[16px] mt-0.5 truncate flex items-center gap-2" style={{ color: 'rgba(255,255,255,.7)' }}>
                {t.explicit && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-sm shrink-0" style={{ background: 'rgba(255,255,255,.55)', color: '#000' }}>E</span>}
                <span className="truncate">{t.artist}</span>
              </p>
            </div>
            <button onClick={() => p.toggleFav(t)} aria-pressed={fav ? 'true' : 'false'} aria-label={fav ? 'Quitar de tu biblioteca' : 'Guardar en tu biblioteca'}
              className="w-10 h-10 rounded-full grid place-items-center shrink-0 active:scale-90 transition" style={fav ? { background: GREEN, color: '#000' } : { border: '2px solid #fff' }}>
              {fav ? <Check size={22} strokeWidth={3} /> : <Plus size={22} strokeWidth={2.4} />}
            </button>
          </div>

          <div className="mt-5">{progress}</div>
          <div className="mt-4">{controls()}</div>

          {/* Dispositivo · compartir · cola */}
          <div className="mt-4 flex items-center justify-between">
            <span className="inline-flex items-center gap-2 text-[13px] font-semibold uppercase tracking-wide min-w-0" style={{ color: GREEN }}>
              <Headphones size={20} className="shrink-0" /><span className="truncate">{device}</span>
            </span>
            <span className="flex items-center">
              <button onClick={() => shareTrack(t, toast)} className="w-11 h-11 grid place-items-center" aria-label="Compartir"><Share2 size={22} /></button>
              <button onClick={() => setSheet('cola')} className="w-11 h-11 grid place-items-center" aria-label={`Cola, ${p.queue.length} temas`}><ListMusic size={23} /></button>
            </span>
          </div>

          {/* Vista previa de la letra */}
          <button onClick={() => setLyricsOpen(true)} className="mt-5 w-full text-left rounded-2xl p-4 active:scale-[.99] transition" aria-label="Abrir la letra"
            style={{ background: `color-mix(in srgb, ${main} 62%, #000)` }}>
            <span className="flex items-center justify-between mb-2">
              <span className="text-[15px] font-bold">Vista previa de la letra</span>
              <span className="inline-flex items-center gap-1 text-[12px] font-semibold px-3 py-1.5 rounded-full bg-white/20">Mostrar <ChevronRight size={14} /></span>
            </span>
            {previewLines.map((l, i) => (
              <span key={i} className="block font-bold leading-tight" style={{ fontSize: i === 0 ? 22 : 20, color: i === 0 ? '#fff' : 'rgba(255,255,255,.55)', marginTop: i ? 4 : 0 }}>{l}</span>
            ))}
          </button>
        </div>
      </div>

      {lyricsOpen && (
        <LyricsMode t={t} colors={colors} lrc={bits.lrc} lines={bits.lines} activeIdx={bits.activeIdx} onSeek={p.seek} onShare={() => shareTrack(t, toast)}
          controls={(
            <div className="space-y-3">
              {progress}
              <div className="flex items-center justify-center gap-8">
                <button onClick={p.prev} aria-label="Anterior" className="w-12 h-12 grid place-items-center text-white"><Prev s={30} /></button>
                {playBtn(58)}
                <button onClick={() => p.next(false)} aria-label="Siguiente" className="w-12 h-12 grid place-items-center text-white"><Next s={30} /></button>
              </div>
              <button onClick={() => setLyricsOpen(false)} aria-pressed="true" className="mx-auto flex items-center gap-2 px-5 py-2.5 rounded-full text-[13px] font-bold" style={{ background: '#fff', color: '#000' }}>Cerrar letra</button>
            </div>
          )} />
      )}
      {sheet && <PlayerSheet p={p} toast={toast} bits={bits} initial={sheet} onClose={() => setSheet(null)} />}
    </div>
  );
}
