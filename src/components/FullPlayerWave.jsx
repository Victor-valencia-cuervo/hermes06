import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Play, Pause, Rewind, FastForward, Heart, Volume1, Volume2,
  Timer, ListMusic, Loader2, Shuffle, Repeat, Repeat1, Gauge,
  Headphones, User, MoreHorizontal, ChevronDown, X, Copy, Quote,
} from 'lucide-react';
import { fmtTime } from '../lib/format';
import Cover from './Cover';
import { attachAnalyser, setEQPreset, EQ_PRESETS } from '../lib/analyser';
import useArtColors from '../hooks/useArtColors';
import useParallax from '../hooks/useParallax';
import { getLyrics, activeLineIndex } from '../services/lyrics';

const SP_FONT = "'Inter', system-ui, -apple-system, Roboto, 'SF Pro Display', sans-serif";
const SLEEPS = [0, 5, 10, 15, 30, 45, 60];
const RATES = [0.75, 1, 1.25, 1.5, 1.75, 2];

// Hermes 04 Wave: variante del 03 como en la captura — sin tarjetas glass,
// fondo sólido del color del tema, controles Rewind / Play / FastForward
// blancos sin cuadros, toolbar inferior libre. Misma lógica `p` que el 03.
export default function FullPlayerWave({ p, toast, onClose: onCloseProp }) {
  const t = p.track;
  const [closing, setClosing] = useState(false);
  const [showTab, setShowTab] = useState(null); // null | cola | letra | mas
  const lastTab = useRef('cola');
  const openTab = (tab) => { lastTab.current = tab; setShowTab(tab); };
  const [sleepMin, setSleepMin] = useState(0);
  const [sleepLeft, setSleepLeft] = useState(0);
  const [lrc, setLrc] = useState(null);
  const [lrcOffset, setLrcOffset] = useState(0);
  const activeRef = useRef(null);
  const onClose = () => { if (closing) return; setClosing(true); setTimeout(() => onCloseProp?.(), 260); };
  const colors = useArtColors(t?.art);
  const { trackRef, bgRef } = useParallax({ bg: 20, fg: 10 });
  const touch = useRef(null);
  const barRef = useRef(null);
  const scrub = useRef(false);
  const [dragY, setDragY] = useState(0);
  const swipe = {
    onTouchStart: (e) => { touch.current = e.touches[0].clientY; },
    onTouchMove: (e) => { if (touch.current != null) setDragY(Math.max(0, e.touches[0].clientY - touch.current)); },
    onTouchEnd: () => { if (dragY > 110) onClose(); setDragY(0); touch.current = null; },
  };

  useEffect(() => {
    if (!t || t.source === 'YouTube') return;
    let dead = false;
    const el = p.audio.current;
    if (el) {
      attachAnalyser(el).then((a) => {
        if (dead || !a) return;
        setEQPreset(el, p.eqGains || [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
      });
    }
    return () => { dead = true; };
  }, [t?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!t) return;
    setLrc({ state: 'loading' });
    const ctrl = new AbortController();
    getLyrics({ artist: t.artist || '', title: t.title || '', duration: t.duration || p.time?.dur || 0, signal: ctrl.signal })
      .then((j) => setLrc({ state: 'ok', lines: j.lines || [], plain: j.plain || '', provider: j.provider || '' }))
      .catch(() => setLrc({ state: 'empty' }));
    return () => ctrl.abort();
  }, [t?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!sleepMin) return;
    const end = Date.now() + sleepMin * 60000;
    setSleepLeft(sleepMin * 60);
    const iv = setInterval(() => {
      const s = Math.max(0, Math.round((end - Date.now()) / 1000));
      setSleepLeft(s);
      if (s <= 0) {
        clearInterval(iv); setSleepMin(0); p.pause();
        try { if (p.audio?.current) p.audio.current.volume = p.rawVolume ?? 0.9; p.ytRef?.current?.applyVolume?.(p.rawVolume ?? 0.9, p.muted); } catch {}
        toast?.('Temporizador: música en pausa', Timer);
      }
    }, 1000);
    return () => clearInterval(iv);
  }, [sleepMin]); // eslint-disable-line react-hooks/exhaustive-deps

  const closeRef = useRef(null); closeRef.current = onClose;
  useEffect(() => {
    const k = (e) => { if (e.key === 'Escape') closeRef.current?.(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, []);

  const lines = lrc?.lines || [];
  const tReal = p.time?.cur || 0;
  const tcur = tReal + lrcOffset;
  const activeIdx = useMemo(() => activeLineIndex(lines, tcur), [lines, tcur]);
  const activeLine = activeIdx >= 0 ? lines[activeIdx] : null;
  useEffect(() => {
    if (showTab === 'letra') activeRef.current?.scrollIntoView({ block: 'center' });
  }, [activeIdx, showTab]);

  const copyTitle = async () => {
    const txt = `${t?.title || ''}${t?.artist ? ` — ${t.artist}` : ''}`.trim();
    if (!txt) return;
    try { await navigator.clipboard.writeText(txt); }
    catch {
      try {
        const ta = document.createElement('textarea');
        ta.value = txt; ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select();
        document.execCommand('copy'); ta.remove();
      } catch {}
    }
    toast?.('Título copiado', Copy);
  };

  const seekBar = (clientX) => {
    const el = barRef.current;
    const d = (isFinite(p.time?.dur) && p.time.dur > 0 ? p.time.dur : t?.duration) || 0;
    if (!el || !d) return;
    const r = el.getBoundingClientRect();
    if (r.width) p.seek(Math.min(1, Math.max(0, (clientX - r.left) / r.width)) * d);
  };

  if (!t) return null;
  const dur = (isFinite(p.time?.dur) && p.time.dur > 0 ? p.time.dur : t.duration) || 0;
  const pct = dur > 0 ? Math.min(100, (tReal / dur) * 100) : 0;
  const deviceLabel = t.source === 'Local' ? 'Este teléfono' : (t.source || 'Música');
  const main = colors?.main || '#0e7a6d';

  return (
    <div className={`fixed inset-0 z-40 overflow-hidden ${closing ? 'player-out' : 'player-in'}`} role="dialog" aria-modal="true" aria-label="Sonando Hermes 04"
      style={{ fontFamily: SP_FONT, color: '#fff', background: main, ...(dragY ? { transform: `translateY(${dragY}px)`, transition: 'none' } : undefined) }}>
      {/* Hero full-bleed */}
      <div className="absolute top-0 inset-x-0 overflow-hidden" style={{ height: '52dvh', minHeight: 'min(320px, 70dvh)' }}>
        {t.art
          ? (
            <div ref={bgRef} className="parallax-bg absolute -inset-6">
              <img src={t.art} alt="" aria-hidden="true" draggable={false} fetchPriority="high" decoding="async"
                className="w-full h-full object-cover object-center" />
            </div>
          )
          : <Cover src={t.art} alt={t.title} iconSize={48} className="absolute inset-0 w-full h-full" />}
        <div className="absolute inset-0" style={{
          background: `linear-gradient(180deg, color-mix(in srgb, ${main} 0%, transparent) 22%, color-mix(in srgb, ${main} 55%, transparent) 55%, ${main} 82%, ${main} 100%)`,
        }} />
      </div>

      <div ref={trackRef} className="relative h-full overflow-y-auto">
        <div className="mx-auto w-full max-w-md px-5 pt-[max(0.9rem,env(safe-area-inset-top))] pb-[max(1.4rem,env(safe-area-inset-bottom))] min-h-full flex flex-col">
          {/* Handle + Playing from */}
          <div {...swipe} className="pt-1 pb-1 -mx-5 px-5" style={{ touchAction: 'pan-y' }}>
            <span className="mx-auto block w-10 h-1 rounded-full bg-white/40" aria-hidden="true" />
            <button onClick={onClose} aria-label="Cerrar sonando" className="mx-auto mt-1 flex items-center justify-center min-w-[64px] min-h-[36px] text-[13px] font-semibold text-white/90">
              <span style={{ textShadow: '0 1px 8px rgba(0,0,0,.45)' }}>Playing from {t.source || 'Buscar'}</span>
            </button>
          </div>

          <div {...swipe} className="flex-none" style={{ height: '34dvh', minHeight: 'min(220px, 48dvh)', touchAction: 'pan-y' }} aria-hidden="true" />

          {/* Título + fav + más */}
          <div className="mt-1 flex items-center gap-2.5">
            <div className="flex-1 min-w-0">
              <button onClick={copyTitle} title="Tocar para copiar el título" aria-label={`Copiar título: ${t.title} de ${t.artist}`} className="block w-full text-left active:opacity-70 transition-opacity rounded-lg min-h-[44px]">
                <span className="block text-[22px] font-bold leading-tight truncate text-white" title={t.title} style={{ textShadow: '0 1px 12px rgba(0,0,0,.45)' }}>{t.title}</span>
              </button>
              <p className="text-[19px] mt-0 truncate" title={t.artist} style={{ color: 'rgba(255,255,255,.82)', textShadow: '0 1px 8px rgba(0,0,0,.4)' }}>{t.artist}</p>
            </div>
            <button onClick={() => p.toggleFav(t)} aria-label={p.isFav(t) ? `Quitar de me gusta: ${t.title}` : `Me gusta: ${t.title}`} aria-pressed={p.isFav(t) ? 'true' : 'false'}
              className="w-12 h-12 rounded-full grid place-items-center shrink-0" style={{ background: 'rgba(255,255,255,.16)' }}>
              <Heart size={21} strokeWidth={1.8} fill={p.isFav(t) ? '#fff' : 'none'} color="#fff" />
            </button>
            <button onClick={() => openTab(lastTab.current)} aria-label="Abrir opciones, cola y letra" aria-haspopup="dialog"
              className="w-12 h-12 rounded-full grid place-items-center shrink-0" style={{ background: 'rgba(255,255,255,.16)' }}>
              <MoreHorizontal size={21} strokeWidth={1.8} color="#fff" />
            </button>
          </div>

          {/* Letra: una línea, como la captura */}
          <button onClick={() => openTab('letra')} className="mt-4 min-h-[2rem] flex items-center text-left w-full rounded-lg" aria-label="Ver letra completa">
            {(!lrc || lrc.state === 'loading')
              ? <span className="text-[19px] text-white/70">La letra está casi lista</span>
              : lrc?.state === 'empty'
                ? <span className="text-[19px] text-white/70">La letra está casi lista</span>
                : activeLine
                  ? <span className="text-[19px] font-medium text-white truncate">{activeLine.x}</span>
                  : <span className="text-[19px] text-white/70 truncate">{lines[0]?.x || lrc.plain || 'La letra está casi lista'}</span>}
          </button>

          {/* Progreso blanco sin caja */}
          <div className="mt-2">
            <div ref={barRef} className="cursor-pointer touch-none select-none py-3.5 -my-3"
              onPointerDown={(e) => { if (!dur) return; scrub.current = true; e.currentTarget.setPointerCapture?.(e.pointerId); seekBar(e.clientX); }}
              onPointerMove={(e) => { if (scrub.current) seekBar(e.clientX); }}
              onPointerUp={() => { scrub.current = false; }}
              onPointerCancel={() => { scrub.current = false; }}
              onKeyDown={(e) => {
                if (!dur) return;
                if (e.key === 'ArrowRight') { e.preventDefault(); p.seek(Math.min(dur, tReal + 10)); }
                else if (e.key === 'ArrowLeft') { e.preventDefault(); p.seek(Math.max(0, tReal - 10)); }
                else if (e.key === 'Home') { e.preventDefault(); p.seek(0); }
                else if (e.key === 'End') { e.preventDefault(); p.seek(dur); }
              }}
              tabIndex={0}
              role="slider" aria-label={`Progreso de ${t.title}`} aria-valuemin={0} aria-valuemax={Math.round(dur)} aria-valuenow={Math.round(tReal)}>
              <div className="h-[5px] rounded-full pointer-events-none" style={{ background: 'rgba(255,255,255,.3)' }}>
                <div className="h-full rounded-full bg-white" style={{ width: `${pct}%` }} />
              </div>
            </div>
            <div className="flex justify-between text-[15px] tabular-nums mt-1.5" style={{ color: 'rgba(255,255,255,.75)' }}>
              <span>{fmtTime(tReal)}</span>
              <span>{p.resolving ? 'cargando…' : `-${fmtTime(Math.max(0, dur - tReal))}`}</span>
            </div>
          </div>

          {/* Controles de la captura: Rewind / Play / FastForward, sin cuadros */}
          <div className="mt-6 flex items-center justify-between px-8 sm:px-10">
            <button onClick={p.prev} aria-label="Anterior" className="text-white min-w-[64px] min-h-[64px] grid place-items-center active:scale-90 transition">
              <Rewind size={52} fill="currentColor" strokeWidth={0} />
            </button>
            <button onClick={p.toggle} aria-label={p.resolving ? 'Buscando audio' : p.playing ? `Pausar ${t.title}` : `Reproducir ${t.title}`} aria-busy={p.resolving ? 'true' : undefined} className="text-white min-w-[76px] min-h-[76px] grid place-items-center active:scale-90 transition">
              {p.resolving ? <Loader2 size={56} className="animate-spin" /> : p.playing ? <Pause size={60} fill="currentColor" strokeWidth={0} /> : <Play size={60} fill="currentColor" strokeWidth={0} className="ml-1.5" />}
            </button>
            <button onClick={() => p.next(false)} aria-label="Siguiente" className="text-white min-w-[64px] min-h-[64px] grid place-items-center active:scale-90 transition">
              <FastForward size={52} fill="currentColor" strokeWidth={0} />
            </button>
          </div>

          {/* Volumen: línea blanca sin caja */}
          <div className="mt-6 mx-auto w-full max-w-[300px] flex items-center gap-3">
            <Volume1 size={15} color="rgba(255,255,255,.7)" />
            <input type="range" min="0" max="1" step="0.05" value={p.muted ? 0 : p.volume}
              onChange={(e) => p.setVolume(+e.target.value)} className="flex-1 h-[4px] cursor-pointer" style={{ accentColor: '#fff' }} aria-label="Volumen" />
            <Volume2 size={18} color="rgba(255,255,255,.8)" />
          </div>

          {/* Toolbar inferior libre: letra | píldora | cola */}
          <div className="mt-4 grid grid-cols-3 items-center">
            <button className="justify-self-start min-w-[52px] min-h-[52px] grid place-items-center" onClick={() => openTab('letra')} aria-label="Ver letra completa">
              <Quote size={26} color="rgba(255,255,255,.9)" fill="rgba(255,255,255,.9)" />
            </button>
            <div className="justify-self-center flex items-center rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,.16)' }}>
              <button className="px-6 py-3 min-h-[48px]" onClick={() => p.swapToBg?.(true)} aria-label="Cambiar a segundo plano gratis" title="Segundo plano gratis">
                <Headphones size={22} strokeWidth={1.8} color="#fff" />
              </button>
              <span className="w-px h-6 bg-white/25" />
              <button className="px-6 py-3 min-h-[48px]" aria-label="Perfil">
                <User size={22} strokeWidth={1.8} color="#fff" />
              </button>
            </div>
            <button className="justify-self-end min-w-[52px] min-h-[52px] grid place-items-center" onClick={() => openTab('cola')} aria-label={`Ver cola, ${p.queue.length} temas`}>
              <ListMusic size={28} strokeWidth={1.7} color="rgba(255,255,255,.92)" />
            </button>
          </div>
          <p className="mt-2 text-center text-[12px] font-semibold tracking-[0.18em] uppercase" style={{ color: 'rgba(255,255,255,.6)' }}>{deviceLabel}</p>
        </div>
      </div>

      {/* Hoja: Cola | Letra | Más (shuffle/repeat/velocidad/sleep/EQ viven aquí) */}
      {showTab && (
        <div className="absolute inset-0 z-50 flex flex-col" style={{ background: 'rgba(0,0,0,.72)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', fontFamily: SP_FONT }} role="dialog" aria-label="Opciones">
          <div className="flex items-center justify-between px-5 pt-[max(1rem,env(safe-area-inset-top))] pb-2 max-w-md w-full mx-auto">
            <p className="text-base font-bold text-white truncate">{t.title}</p>
            <button className="min-w-[44px] min-h-[44px] grid place-items-center" onClick={() => setShowTab(null)} aria-label="Cerrar"><X size={22} color="#fff" /></button>
          </div>
          <div className="px-5 pb-2 flex gap-2 justify-center max-w-md w-full mx-auto">
            {[['cola', 'Cola'], ['letra', 'Letra'], ['mas', 'Más']].map(([id, label]) => (
              <button key={id} onClick={() => openTab(id)}
                className="flex-1 px-3 py-2.5 rounded-full text-xs font-semibold min-h-[44px]"
                style={showTab === id ? { background: '#fff', color: '#000' } : { background: 'rgba(255,255,255,.15)', color: '#fff' }}>{label}</button>
            ))}
          </div>
          {showTab === 'mas' && (
            <div className="px-5 pb-3 max-w-md w-full mx-auto space-y-3 overflow-y-auto">
              <div className="flex gap-2 justify-center flex-wrap">
                <button onClick={() => p.toggleShuffle?.()} aria-pressed={p.shuffle ? 'true' : 'false'} className="px-4 py-2.5 rounded-full text-xs font-semibold text-white min-h-[44px]" style={{ background: p.shuffle ? '#fff' : 'rgba(255,255,255,.15)', color: p.shuffle ? '#000' : '#fff' }}>
                  Aleatorio{p.shuffle ? ' · on' : ''}
                </button>
                <button onClick={() => p.cycleRepeat?.()} className="px-4 py-2.5 rounded-full text-xs font-semibold min-h-[44px]" style={{ background: p.repeat !== 'off' ? '#fff' : 'rgba(255,255,255,.15)', color: p.repeat !== 'off' ? '#000' : '#fff' }}>
                  {p.repeat === 'one' ? 'Repite una' : p.repeat === 'all' ? 'Repite cola' : 'Repetir'}
                </button>
                <button onClick={() => { const i = RATES.indexOf(p.rate || 1); const n = RATES[(i + 1) % RATES.length]; p.setRate?.(n); }} className="px-4 py-2.5 rounded-full text-xs font-semibold text-white min-h-[44px]" style={{ background: 'rgba(255,255,255,.15)' }}>
                  <span className="inline-flex items-center gap-1"><Gauge size={13} />{p.rate || 1}x</span>
                </button>
                <select value={sleepMin} onChange={(e) => setSleepMin(+e.target.value)} className="px-4 py-2.5 rounded-full text-xs font-semibold text-white outline-none min-h-[44px]" style={{ background: 'rgba(255,255,255,.15)' }} aria-label="Sleep">
                  {SLEEPS.map((m) => <option key={m} value={m} className="text-black">{m === 0 ? 'Sleep' : `${m}m${sleepMin === m && m > 0 ? ` (${fmtTime(sleepLeft)})` : ''}`}</option>)}
                </select>
              </div>
              <div>
                <p className="text-[11px] mb-1.5" style={{ color: 'rgba(255,255,255,.6)' }}>EQ {t?.source === 'YouTube' ? '(no aplica a YouTube)' : ''}</p>
                <div className="flex gap-1.5 flex-wrap">
                  {Object.keys(EQ_PRESETS).map((name) => (
                    <button key={name} onClick={() => { p.applyEQ?.(name, EQ_PRESETS[name]); const el = p.audio?.current; if (el) setEQPreset(el, EQ_PRESETS[name]); }}
                      className="px-3 py-2 rounded-full text-[11px] font-semibold min-h-[40px]" style={{ background: p.eqPreset === name ? '#fff' : 'rgba(255,255,255,.15)', color: p.eqPreset === name ? '#000' : '#fff' }}>{name}</button>
                  ))}
                </div>
              </div>
              <p className="text-[11px] text-center" style={{ color: 'rgba(255,255,255,.55)' }}>
                {sleepMin > 0 ? `Apago en ${sleepMin} min (${fmtTime(sleepLeft)})` : ''}{lrc?.provider ? ` · letra vía ${lrc.provider}` : ''}
              </p>
            </div>
          )}
          {showTab === 'letra' && (
            <div className="flex-1 overflow-y-auto px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] max-w-md w-full mx-auto text-center">
              <div className="flex items-center justify-center gap-2 my-2 text-[11px]" style={{ color: 'rgba(255,255,255,.6)' }}>
                <span>{lrc?.state === 'ok' ? `Vía ${lrc.provider || ''}` : 'Letra'}</span>
                <button className="px-3 py-1.5 rounded-full min-h-[36px]" style={{ background: 'rgba(255,255,255,.15)', color: '#fff' }} onClick={() => setLrcOffset((o) => Math.max(-5, +(o - 0.5).toFixed(1)))} aria-label="Adelantar letra">-0.5s</button>
                <span className="tabular-nums">{lrcOffset > 0 ? `+${lrcOffset}s` : `${lrcOffset}s`}</span>
                <button className="px-3 py-1.5 rounded-full min-h-[36px]" style={{ background: 'rgba(255,255,255,.15)', color: '#fff' }} onClick={() => setLrcOffset((o) => Math.min(5, +(o + 0.5).toFixed(1)))} aria-label="Retrasar letra">+0.5s</button>
              </div>
              {(!lrc || lrc.state === 'loading') && <p className="text-sm text-white/80">Buscando letra…</p>}
              {lrc?.state === 'empty' && <p className="text-sm" style={{ color: 'rgba(255,255,255,.6)' }}>Sin letra disponible</p>}
              {lrc?.state === 'ok' && lines.length > 0 && lines.map((l, i) => {
                const isActive = i === activeIdx;
                return (
                  <p key={i} ref={isActive ? activeRef : undefined} onClick={() => p.seek(Math.max(0, (l.t ?? 0) - 0.2))}
                    className={`py-1.5 leading-snug cursor-pointer ${isActive ? 'text-lg font-bold text-white' : 'text-[15px]'}`}
                    style={isActive ? undefined : { color: 'rgba(255,255,255,.5)' }}>{l.x}</p>
                );
              })}
              {lrc?.state === 'ok' && !lines.length && <p className="text-sm whitespace-pre-line text-left text-white/90">{lrc.plain || 'Sin letra disponible'}</p>}
            </div>
          )}
          {showTab === 'cola' && (
            <div className="flex-1 overflow-y-auto px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] max-w-md w-full mx-auto">
              <p className="text-[12px] my-2" style={{ color: 'rgba(255,255,255,.65)' }}>Cola ({p.queue.length}){p.queueDuration ? ` · ${fmtTime(p.queueDuration())}` : ''}</p>
              {!p.queue.length && <p className="text-sm text-center py-6 text-white/70">Cola vacía — la radio automática seguirá sonando.</p>}
              {p.queue.map((qq, i) => (
                <div key={`${qq.id}-${i}`} className="flex items-center gap-2.5 py-1">
                  <Cover src={qq.art} className="w-11 h-11 !rounded-xl shrink-0" iconSize={14} alt={qq.title} />
                  <button onClick={() => { p.playAt(i); }} className="flex-1 min-w-0 text-left rounded-lg py-2 px-1" aria-label={`Reproducir ${qq.title}`}>
                    <p className="text-[14px] font-semibold truncate text-white">{i + 1}. {qq.title}</p>
                    <p className="text-[12px] truncate" style={{ color: 'rgba(255,255,255,.65)' }}>{qq.artist}</p>
                  </button>
                  {qq.id === t.id
                    ? <span className="min-w-[44px] min-h-[44px] grid place-items-center" aria-label="Sonando ahora"><Repeat1 size={16} color="#fff" /></span>
                    : <button onClick={() => p.removeAt(i)} aria-label={`Quitar ${qq.title}`} className="min-w-[44px] min-h-[44px] grid place-items-center"><X size={17} color="rgba(255,255,255,.65)" /></button>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
