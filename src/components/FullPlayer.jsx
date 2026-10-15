import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronDown, Play, Pause, SkipBack, SkipForward,
  Heart, Volume2, VolumeX, Timer, ListMusic, ListPlus, X, Loader2,
  BarChart3, Disc3, Image as ImageIcon, RotateCcw, RotateCw, Speaker, Minimize2,
  Shuffle, Repeat, Repeat1, Gauge, Trash2, ArrowUpDown, SlidersHorizontal, Copy,
} from 'lucide-react';
import { fmtTime } from '../lib/format';
import Cover from './Cover';
import Visualizer from './Visualizer';
import ZigZag from './ZigZag';
import BlockedBar from './BlockedBar';
import ElegantParticles from './ElegantParticles';
import ParticleSettings, { useParticleCfg } from './ParticleSettings';
import { cssToRgb } from '../lib/particle-color';
import { attachAnalyser, setBoost, setEQBand, setEQPreset, EQ_FREQS, EQ_PRESETS } from '../lib/analyser';
import useArtColors from '../hooks/useArtColors';
import useParallax from '../hooks/useParallax';
import useStore from '../hooks/useStore';
import useLandscape from '../hooks/useLandscape';
import { getLyrics, activeLineIndex } from '../services/lyrics';

const SLEEPS = [0, 5, 10, 15, 30, 45, 60];
const RATES = [0.75, 1, 1.25, 1.5, 1.75, 2];

