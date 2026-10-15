import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Play, Pause, SkipBack, SkipForward, Heart, Volume1, Volume2,
  Timer, ListMusic, Loader2, Shuffle, Repeat, Repeat1, Gauge,
  ScrollText, Headphones, User, MoreHorizontal, ChevronDown, X, Copy,
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

// Tema Spotify: réplica de layout (tipografía Inter, iconos filled/outlined,
// cápsula de dispositivo, degradado dinámico). Reutiliza el mismo `p`.
export default function FullPlayerSpotify({ p, toast, onClose: onCloseProp }) {
  const t = p.track;
  const [closing, setClosing] = useState(false);
  const [showTab, setShowTab] = useState(null); // null | cola | letra | eq | mas
  const lastTab = useRef('cola');
  const openTab = (tab) => { lastTab.current = tab; setShowTab(tab); };
  const [sleepMin, setSleepMin] = useState(0);
  const [sleepLeft, setSleepLeft] = useState(0);
  const [lrc, setLrc] = useState(null);
  const [lrcOffset, setLrcOffset] = useState(0); // ajuste sync ±5s (pestaña Letra)
  const activeRef = useRef(null);
  const onClose = () => { if (closing) return; setClosing(true); setTimeout(() => onCloseProp?.(), 260); };
  const colors = useArtColors(t?.art);
  const { trackRef, bgRef } = useParallax({ bg: 20, fg: 10 });
  // Gesto bajar para cerrar (toda la zona superior)
  const touch = useRef(null);
  const barRef = useRef(null);
  const scrub = useRef(false);
  const [dragY, setDragY] = useState(0);
  const swipe = {
    onTouchStart: (e) => { touch.current = e.touches[0].clientY; },
    onTouchMove: (e) => { if (touch.current != null) setDragY(Math.max(0, e.touches[0].clientY - touch.current)); },
    onTouchEnd: () => { if (dragY > 110) onClose(); setDragY(0); touch.current = null; },
  };

  // Engancha analyser/EQ en directos para que el EQ siga vivo en este tema
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

  // Letra: solo estado/línea activa (altura fija)
  useEffect(() => {
    if (!t) return;
    setLrc({ state: 'loading' });
    const ctrl = new AbortController();
    getLyrics({ artist: t.artist || '', title: t.title || '', duration: t.duration || p.time?.dur || 0, signal: ctrl.signal })
      .then((j) => setLrc({ state: 'ok', lines: j.lines || [], plain: j.plain || '', provider: j.provider || '' }))
      .catch(() => setLrc({ state: 'empty' }));
    return () => ctrl.abort();
  }, [t?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sleep con fundido
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
  // Auto-scroll a la línea activa solo con la pestaña Letra abierta
  useEffect(() => {
    if (showTab === 'letra') activeRef.current?.scrollIntoView({ block: 'center' });
  }, [activeIdx, showTab]);

  // Oculta: toca el título para copiar "título — artista" al portapapeles.
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
      } catch { /* portapapeles bloqueado */ }
    }
    toast?.('Título copiado', Copy);
  };

  // Scrub en la barra de progreso (tocar y arrastrar)
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
  // Color de la canción: fondo sólido + degradado del mismo color (sin negro).
  const main = colors?.main || '#0e7a6d';

  return (
    <div className={`fixed inset-0 z-40 overflow-hidden ${closing ? 'player-out' : 'player-in'}`} role="dialog" aria-modal="true" aria-label="Sonando Hermes 03"
      style={{ fontFamily: SP_FONT, color: '#fff', background: main, ...(dragY ? { transform: `translateY(${dragY}px)`, transition: 'none' } : undefined) }}>
      {/* Hero: foto full-bleed con parallax (overscan para no mostrar bordes) */}
      <div className="absolute top-0 inset-x-0 overflow-hidden" style={{ height: '52dvh', minHeight: 'min(320px, 70dvh)' }}>
        {t.art
          ? (
            <div ref={bgRef} className="parallax-bg absolute -inset-6">
              <img src={t.art} alt="" aria-hidden="true" draggable={false} fetchpriority="high" decoding="async"
                className="w-full h-full object-cover object-center" />
            </div>
          )
          : <Cover src={t.art} alt={t.title} iconSize={48} className="absolute inset-0 w-full h-full" />}
        {/* Resplandor degradado tomado del color de la canción: transparente arriba,
            color cada vez más fuerte hacia abajo. Sin negro. */}
        <div className="absolute inset-0" style={{
          background: `linear-gradient(180deg, color-mix(in srgb, ${main} 0%, transparent) 22%, color-mix(in srgb, ${main} 55%, transparent) 55%, ${main} 82%, ${main} 100%)`,
        }} />
      </div>

      <div ref={trackRef} className="relative h-full overflow-y-auto">
        <div className="mx-auto w-full max-w-md px-5 pt-[max(0.9rem,env(safe-area-inset-top))] pb-[max(1.4rem,env(safe-area-inset-bottom))] min-h-full flex flex-col">
          {/* Flechita + Playing from (área táctil grande + gesto bajar) */}
          <div {...swipe} className="pt-2 pb-1 -mx-5 px-5" style={{ touchAction: 'pan-y' }}>
            <button onClick={onClose} aria-label="Cerrar sonando" className="mx-auto flex items-center justify-center w-16 h-8">
              <ChevronDown size={26} color="rgba(255,255,255,.9)" style={{ filter: 'drop-shadow(0 1px 8px rgba(0,0,0,.45))' }} />
            </button>
          </div>

          {/* Espaciador proporcional al hero: título en degradado fuerte, controles visibles sin scroll */}
          <div {...swipe} className="flex-none" style={{ height: '34dvh', minHeight: 'min(220px, 48dvh)', touchAction: 'pan-y' }} aria-hidden="true" />

          {/* Título + acciones — sombra para contraste sobre color dinámico */}
          <div className="mt-1 flex items-center gap-2.5">
            <div className="flex-1 min-w-0">
              <button onClick={copyTitle} title="Tocar para copiar el título" aria-label={`Copiar título: ${t.title} de ${t.artist}`} className="block w-full text-left active:opacity-70 transition-opacity rounded-lg min-h-[44px]">
                <span className="block text-[22px] font-bold leading-tight line-clamp-2 break-words text-white" title={t.title} style={{ textShadow: '0 1px 12px rgba(0,0,0,.45)' }}>{t.title}</span>
              </button>
              <p className="text-[15px] mt-0.5 truncate" title={t.artist} style={{ color: 'rgba(255,255,255,.85)', textShadow: '0 1px 8px rgba(0,0,0,.4)' }}>{t.artist}</p>
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

          {/* Estado de letra (altura fija) + skeleton pequeño sin bugs */}
          <div className="mt-3 min-h-[3.25rem] flex flex-col justify-center">
            {(!lrc || lrc.state === 'loading') && (
              <span className="flex flex-col gap-1.5" aria-label="Buscando letra">
                <i className="block h-3.5 rounded-full bg-white/20 animate-pulse" style={{ width: '70%' }} />
                <i className="block h-2.5 rounded-full bg-white/15 animate-pulse" style={{ width: '45%', animationDelay: '.15s' }} />
              </span>
            )}
            {lrc?.state === 'empty' && <p className="text-[16px] font-semibold text-white/70">Sin letra disponible</p>}
            {lrc?.state === 'ok' && lines.length > 0 && activeLine
              ? <p className="text-[16px] font-semibold text-white line-clamp-2 leading-snug">{activeLine.x}</p>
              : null}
            {lrc?.state === 'ok' && lines.length > 0 && !activeLine && <p className="text-[16px] font-semibold text-white/60 line-clamp-2 leading-snug">{lines[0]?.x}</p>}
            {lrc?.state === 'ok' && !lines.length && <p className="text-[16px] font-semibold text-white/90 line-clamp-2">{lrc.plain || 'Sin letra disponible'}</p>}
          </div>

          {/* Progreso (tocar y arrastrar, 44px táctil + teclado) */}
          <div className="mt-1">
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
            <div className="flex justify-between text-[11px] tabular-nums mt-1.5" style={{ color: 'rgba(255,255,255,.7)' }}>
              <span>{fmtTime(tReal)}</span>
              <span>{p.resolving ? 'cargando…' : `-${fmtTime(Math.max(0, dur - tReal))}`}</span>
            </div>
          </div>

          {/* Controles en tarjeta glassmorphism: contraste sobre color dinámico */}
          <div className="mt-4 rounded-[28px] px-4 sm:px-5 pt-3 pb-4"
            style={{
              background: 'rgba(255,255,255,.12)',
              backdropFilter: 'blur(22px) saturate(1.5)',
              WebkitBackdropFilter: 'blur(22px) saturate(1.5)',
              border: '1px solid rgba(255,255,255,.22)',
              boxShadow: '0 12px 32px -12px rgba(0,0,0,.45), inset 0 1px 0 rgba(255,255,255,.18)',
            }}>
            <div className="flex items-center justify-between px-2 sm:px-4">
              <button onClick={p.prev} aria-label="Anterior" className="text-white min-w-[60px] min-h-[60px] grid place-items-center rounded-2xl active:scale-90 transition hover:bg-white/10"><SkipBack size={40} fill="currentColor" strokeWidth={0} /></button>
              <button onClick={p.toggle} aria-label={p.resolving ? 'Buscando audio' : p.playing ? `Pausar ${t.title}` : `Reproducir ${t.title}`} aria-busy={p.resolving ? 'true' : undefined}
                className="text-white min-w-[72px] min-h-[72px] grid place-items-center rounded-full active:scale-90 transition"
                style={{ background: 'rgba(255,255,255,.20)', border: '1px solid rgba(255,255,255,.30)', boxShadow: '0 8px 24px -8px rgba(0,0,0,.5), inset 0 1px 0 rgba(255,255,255,.25)' }}>
                {p.resolving ? <Loader2 size={52} className="animate-spin" /> : p.playing ? <Pause size={52} fill="currentColor" strokeWidth={0} /> : <Play size={52} fill="currentColor" strokeWidth={0} className="ml-1.5" />}
              </button>
              <button onClick={() => p.next(false)} aria-label="Siguiente" className="text-white min-w-[60px] min-h-[60px] grid place-items-center rounded-2xl active:scale-90 transition hover:bg-white/10"><SkipForward size={40} fill="currentColor" strokeWidth={0} /></button>
            </div>

            {/* Secundarios: 44px + estado textual */}
            <div className="mt-2 flex items-center justify-center gap-1 sm:gap-3" style={{ color: 'rgba(255,255,255,.75)' }}>
              <button onClick={() => p.toggleShuffle?.()} aria-label={p.shuffle ? 'Desactivar aleatorio' : 'Activar aleatorio'} aria-pressed={p.shuffle ? 'true' : 'false'} title="Aleatorio"
                className="min-w-[48px] min-h-[48px] grid place-items-center rounded-xl active:scale-90 transition hover:bg-white/10"
                style={p.shuffle ? { color: '#fff', background: 'rgba(255,255,255,.18)' } : undefined}>
                <span className="flex flex-col items-center gap-0.5"><Shuffle size={19} strokeWidth={2} /><span className="text-[9px] font-bold leading-none">{p.shuffle ? 'ON' : ''}</span></span>
              </button>
              <button onClick={() => { const i = RATES.indexOf(p.rate || 1); p.setRate?.(RATES[(i + 1) % RATES.length]); }} aria-label={`Velocidad ${p.rate || 1}x, tocar para cambiar`} title="Velocidad"
                className="min-w-[48px] min-h-[48px] grid place-items-center rounded-xl active:scale-90 transition hover:bg-white/10"
                style={(p.rate || 1) !== 1 ? { color: '#fff', background: 'rgba(255,255,255,.18)' } : undefined}>
                <span className="flex items-center gap-1"><Gauge size={19} strokeWidth={2} />
                <span className="text-[11px] font-bold tabular-nums">{p.rate || 1}x</span></span>
              </button>
              <button onClick={() => openTab('mas')} aria-label={sleepMin ? `Temporizador ${sleepMin} minutos, quedan ${fmtTime(sleepLeft)}` : 'Abrir temporizador'} title="Sleep"
                className="min-w-[48px] min-h-[48px] grid place-items-center rounded-xl active:scale-90 transition hover:bg-white/10"
                style={sleepMin ? { color: '#fff', background: 'rgba(255,255,255,.18)' } : undefined}>
                <span className="flex items-center gap-1"><Timer size={19} strokeWidth={2} />
                {sleepMin > 0 && <span className="text-[11px] font-bold tabular-nums">{fmtTime(sleepLeft)}</span>}</span>
              </button>
              <button onClick={() => p.cycleRepeat?.()} aria-label="Repetir" aria-pressed={p.repeat && p.repeat !== 'off' ? 'true' : 'false'} title="Repetir"
                className="min-w-[48px] min-h-[48px] grid place-items-center rounded-xl active:scale-90 transition hover:bg-white/10"
                style={p.repeat && p.repeat !== 'off' ? { color: '#fff', background: 'rgba(255,255,255,.18)' } : undefined}>
                <span className="flex flex-col items-center gap-0.5">{p.repeat === 'one' ? <Repeat1 size={19} strokeWidth={2} /> : <Repeat size={19} strokeWidth={2} />}<span className="text-[9px] font-bold leading-none">{p.repeat === 'one' ? '1' : p.repeat === 'all' ? 'ALL' : ''}</span></span>
              </button>
            </div>

            {/* Volumen dentro del glass: se ve sobre cualquier carátula */}
            <div className="mt-2 mx-auto w-full max-w-[220px] flex items-center gap-2 rounded-full px-3 py-1.5"
              style={{ background: 'rgba(255,255,255,.10)', border: '1px solid rgba(255,255,255,.16)' }}>
              <Volume1 size={13} color="rgba(255,255,255,.75)" />
              <input type="range" min="0" max="1" step="0.05" value={p.muted ? 0 : p.volume}
                onChange={(e) => p.setVolume(+e.target.value)} className="flex-1 h-[3px] cursor-pointer" style={{ accentColor: '#fff' }} aria-label="Volumen" />
              <Volume2 size={15} color="rgba(255,255,255,.75)" />
            </div>
          </div>

          {/* Toolbar inferior glass */}
          <div className="mt-3 grid grid-cols-3 items-center rounded-[24px] px-2 py-1.5"
            style={{
              background: 'rgba(255,255,255,.10)',
              backdropFilter: 'blur(18px) saturate(1.4)',
              WebkitBackdropFilter: 'blur(18px) saturate(1.4)',
              border: '1px solid rgba(255,255,255,.18)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,.14)',
            }}>
            <button className="justify-self-start min-w-[52px] min-h-[52px] grid place-items-center rounded-2xl hover:bg-white/10 active:scale-90 transition" onClick={() => openTab('letra')} aria-label="Ver letra completa">
              <ScrollText size={25} strokeWidth={1.7} color="rgba(255,255,255,.92)" />
            </button>
            <div className="justify-self-center flex items-center rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,.16)', border: '1px solid rgba(255,255,255,.20)' }}>
              <button className="px-5 py-3 min-h-[48px]" onClick={() => p.swapToBg?.(true)} aria-label="Cambiar a segundo plano gratis" title="Segundo plano gratis">
                <Headphones size={21} strokeWidth={1.7} color="#fff" />
              </button>
              <span className="w-px h-5 bg-white/25" />
              <button className="px-5 py-3 min-h-[48px]" aria-label="Perfil">
                <User size={21} strokeWidth={1.7} color="#fff" />
              </button>
            </div>
            <button className="justify-self-end min-w-[52px] min-h-[52px] grid place-items-center rounded-2xl hover:bg-white/10 active:scale-90 transition" onClick={() => openTab('cola')} aria-label={`Ver cola, ${p.queue.length} temas`}>
              <ListMusic size={25} strokeWidth={1.7} color="rgba(255,255,255,.92)" />
            </button>
          </div>
          <p className="mt-2 text-center text-[11px] tracking-wide" style={{ color: 'rgba(255,255,255,.65)' }}>{deviceLabel}</p>
        </div>
      </div>

      {/* Hoja con pestañas: Cola | Letra | EQ | Más */}
      {showTab && (
        <div className="absolute inset-0 z-50 flex flex-col" style={{ background: 'rgba(0,0,0,.72)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', fontFamily: SP_FONT }} role="dialog" aria-label="Opciones">
          <div className="flex items-center justify-between px-5 pt-[max(1rem,env(safe-area-inset-top))] pb-2 max-w-md w-full mx-auto">
            <p className="text-base font-bold text-white truncate">{t.title}</p>
            <button className="p-2" onClick={() => setShowTab(null)} aria-label="Cerrar"><X size={22} color="#fff" /></button>
          </div>
          <div className="px-5 pb-2 flex gap-2 justify-center max-w-md w-full mx-auto">
            {[['cola', 'Cola'], ['letra', 'Letra'], ['eq', 'EQ'], ['mas', 'Más']].map(([id, label]) => (
              <button key={id} onClick={() => openTab(id)}
                className="flex-1 px-3 py-1.5 rounded-full text-xs font-semibold"
                style={showTab === id ? { background: '#fff', color: '#000' } : { background: 'rgba(255,255,255,.15)', color: '#fff' }}>{label}</button>
            ))}
          </div>
          {showTab === 'mas' && (
            <div className="px-3 pb-2 flex gap-2 justify-center max-w-md w-full mx-auto flex-wrap">
              <button onClick={() => p.toggleShuffle?.()} className="px-3 py-1.5 rounded-full text-xs font-semibold text-white" style={{ background: p.shuffle ? '#fff' : 'rgba(255,255,255,.15)', color: p.shuffle ? '#000' : '#fff' }}>
                Aleatorio{p.shuffle ? ' · on' : ''}
              </button>
              <button onClick={() => p.cycleRepeat?.()} className="px-3 py-1.5 rounded-full text-xs font-semibold text-white" style={{ background: p.repeat !== 'off' ? '#fff' : 'rgba(255,255,255,.15)', color: p.repeat !== 'off' ? '#000' : '#fff' }}>
                {p.repeat === 'one' ? 'Repite una' : p.repeat === 'all' ? 'Repite cola' : 'Repetir'}
              </button>
              <button onClick={() => { const i = RATES.indexOf(p.rate || 1); const n = RATES[(i + 1) % RATES.length]; p.setRate?.(n); }} className="px-3 py-1.5 rounded-full text-xs font-semibold text-white" style={{ background: 'rgba(255,255,255,.15)' }}>
                <span className="inline-flex items-center gap-1"><Gauge size={13} />{p.rate || 1}x</span>
              </button>
              <select value={sleepMin} onChange={(e) => setSleepMin(+e.target.value)} className="px-3 py-1.5 rounded-full text-xs font-semibold text-white outline-none" style={{ background: 'rgba(255,255,255,.15)' }} aria-label="Sleep">
                {SLEEPS.map((m) => <option key={m} value={m} className="text-black">{m === 0 ? 'Sleep' : `${m}m${sleepMin === m && m > 0 ? ` (${fmtTime(sleepLeft)})` : ''}`}</option>)}
              </select>
            </div>
          )}
          {showTab === 'eq' && (
            <div className="px-5 pb-1 max-w-md w-full mx-auto">
              <p className="text-[11px] mb-1.5" style={{ color: 'rgba(255,255,255,.6)' }}>EQ {t?.source === 'YouTube' ? '(no aplica a YouTube)' : ''}</p>
              <div className="flex gap-1.5 flex-wrap">
                {Object.keys(EQ_PRESETS).map((name) => (
                  <button key={name} onClick={() => { p.applyEQ?.(name, EQ_PRESETS[name]); const el = p.audio?.current; if (el) setEQPreset(el, EQ_PRESETS[name]); }}
                    className="px-2.5 py-1 rounded-full text-[11px] font-semibold" style={{ background: p.eqPreset === name ? '#fff' : 'rgba(255,255,255,.15)', color: p.eqPreset === name ? '#000' : '#fff' }}>{name}</button>
                ))}
              </div>
            </div>
          )}
          {showTab === 'letra' && (
            <div className="flex-1 overflow-y-auto px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] max-w-md w-full mx-auto text-center">
              <div className="flex items-center justify-center gap-2 my-2 text-[11px]" style={{ color: 'rgba(255,255,255,.6)' }}>
                <span>{lrc?.state === 'ok' ? `Vía ${lrc.provider || ''}` : 'Letra'}</span>
                <button className="px-2 py-0.5 rounded-full" style={{ background: 'rgba(255,255,255,.15)', color: '#fff' }} onClick={() => setLrcOffset((o) => Math.max(-5, +(o - 0.5).toFixed(1)))} aria-label="Adelantar letra">-0.5s</button>
                <span className="tabular-nums">{lrcOffset > 0 ? `+${lrcOffset}s` : `${lrcOffset}s`}</span>
                <button className="px-2 py-0.5 rounded-full" style={{ background: 'rgba(255,255,255,.15)', color: '#fff' }} onClick={() => setLrcOffset((o) => Math.min(5, +(o + 0.5).toFixed(1)))} aria-label="Retrasar letra">+0.5s</button>
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
              <p className="text-[12px] my-2" style={{ color: 'rgba(255,255,255,.65)' }}>Cola ({p.queue.length})</p>
              {!p.queue.length && <p className="text-sm text-center py-6 text-white/70">Cola vacía — la radio automática seguirá sonando.</p>}
              {p.queue.map((qq, i) => (
                <div key={`${qq.id}-${i}`} className="flex items-center gap-2.5 py-1">
                  <Cover src={qq.art} className="w-11 h-11 !rounded-xl shrink-0" iconSize={14} alt={qq.title} />
                  <button onClick={() => { p.playAt(i); }} className="flex-1 min-w-0 text-left rounded-lg py-2 px-1" aria-label={`Reproducir ${qq.title}`}>
                    <p className="text-[14px] font-semibold truncate text-white">{qq.title}</p>
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