export default function FullPlayer({ p, toast, dark, onClose: onCloseProp }) {
  const t = p.track;
  const [closing, setClosing] = useState(false);
  const [dragY, setDragY] = useState(0);
  const [immersive, setImmersive] = useState(false);
  const landscape = useLandscape();
  // Vista del arte: false = foto de antes, true = vinilo. El botón solo
  // cambia el arte, nunca el layout (el giro automático no se usa).
  const [vinyl, setVinyl] = useState(false);
  // YouTube suena siempre en solo-audio (el modo video se eliminó por lento).
  const isLocalVideo = t?.source === 'Local' && t?.kind === 'video' && !!t?.src;
  const localVideoRef = useRef(null);
  // Visual del video local: acompaña al audio (muted para no duplicar).
  const lastVid = useRef(null);
  useEffect(() => {
    const v = localVideoRef.current;
    if (!v) return undefined;
    if (lastVid.current !== t?.id) {
      lastVid.current = t?.id;
      try { v.currentTime = 0; } catch {}
    }
    if (p.playing) v.play().catch(() => {});
    else v.pause();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.playing, t?.id]);
  const autoRef = useRef(false); // el giro entró solo al inmersivo
  const [showViz, setShowViz] = useState(() => { try { return localStorage.getItem('h_showviz') !== '0'; } catch { return true; } });
  const toggleViz = () => setShowViz((v) => { try { localStorage.setItem('h_showviz', v ? '0' : '1'); } catch {} return !v; });
  const coverRef = useRef(null);
  const discRef = useRef(null);
  const discAng = useRef(0);
  const touch = useRef(null);
  // Cierre con animación suave
  const onClose = () => { if (closing) return; setClosing(true); setTimeout(() => onCloseProp?.(), 260); };
  // Inmersivo: oculta la interfaz y pide pantalla completa (quita hora/wifi donde el navegador lo permita)
  const toggleImmersive = () => {
    autoRef.current = false; // pasa a manual: el giro ya no lo saca solo
    const on = !immersive; setImmersive(on);
    try { if (on) document.documentElement.requestFullscreen?.(); else if (document.fullscreenElement) document.exitFullscreen?.(); } catch {}
  };
  // Horizontal en móvil: entra solo al inmersivo (con fullscreen si deja);
  // al volver a vertical sale solo si fue automático (respeta tu botón).
  useEffect(() => {
    if (landscape) {
      autoRef.current = true;
      setImmersive(true);
      try { document.documentElement.requestFullscreen?.(); } catch {}
    } else if (autoRef.current) {
      autoRef.current = false;
      setImmersive(false);
      try { if (document.fullscreenElement) document.exitFullscreen?.(); } catch {}
    }
  }, [landscape]);
  useEffect(() => () => { try { if (document.fullscreenElement) document.exitFullscreen?.(); } catch {} }, []);
  // Gesto de bajar: SOLO sobre la foto (el fondo sigue interactivo con las partículas)
  const swipe = {
    onTouchStart: (e) => { touch.current = e.touches[0].clientY; },
    onTouchMove: (e) => { if (touch.current != null) setDragY(Math.max(0, e.touches[0].clientY - touch.current)); },
    onTouchEnd: () => { if (dragY > 110) onClose(); setDragY(0); touch.current = null; },
  };
  const colors = useArtColors(t?.art);
  const { trackRef, bgRef, fgRef } = useParallax({ bg: 22, fg: 10 });
  const [ftab, setFtab] = useState(null); // null | queue | lyrics (colapsado por defecto)
  const [lrc, setLrc] = useState(null);      // {lines:[{t,x,words?}]|null, plain, provider, wordSync, state}
  const [lrcOffset, setLrcOffset] = useState(0); // ajuste sync ±2s
  const [sleepMin, setSleepMin] = useState(0);
  const [sleepLeft, setSleepLeft] = useState(0);
  const activeRef = useRef(null);
  const analyserRef = useRef(null);
  const [pcfg, setPcfg] = useParticleCfg();
  const prgb = cssToRgb(colors?.main || colors?.deep);
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

  // Engancha el analizador al <audio> (solo temas directos; YT va simulado).
  // Espera a que el contexto corra; jamás silencia el audio.
  const [boost, setBoostV] = useStore('h_boost', 1); // 1 | 1.5 | 2 | 2.5
  useEffect(() => {
    analyserRef.current = null;
    if (!t || t.source === 'YouTube') return;
    let dead = false;
    const el = p.audio.current;
    if (el) {
      attachAnalyser(el).then((a) => {
        if (dead) return;
        analyserRef.current = a;
        if (a) setBoost(el, boost);
      });
    }
    return () => { dead = true; };
  }, [t?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  // Reaplica el boost si cambia a mitad del tema
  useEffect(() => {
    if (!t || t.source === 'YouTube') return;
    const el = p.audio?.current;
    if (el) setBoost(el, boost);
  }, [boost]); // eslint-disable-line react-hooks/exhaustive-deps
  // Reaplica EQ cuando cambia preset/gains o el elemento
  useEffect(() => {
    if (!t || t.source === 'YouTube') return;
    const el = p.audio?.current;
    if (!el) return;
    setEQPreset(el, p.eqGains || [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  }, [p.eqGains, t?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const [showEQ, setShowEQ] = useState(false);
  const cycleBoost = () => {
    if (t?.source === 'YouTube') { toast?.('El boost solo vale en temas directos (Audius/Local)'); return; }
    const next = boost >= 2.5 ? 1 : boost >= 2 ? 2.5 : boost >= 1.5 ? 2 : 1.5;
    setBoostV(next);
    const el = p.audio?.current;
    if (el && !setBoost(el, next)) toast?.('Boost no disponible en este tema');
    else toast?.(next === 1 ? 'Volumen normal' : `Volumen potenciado ${next}x`);
  };

  useEffect(() => {
    let raf = 0; let ph = 0;
    const loop = () => {
      ph += 0.09;
      const a = analyserRef.current; let lvl = 0;
      if (a?.getByteFrequencyData) {
        const d = new Uint8Array(a.frequencyBinCount); a.getByteFrequencyData(d);
        for (let i = 0; i < 8; i++) lvl += d[i]; lvl = lvl / 8 / 255;
      } else lvl = 0.5 + 0.5 * Math.sin(ph) * Math.sin(ph * 0.37 + 1);
      if (coverRef.current) coverRef.current.style.transform = `scale(${1 + lvl * 0.045})`;
      raf = requestAnimationFrame(loop);
    };
    if (p.playing) loop(); else if (coverRef.current) coverRef.current.style.transform = '';
    return () => cancelAnimationFrame(raf);
  }, [p.playing, t?.id]);

  // Disco de vinilo: giro por rAF, pausado si el sistema pide movimiento reducido.
  useEffect(() => {
    if (!p.playing) return;
    try {
      if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    } catch {}
    let raf = 0; let last = performance.now();
    const loop = (now) => {
      const dt = Math.min(0.1, (now - last) / 1000); last = now;
      discAng.current = (discAng.current + (dt * 360) / 3.2) % 360;
      if (discRef.current) discRef.current.style.transform = `rotate(${discAng.current}deg)`;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [p.playing]);

  // Cierra con Escape (ref: onClose cambia cada render, no re-suscribir)
  const closeRef = useRef(null);
  closeRef.current = onClose;
  useEffect(() => {
    const k = (e) => { if (e.key === 'Escape') closeRef.current?.(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, []);

  // Letras multi-provider estilo BitChord (lrc.red word-sync > LRCLIB > PaxSenix > Unison)
  useEffect(() => {
    if (!t) return;
    setFtab(null);
    setLrc({ state: 'loading' });
    const ctrl = new AbortController();
    getLyrics({ artist: t.artist || '', title: t.title || '', duration: t.duration || p.time?.dur || 0, signal: ctrl.signal })
      .then((j) => {
        setLrc({ state: 'ok', lines: j.lines || [], plain: j.plain || '', provider: j.provider || '', wordSync: !!j.wordSync, cached: !!j.cached });
      })
      .catch(() => setLrc({ state: 'empty' }));
    return () => ctrl.abort();
  }, [t?.id]); // eslint-disable-next-line react-hooks/exhaustive-deps

  // Sleep timer con fundido 10s (no corta en seco)
  useEffect(() => {
    if (!sleepMin) return;
    const end = Date.now() + sleepMin * 60000;
    setSleepLeft(sleepMin * 60);
    let faded = false;
    const iv = setInterval(() => {
      const s = Math.max(0, Math.round((end - Date.now()) / 1000));
      setSleepLeft(s);
      if (s <= 10 && s > 0 && !faded) {
        faded = true;
        try {
          const a = p.audio?.current;
          const startVol = p.rawVolume ?? p.volume ?? 0.9;
          if (a && t?.source !== 'YouTube') {
            const step = startVol / 10;
            let n = 0;
            const fv = setInterval(() => {
              n++;
              try { a.volume = Math.max(0, startVol - step * n); } catch {}
              if (n >= 10) clearInterval(fv);
            }, 1000);
          } else {
            let n = 0;
            const base = p.rawVolume ?? 0.9;
            const fv = setInterval(() => {
              n++;
              try { p.ytRef?.current?.applyVolume?.(Math.max(0, base * (1 - n / 10)), false); } catch {}
              if (n >= 10) clearInterval(fv);
            }, 1000);
          }
        } catch {}
      }
      if (s <= 0) {
        clearInterval(iv);
        setSleepMin(0);
        p.pause();
        try {
          const a = p.audio?.current;
          if (a) a.volume = p.rawVolume ?? 0.9;
          p.ytRef?.current?.applyVolume?.(p.rawVolume ?? 0.9, p.muted);
        } catch {}
        toast?.('Temporizador: música en pausa', Timer);
      }
    }, 1000);
    return () => clearInterval(iv);
  }, [sleepMin]); // eslint-disable-line react-hooks/exhaustive-deps

  const lines = lrc?.lines || [];
  const tReal = p.time?.cur || 0;
  const tcur = tReal + lrcOffset;
  const activeIdx = useMemo(() => activeLineIndex(lines, tcur), [lines, tcur]);

  useEffect(() => {
    if (ftab === 'lyrics') activeRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [activeIdx, ftab]);

  if (!t) return null;
  const dur = (isFinite(p.time?.dur) && p.time.dur > 0 ? p.time.dur : t.duration) || 0;

  const wash = colors?.main || 'var(--a)';
  const viz = colors?.main || '#818cf8';
  // Fondo sólido opaco estilo 03: base lisa + velo con color de la carátula.
  // Nunca transparente: tapa toda la app de atrás.
  const base = dark ? '#09090b' : '#f4f4f5';
  const bg = colors
    ? dark
      ? `linear-gradient(180deg, ${colors.main}B3 0%, ${colors.deep || colors.main}CC 38%, #09090b 100%)`
      : `linear-gradient(180deg, ${colors.main}A6 0%, ${colors.pastel || colors.main}99 42%, #f4f4f5 100%)`
    : undefined;

  return (
    <div className={`fixed inset-0 z-40 overflow-hidden ${closing ? 'player-out' : 'player-in'}`} style={{ background: base, ...(dragY ? { transform: `translateY(${dragY}px)`, transition: 'none' } : undefined) }} role="dialog" aria-modal="true" aria-label="Sonando Hermes Default">
      {t.art && (
        <div ref={bgRef} className="parallax-bg absolute -inset-6" aria-hidden="true">
          <img src={t.art} alt="" className="w-full h-full object-cover object-center blur-3xl opacity-50" draggable={false} />
        </div>
      )}
      <div className="absolute inset-0" style={bg ? { background: bg } : { background: base }} />

      <div ref={trackRef} className="relative h-full overflow-y-auto">
        <ElegantParticles rgb={prgb} enabled={pcfg.enabled !== false} density={pcfg.density} radius={pcfg.radius}
          force={pcfg.force} showLines={pcfg.showLines} maxOpacity={pcfg.maxOpacity} />
        <div className="relative z-10 max-w-md px-5 lg:max-w-4xl lg:px-8 mx-auto pt-[max(1rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))] min-h-full flex flex-col">
          {/* Header: siempre arriba, separado del contenido */}
          <div className={`flex items-center justify-between shrink-0 transition-opacity duration-300 ${immersive ? 'opacity-0 pointer-events-none h-0 overflow-hidden' : ''}`}>
            <button className="ico-btn !p-2" onClick={onClose} aria-label="Cerrar reproductor"><ChevronDown size={24} /></button>
            <div className="text-center">
              <span className="block text-[10px] font-bold tracking-[0.25em] uppercase" style={{ color: viz }}>Sonando</span>
              <span className="block text-sm font-semibold mt-0.5">{t.official ? 'Versión oficial' : (t.source || 'Música')}</span>
            </div>
            <div className="flex items-center gap-1">
              <button className="ico-btn !p-2" onClick={toggleViz} aria-label="Barras de sonido" style={showViz ? { color: viz } : undefined}><BarChart3 size={20} /></button>
              <button className="ico-btn !p-2" onClick={() => setVinyl((v) => !v)}
                aria-label={vinyl ? 'Ver como foto' : 'Ver como vinilo'}
                title={vinyl ? 'Ver como foto' : 'Ver como vinilo'}
                style={vinyl ? { color: viz } : undefined}>
                {vinyl ? <ImageIcon size={20} /> : <Disc3 size={20} />}
              </button>
              <ParticleSettings cfg={pcfg} setCfg={setPcfg} />
              <button className="ico-btn !p-2" onClick={() => p.toggleFav(t)} aria-label="Favorito">
                <Heart size={22} fill={p.isFav(t) ? 'var(--a)' : 'none'} style={{ color: p.isFav(t) ? 'var(--a)' : undefined }} />
              </button>
            </div>
          </div>

          {immersive && <button className="fixed top-3 right-3 z-50 glass-btn w-10 h-10 rounded-full grid place-items-center" style={{ marginTop: 'env(safe-area-inset-top)' }} onClick={toggleImmersive} aria-label="Salir de inmersivo"><Minimize2 size={18} /></button>}
          {p.blocked && <div className="mt-3"><BlockedBar p={p} /></div>}

          {/* Contenido (carátula + controles): centrado en mitad de pantalla */}
          <div className="flex-1 flex flex-col justify-center">
          <div className="lg:grid lg:grid-cols-2 lg:gap-10 lg:items-center lg:flex-1">

          <div className="lg:sticky lg:top-0">
          {/* Video local / foto / vinilo (YouTube siempre solo-audio) */}
          {isLocalVideo ? (
            <div className="mt-2 mx-auto w-full max-w-[420px]">
              <video ref={localVideoRef} src={t.src} className="w-full aspect-video rounded-[20px] shadow-2xl border border-white/10"
                style={{ background: '#000' }} muted loop playsInline preload="auto" />
              <p className="mt-2 w-full text-center text-[11px]" style={{ color: 'var(--m)' }}>
                Video local · el audio suena sin conexión
              </p>
            </div>
          ) : vinyl ? (
            <div className="mt-2 mx-auto relative shrink-0" style={{ width: 'min(52dvh, 76vw, 330px)', height: 'min(52dvh, 76vw, 330px)' }}>
              <div ref={discRef} className="vinyl-disc" style={{ borderColor: `${wash}88` }}>
                <div className="vinyl-sheen" aria-hidden="true" />
                <div className="vinyl-label">
                  {t.art
                    ? <img src={t.art} alt={t.title} draggable={false} />
                    : <Cover src={t.art} alt={t.title} iconSize={40} className="w-full h-full" />}
                  <span className="vinyl-spindle" aria-hidden="true" />
                </div>
              </div>
              <div className="vinyl-arm" aria-hidden="true" style={{ transform: p.playing ? 'rotate(0deg)' : 'rotate(-30deg)' }}>
                <span className="vinyl-arm-base" style={{ borderColor: wash }} />
                <span className="vinyl-arm-rod" />
                <span className="vinyl-arm-head"><span className="vinyl-arm-tip" style={{ background: wash }} /></span>
              </div>
            </div>
          ) : (
          <div {...swipe} onDragStart={(e) => e.preventDefault()}
              className="art-frame mt-4 lg:mt-6 mx-auto w-full aspect-square max-w-[310px] lg:max-w-[380px] rounded-[28px] shadow-2xl shrink-0 select-none"
              style={{ touchAction: 'pinch-zoom' }}>
              <div ref={coverRef} className="relative w-full h-full will-change-transform" style={{ transition: 'transform .09s linear' }}>
                {t.art ? (
                  <div ref={fgRef} className="parallax-fg absolute -inset-3">
                    <img src={t.art} alt={t.title} draggable={false}
                      className="w-full h-full object-cover object-center pointer-events-none" />
                  </div>
                ) : (
                  <Cover src={t.art} alt={t.title} iconSize={48} className="w-full h-full" />
                )}
              </div>
            </div>
          )}

          {/* Título (tocar para copiar) — clamp a 2 líneas para no romper el layout */}
          <div className="mt-5 lg:text-left text-center min-w-0">
            <button onClick={copyTitle} title="Tocar para copiar el título" aria-label={`Copiar título: ${t.title} de ${t.artist}`} className="block w-full lg:text-left text-center active:opacity-70 transition-opacity rounded-xl min-h-[44px]">
              <span className="block text-xl lg:text-2xl font-semibold leading-tight line-clamp-2 break-words" title={t.title}>{t.title}</span>
            </button>
            <p className="text-[15px] mt-1 truncate" title={t.artist} style={{ color: 'var(--m)' }}>{t.artist}</p>
            {(t.genre || t.mood) && (
              <p className="text-[12px] mt-1 truncate" title={[t.genre, t.mood].filter(Boolean).join(' · ')} style={{ color: 'var(--m)' }}>{[t.genre, t.mood].filter(Boolean).join(' · ')}</p>
            )}
          </div>
          </div>

          <div className="min-w-0">
          {/* Visualizador + timeline zigzag */}
          <div className="mt-3" style={{ color: 'var(--m)' }}>
            {showViz && <Visualizer analyserRef={analyserRef} playing={p.playing} color={viz} height={40} bars={36} />}
            <ZigZag cur={tReal} dur={dur} color={viz} onSeek={(v) => p.seek(v)} />
            <div className="flex justify-between text-[11px] tabular-nums px-1" style={{ color: 'var(--m)' }}>
              <span>{fmtTime(tReal)}</span>
              <span>{p.resolving ? 'buscando audio…' : fmtTime(dur)}</span>
            </div>
          </div>

          {/* Controles estilo 03: grises transparentes, sin cuadros ni fondos */}
          <div className="mt-3 flex items-center justify-between px-6 sm:px-8">
            <button onClick={() => p.toggleShuffle?.()} aria-label={p.shuffle ? 'Desactivar aleatorio' : 'Activar aleatorio'} aria-pressed={p.shuffle ? 'true' : 'false'} title="Aleatorio (S)"
              className="min-w-[48px] min-h-[48px] grid place-items-center active:scale-90 transition"
              style={p.shuffle ? { color: wash } : { color: 'var(--m)' }}>
              <span className="flex flex-col items-center gap-0.5"><Shuffle size={20} /><span className="text-[9px] font-bold leading-none">{p.shuffle ? 'ON' : ''}</span></span>
            </button>
            <button onClick={p.prev} aria-label="Anterior"
              className="min-w-[60px] min-h-[60px] grid place-items-center active:scale-90 transition" style={{ color: 'var(--m)' }}>
              <SkipBack size={44} fill="currentColor" strokeWidth={0} />
            </button>
            <button onClick={p.toggle} aria-label={p.resolving ? 'Buscando audio' : p.playing ? `Pausar ${t.title}` : `Reproducir ${t.title}`} aria-busy={p.resolving ? 'true' : undefined}
              className="min-w-[72px] min-h-[72px] grid place-items-center active:scale-90 transition focus-visible:outline-2 focus-visible:outline-[var(--a)] focus-visible:rounded-2xl" style={{ color: 'var(--t)' }}>
              {p.resolving ? <Loader2 size={56} className="animate-spin" /> : p.playing ? <Pause size={60} fill="currentColor" strokeWidth={0} /> : <Play size={60} fill="currentColor" strokeWidth={0} className="ml-1.5" />}
            </button>
            <button onClick={() => p.next(false)} aria-label="Siguiente"
              className="min-w-[60px] min-h-[60px] grid place-items-center active:scale-90 transition" style={{ color: 'var(--m)' }}>
              <SkipForward size={44} fill="currentColor" strokeWidth={0} />
            </button>
            <button onClick={() => p.cycleRepeat?.()} aria-label={p.repeat === 'one' ? 'Repite una, tocar para cambiar' : p.repeat === 'all' ? 'Repite cola, tocar para cambiar' : 'Activar repetir'} aria-pressed={p.repeat && p.repeat !== 'off' ? 'true' : 'false'} title="Repetir (R)"
              className="min-w-[48px] min-h-[48px] grid place-items-center active:scale-90 transition"
              style={p.repeat && p.repeat !== 'off' ? { color: wash } : { color: 'var(--m)' }}>
              <span className="flex flex-col items-center gap-0.5">{p.repeat === 'one' ? <Repeat1 size={20} /> : <Repeat size={20} />}<span className="text-[9px] font-bold leading-none">{p.repeat === 'one' ? '1' : p.repeat === 'all' ? 'ALL' : ''}</span></span>
            </button>
          </div>
          {/* Letra en línea: siempre letra, tocar expande. La radio va abajo en pequeño. */}
          {(() => {
            const plainPreview = (lrc?.plain || '').split('\n').map((s) => s.trim()).filter(Boolean).slice(0, 2).join(' / ');
            const inline = (!lrc || lrc.state === 'loading')
              ? null
              : (lrc.state === 'ok' && lines.length > 0 && activeIdx >= 0)
                ? lines[activeIdx].x
                : (lrc.state === 'ok' && lines.length > 0)
                  ? lines[0].x
                  : plainPreview || null;
            return (
              <button onClick={() => setFtab('lyrics')} className="mt-2 min-h-[2.75rem] w-full flex items-center justify-center gap-1.5 text-center px-6 py-2"
                aria-label={inline ? `Ver letra completa: ${inline}` : 'Ver letra completa'} aria-expanded={ftab === 'lyrics' ? 'true' : 'false'}>
                {(!lrc || lrc.state === 'loading')
                  ? (
                    <span className="lrc-skel" aria-hidden="true">
                      <i style={{ width: '62%' }} /><i style={{ width: '42%', animationDelay: '.15s' }} />
                      <span className="sr-only">Buscando letra…</span>
                    </span>
                  )
                  : inline
                    ? <span className="text-[13px] font-semibold leading-snug line-clamp-2" style={{ color: wash }}>{inline}</span>
                    : <span className="text-[11px]" style={{ color: 'var(--m)' }}>Sin letra disponible — toca para ver detalle</span>}
              </button>
            );
          })()}
          <p className="mt-1 text-center text-[10px] tabular-nums" style={{ color: 'var(--m)' }}>
            {t.source || 'Música'}{t.videoId ? ` · ${t.videoId.slice(0, 6)}…` : ''}{(p.rate || 1) !== 1 ? ` · ${p.rate}x` : ''}{typeof navigator !== 'undefined' && navigator.connection?.effectiveType ? ` · ${navigator.connection.effectiveType}` : ''}{lrc?.provider ? ` · letra ${lrc.provider}` : ''}{p.radioBusy ? ' · radio buscando…' : ' · radio auto'}{p.shuffle ? ' · aleatorio' : ''}{p.repeat === 'one' ? ' · repite una' : p.repeat === 'all' ? ' · repite cola' : ''}
          </p>

          {/* Secundarios: volumen + velocidad + EQ + fundido + sleep + añadir */}
          <div className={`mt-3 flex items-center justify-center gap-2 text-xs flex-wrap ${immersive ? 'hidden' : ''}`} style={{ color: 'var(--m)' }}>
            <button className="ico-btn" onClick={p.toggleMute} aria-label="Silenciar">
              {p.muted || p.volume === 0 ? <VolumeX size={17} /> : <Volume2 size={17} />}
            </button>
            <input type="range" min="0" max="1" step="0.05" value={p.muted ? 0 : p.volume}
              onChange={(e) => p.setVolume(+e.target.value)} className="w-24 h-1"
              style={{ accentColor: wash }} aria-label="Volumen" />
            <span className="w-px h-4 mx-1" style={{ background: 'var(--bd)' }} />
            <button className="ico-btn" onClick={cycleBoost} aria-label="Potenciar volumen" title="Subir más el volumen"
              style={boost > 1 ? { color: wash } : undefined}>
              <span className="flex items-center gap-0.5"><Speaker size={16} /><span className="text-[10px] font-bold">{boost > 1 ? `${boost}x` : ''}</span></span>
            </button>
            <button className="ico-btn inline-flex items-center gap-1" onClick={() => {
              const i = RATES.indexOf(p.rate || 1);
              const n = RATES[(i + 1) % RATES.length];
              p.setRate?.(n);
              toast?.(n === 1 ? 'Velocidad normal' : `Velocidad ${n}x`, Gauge);
            }} aria-label="Velocidad" title="Velocidad 0.75-2x">
              <Gauge size={16} style={(p.rate || 1) !== 1 ? { color: wash } : undefined} />
              <span className="text-[10px] font-bold">{(p.rate || 1) !== 1 ? `${p.rate}x` : ''}</span>
            </button>
            <button className="ico-btn" onClick={() => setShowEQ((s) => !s)} aria-label="Ecualizador" title="EQ 10 bandas (directos)"
              style={showEQ || (p.eqPreset && p.eqPreset !== 'Plano') ? { color: wash } : undefined}>
              <SlidersHorizontal size={16} />
            </button>
            <select value={p.xfade ?? 1.5} onChange={(e) => { p.setXfade?.(+e.target.value); toast?.(+e.target.value === 0 ? 'Fundido desactivado' : `Fundido ${e.target.value}s`); }}
              className="bg-transparent text-[11px] outline-none border rounded-full px-1.5 py-0.5" style={{ borderColor: 'var(--bd)', color: 'var(--m)' }}
              aria-label="Fundido entre temas" title="Crossfade: fundido entrada/salida">
              {[0, 1, 1.5, 2, 3].map((s) => <option key={s} value={s}>{s === 0 ? 'sin fundido' : `fade ${s}s`}</option>)}
            </select>
            <button className="ico-btn" onClick={() => p.addNext(t)} aria-label="Suena después" title="Duplicar: sonará después">
              <ListPlus size={17} />
            </button>
            <button className="ico-btn" onClick={() => setFtab((f) => (f === 'queue' ? null : 'queue'))} aria-label="Cola" title={`Cola (${p.queue.length})`}
              style={ftab === 'queue' ? { color: wash } : undefined}>
              <ListMusic size={17} />
            </button>
            <div className="flex items-center gap-1">
              <Timer size={16} style={sleepMin ? { color: wash } : undefined} />
              <select value={sleepMin} onChange={(e) => { setSleepMin(+e.target.value); if (+e.target.value) toast?.(`Apago en ${e.target.value} min (fundido)`, Timer); }}
                className="bg-transparent text-xs outline-none" aria-label="Temporizador de apagado" style={{ color: 'var(--m)' }}>
                {SLEEPS.map((m) => <option key={m} value={m}>{m === 0 ? 'Sleep' : `${m}m`}</option>)}
              </select>
              {sleepMin > 0 && <span className="tabular-nums">{fmtTime(sleepLeft)}</span>}
            </div>
          </div>

          {showEQ && (
            <div className="mt-3 rounded-2xl border p-3" style={{ borderColor: 'var(--bd)', background: 'color-mix(in srgb, var(--s) 82%, transparent)' }}>
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className="text-xs font-semibold">EQ 10 bandas{t?.source === 'YouTube' ? ' · no aplica a YouTube (embed)' : ''}</span>
                <span className="ml-auto flex gap-1 flex-wrap">
                  {Object.keys(EQ_PRESETS).map((name) => (
                    <button key={name} onClick={() => {
                      const gains = EQ_PRESETS[name];
                      p.applyEQ?.(name, gains);
                      const el = p.audio?.current;
                      if (el) setEQPreset(el, gains);
                    }}
                      className={`px-2 py-1 rounded-full text-[11px] ${p.eqPreset === name ? 'btn' : 'btn btn-o'}`}>{name}</button>
                  ))}
                </span>
              </div>
              <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
                {(p.eqGains || []).map((g, i) => (
                  <label key={i} className="flex flex-col items-center gap-1 text-[10px]" style={{ color: 'var(--m)' }}>
                    <input type="range" min="-12" max="12" step="1" value={g}
                      onChange={(e) => {
                        const ng = (p.eqGains || []).slice();
                        ng[i] = +e.target.value;
                        p.applyEQ?.('Manual', ng);
                        const el = p.audio?.current;
                        if (el) setEQBand(el, i, +e.target.value);
                      }}
                      className="w-full" style={{ accentColor: wash }} aria-label={`${EQ_FREQS[i]} Hz`} />
                    <span className="tabular-nums">{g > 0 ? `+${g}` : g}</span>
                    <span>{EQ_FREQS[i] >= 1000 ? `${EQ_FREQS[i] / 1000}k` : EQ_FREQS[i]}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Adelantar / retroceder: debajo del volumen y los otros controles */}
          <div className={`mt-2.5 flex items-center justify-center gap-6 text-xs ${immersive ? 'hidden' : ''}`} style={{ color: 'var(--m)' }}>
            <button className="ico-btn !p-2.5" onClick={() => p.seekBy?.(-5)} aria-label="Retroceder 5 segundos" title="-5s">
              <span className="flex items-center gap-1"><RotateCcw size={19} /><span className="text-[11px] font-bold">5</span></span>
            </button>
            <button className="ico-btn !p-2.5" onClick={() => p.seekBy?.(5)} aria-label="Adelantar 5 segundos" title="+5s">
              <span className="flex items-center gap-1"><span className="text-[11px] font-bold">5</span><RotateCw size={19} /></span>
            </button>
          </div>

          {ftab && (
            <div className="fixed inset-0 z-50 modal-in flex flex-col" style={{ background: 'color-mix(in srgb, var(--bg) 94%, transparent)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)' }} role="dialog" aria-label={ftab === 'queue' ? 'Cola' : 'Letra'}>
              <div className="flex items-center justify-between px-5 pt-[max(1rem,env(safe-area-inset-top))] pb-3 max-w-md lg:max-w-2xl w-full mx-auto">
                <div>
                  <p className="text-lg font-semibold leading-tight">{ftab === 'queue' ? 'Cola' : 'Letra'}</p>
                  <p className="text-xs truncate" style={{ color: 'var(--m)' }}>{t.title} · {t.artist}</p>
                </div>
                <button className="ico-btn !p-2" onClick={() => setFtab(null)} aria-label="Cerrar"><ChevronDown size={24} /></button>
              </div>
              <div className="flex-1 overflow-y-auto px-5 pb-[max(2rem,env(safe-area-inset-bottom))] max-w-md lg:max-w-2xl w-full mx-auto">
          {ftab === 'queue' ? (
            <div className="mt-1 rounded-2xl border p-2" style={{ borderColor: 'var(--bd)', background: 'color-mix(in srgb, var(--s) 82%, transparent)' }}>
              <div className="flex items-center gap-2 px-2 py-1 text-[12px]" style={{ color: 'var(--m)' }}>
                <span>{p.queue.length} temas{p.queueDuration ? ` · ${fmtTime(p.queueDuration())} restantes` : ''}</span>
                <span className="ml-auto flex gap-1">
                  <button className="ico-btn !min-w-[40px] !min-h-[40px]" onClick={() => p.dedupeQueue?.()} aria-label="Quitar duplicados" title="Quitar duplicados"><Trash2 size={16} /></button>
                  <button className="ico-btn !min-w-[40px] !min-h-[40px]" onClick={() => p.toggleShuffle?.()} aria-label="Mezclar cola" aria-pressed={p.shuffle ? 'true' : 'false'} title="Mezclar cola"><ArrowUpDown size={16} /></button>
                </span>
              </div>
              {!p.queue.length && (
                <div className="text-center px-2 py-5">
                  <p className="text-sm font-semibold">Cola vacía</p>
                  <p className="text-xs mt-1" style={{ color: 'var(--m)' }}>Agrega temas o deja la radio automática sonando.</p>
                </div>
              )}
              {p.queue.map((q, i) => {
                const active = q.id === t.id;
                return (
                  <div key={`${q.id}-${i}`} className={`flex items-center gap-1.5 p-1.5 rounded-xl ${active ? 'acc-soft' : ''}`} aria-current={active ? 'true' : undefined}>
                    <Cover src={q.art} className="w-10 h-10 !rounded-lg shrink-0" iconSize={14} alt={q.title} />
                    <button onClick={() => p.playAt(i)} className="flex-1 min-w-0 text-left rounded-lg px-1 py-1" aria-label={`Reproducir ${q.title}`}>
                      <p className="text-[13px] truncate">{i + 1}. {q.title}</p>
                      <p className="text-[12px] truncate" style={{ color: 'var(--m)' }}>{q.artist}</p>
                    </button>
                    <span className="flex gap-0.5 shrink-0">
                      <button className="ico-btn !min-w-[36px] !min-h-[40px]" disabled={i <= 0} onClick={() => p.moveInQueue?.(i, i - 1)} aria-label={`Subir ${q.title} en la cola`}><ChevronDown size={16} className="rotate-180" /></button>
                      <button className="ico-btn !min-w-[36px] !min-h-[40px]" disabled={i >= p.queue.length - 1} onClick={() => p.moveInQueue?.(i, i + 1)} aria-label={`Bajar ${q.title} en la cola`}><ChevronDown size={16} /></button>
                    </span>
                    <button className="ico-btn !min-w-[40px] !min-h-[40px] shrink-0" onClick={() => p.removeAt(i)} aria-label={`Quitar ${q.title}`}><X size={16} /></button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="mt-1 rounded-2xl border p-4 text-center" style={{ borderColor: 'var(--bd)', background: 'color-mix(in srgb, var(--s) 82%, transparent)' }}>
              {(lrc?.provider || lrc?.wordSync) && lrc?.state === 'ok' && (
                <div className="flex items-center justify-center gap-2 mb-2 text-[11px]" style={{ color: 'var(--m)' }}>
                  <span className="px-2 py-0.5 rounded-full border" style={{ borderColor: 'var(--bd)' }}>vía {lrc.provider}{lrc.wordSync ? ' · palabra por palabra' : ''}{lrc.cached ? ' · caché' : ''}</span>
                  <span className="flex items-center gap-1">
                    <button className="ico-btn !p-1" onClick={() => setLrcOffset((o) => Math.max(-5, +(o - 0.5).toFixed(1)))} aria-label="Adelantar letra">-0.5s</button>
                    <span className="tabular-nums">{lrcOffset > 0 ? `+${lrcOffset}s` : `${lrcOffset}s`}</span>
                    <button className="ico-btn !p-1" onClick={() => setLrcOffset((o) => Math.min(5, +(o + 0.5).toFixed(1)))} aria-label="Retrasar letra">+0.5s</button>
                  </span>
                </div>
              )}
              {(!lrc || lrc.state === 'loading') && <p className="text-[13px] flex items-center justify-center gap-2" role="status"><Loader2 size={15} className="animate-spin" /> Buscando letra…</p>}
              {lrc?.state === 'empty' && <p className="text-[13px]" style={{ color: 'var(--m)' }}>Sin letra disponible para este tema.</p>}
              {lrc?.state === 'ok' && lines.length > 0 && lines.map((l, i) => {
                const isActive = i === activeIdx;
                // Karaoke palabra por palabra si el provider trae words
                if (isActive && l.words?.length) {
                  let wi = -1;
                  for (let k = 0; k < l.words.length; k++) if ((l.words[k].t ?? 0) <= tcur) wi = k;
                  return (
                    <p key={i} ref={activeRef} className="lrc text-xl py-1.5 font-semibold" style={{ color: wash }}>
                      {l.words.map((w, k) => (
                        <span key={k} style={{ opacity: k <= wi ? 1 : 0.45 }}>{w.x}{k < l.words.length - 1 ? ' ' : ''}</span>
                      ))}
                    </p>
                  );
                }
                return (
                  <p key={i} ref={isActive ? activeRef : undefined}
                    className={`lrc text-lg py-1.5 ${isActive ? 'font-semibold' : ''}`}
                    style={isActive ? { color: wash } : { color: 'var(--m)', opacity: Math.max(0.45, 1 - Math.min(3, Math.abs(i - activeIdx)) * 0.2) }}>
                    {l.x}
                  </p>
                );
              })}
              {lrc?.state === 'ok' && !lines.length && (
                <p className="text-sm whitespace-pre-line text-left" style={{ color: 'var(--t)' }}>{lrc.plain}</p>
              )}
            </div>
          )}
              </div>
            </div>
          )}
          </div>
          </div>
          </div>
        </div>
      </div>
    </div>
  );
}
