import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronDown, Play, Pause, SkipBack, SkipForward, Heart, Volume2, VolumeX,
  Timer, ListMusic, Loader2, Shuffle, Repeat, Repeat1, Gauge, SlidersHorizontal, MoreHorizontal, ScrollText, Copy,
} from 'lucide-react';
import { fmtTime } from '../lib/format';
import Cover from './Cover';
import BlockedBar from './BlockedBar';
import { attachAnalyser, setEQBand, setEQPreset, EQ_FREQS, EQ_PRESETS } from '../lib/analyser';
import useArtColors from '../hooks/useArtColors';
import useParallax from '../hooks/useParallax';
import { getLyrics, activeLineIndex } from '../services/lyrics';

const SLEEPS = [0, 5, 10, 15, 30, 45, 60];
const RATES = [0.75, 1, 1.25, 1.5, 1.75, 2];

// Tema BitChord: frosted-glass + canvas animado + theming por carátula + letras Apple.
// Reutiliza el mismo `p` (cola, letras, EQ, shuffle/repeat, sleep, velocidad). Solo cambia layout.
export default function FullPlayerBitChord({ p, toast, dark, onClose: onCloseProp }) {
  const t = p.track;
  const [closing, setClosing] = useState(false);
  const [showEQ, setShowEQ] = useState(false);
  const [showQueue, setShowQueue] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [sleepMin, setSleepMin] = useState(0);
  const [sleepLeft, setSleepLeft] = useState(0);
  const [lrc, setLrc] = useState(null);
  const [lrcOffset, setLrcOffset] = useState(0);
  const analyserRef = useRef(null);
  const onClose = () => { if (closing) return; setClosing(true); setTimeout(() => onCloseProp?.(), 260); };
  const colors = useArtColors(t?.art);
  const { trackRef, bgRef, fgRef } = useParallax({ bg: 24, fg: 10 });
  const wash = colors?.main || 'var(--a)';
  const viz = colors?.main || '#818cf8';
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

  // Analizador + boost + EQ (solo directos; YT simulado como en Hermes)
  useEffect(() => {
    analyserRef.current = null;
    if (!t || t.source === 'YouTube') return;
    let dead = false;
    const el = p.audio.current;
    if (el) {
      attachAnalyser(el).then((a) => {
        if (dead) return;
        analyserRef.current = a;
        if (a) { setEQPreset(el, p.eqGains || [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]); }
      });
    }
    return () => { dead = true; };
  }, [t?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!t || t.source === 'YouTube') return;
    const el = p.audio?.current;
    if (el) setEQPreset(el, p.eqGains || [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  }, [p.eqGains, t?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Letras multi-provider (misma fuente que Hermes)
  useEffect(() => {
    if (!t) return;
    setLrc({ state: 'loading' });
    const ctrl = new AbortController();
    getLyrics({ artist: t.artist || '', title: t.title || '', duration: t.duration || p.time?.dur || 0, signal: ctrl.signal })
      .then((j) => setLrc({ state: 'ok', lines: j.lines || [], plain: j.plain || '', provider: j.provider || '', wordSync: !!j.wordSync }))
      .catch(() => setLrc({ state: 'empty' }));
    return () => ctrl.abort();
  }, [t?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sleep con fundido 10s
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
            const step = startVol / 10; let n = 0;
            const fv = setInterval(() => { n++; try { a.volume = Math.max(0, startVol - step * n); } catch {} if (n >= 10) clearInterval(fv); }, 1000);
          } else {
            let n = 0; const base = p.rawVolume ?? 0.9;
            const fv = setInterval(() => { n++; try { p.ytRef?.current?.applyVolume?.(Math.max(0, base * (1 - n / 10)), false); } catch {} if (n >= 10) clearInterval(fv); }, 1000);
          }
        } catch {}
      }
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
  const nextLine = activeIdx >= 0 ? lines[activeIdx + 1] : lines[0];

  if (!t) return null;
  const dur = (isFinite(p.time?.dur) && p.time.dur > 0 ? p.time.dur : t.duration) || 0;
  const pct = dur > 0 ? Math.min(100, (tReal / dur) * 100) : 0;
  // Difuminado pantalla completa estilo BitChord: arte full-bleed con blur fuerte
  // + velo oscuro + tinte fuerte de la carátula. El contenido flota encima.
  const tint = colors?.main || 'transparent';
  const bg = dark
    ? `linear-gradient(180deg, rgba(0,0,0,.08) 0%, rgba(0,0,0,.42) 45%, rgba(9,9,11,.96) 100%)`
    : `linear-gradient(180deg, rgba(255,255,255,.06) 0%, rgba(244,244,245,.62) 55%, #f4f4f5 100%)`;

  return (
    <div className={`fixed inset-0 z-40 overflow-hidden ${closing ? 'player-out' : 'player-in'}`} role="dialog" aria-modal="true" aria-label="Sonando Hermes 02">
      {t.art && (
        <div ref={bgRef} className="parallax-bg absolute -inset-6" aria-hidden="true">
          <img src={t.art} alt="" aria-hidden="true" draggable={false} className="w-full h-full object-cover object-center opacity-90" style={{ filter: 'blur(70px) saturate(1.8)' }} />
        </div>
      )}
      {colors && <div className="absolute inset-0" style={{ background: tint, opacity: 0.35 }} />}
      <div className="absolute inset-0" style={{ background: bg }} />
      <div ref={trackRef} className="relative h-full overflow-y-auto">
        <div className="relative z-10 max-w-md lg:max-w-2xl mx-auto px-5 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))] min-h-full flex flex-col">
          {/* Barra frosted superior */}
          <div className="flex items-center justify-between rounded-full px-2 py-1.5"
            style={{ background: 'color-mix(in srgb, var(--s) 55%, transparent)', backdropFilter: 'blur(24px) saturate(1.4)', WebkitBackdropFilter: 'blur(24px) saturate(1.4)', border: '1px solid var(--bd)' }}>
            <button className="ico-btn !p-2" onClick={onClose} aria-label="Cerrar"><ChevronDown size={22} /></button>
            <p className="text-xs font-semibold tracking-wide" style={{ color: 'var(--m)' }}>Playing from {t.source || 'Música'}</p>
            <button className="ico-btn !p-2" onClick={() => setShowStats((s) => !s)} aria-label="Stats" title="Stats for nerds" style={showStats ? { color: viz } : undefined}><MoreHorizontal size={20} /></button>
          </div>

          {p.blocked && <div className="mt-3"><BlockedBar p={p} /></div>}
          {showStats && (
            <p className="mt-2 text-center text-[10px] tabular-nums rounded-full px-3 py-1.5" style={{ color: 'var(--m)', background: 'color-mix(in srgb, var(--s) 70%, transparent)', border: '1px solid var(--bd)' }}>
              {t.source || 'Música'}{t.videoId ? ` · ${t.videoId.slice(0, 6)}…` : ''}{(p.rate || 1) !== 1 ? ` · ${p.rate}x` : ''}{typeof navigator !== 'undefined' && navigator.connection?.effectiveType ? ` · ${navigator.connection.effectiveType}` : ''}{lrc?.provider ? ` · ${lrc.provider}` : ''}{p.xfade ? ` · fade ${p.xfade}s` : ''}{p.eqPreset && p.eqPreset !== 'Plano' ? ` · EQ ${p.eqPreset}` : ''}
            </p>
          )}

          {/* Hero: arte de media pantalla */}
          <div className="art-frame mt-4 mx-auto w-full max-w-[420px] aspect-square rounded-[28px] shadow-2xl relative">
            {t.art ? (
              <div ref={fgRef} className="parallax-fg absolute -inset-3">
                <img src={t.art} alt={t.title} className="w-full h-full object-cover object-center" draggable={false} />
              </div>
            ) : <Cover src={t.art} alt={t.title} iconSize={48} className="w-full h-full" />}
          </div>

          {/* Título + fav + cola (tocar el título para copiar) */}
          <div className="mt-3 flex items-start gap-2">
            <div className="flex-1 min-w-0">
              <button onClick={copyTitle} title="Tocar para copiar el título" aria-label={`Copiar título: ${t.title} de ${t.artist}`} className="block w-full text-left active:opacity-70 transition-opacity rounded-xl min-h-[44px]">
                <span className="block text-[22px] font-bold leading-tight line-clamp-2 break-words" title={t.title}>{t.title}</span>
              </button>
              <p className="text-[15px] mt-0.5 truncate" title={t.artist} style={{ color: 'var(--m)' }}>{t.artist}</p>
            </div>
            <button className="ico-btn !min-w-[48px] !min-h-[48px] shrink-0" onClick={() => p.toggleFav(t)} aria-label={p.isFav(t) ? `Quitar de favoritos: ${t.title}` : `Marcar favorito: ${t.title}`} aria-pressed={p.isFav(t) ? 'true' : 'false'}>
              <Heart size={23} fill={p.isFav(t) ? wash : 'none'} style={{ color: p.isFav(t) ? wash : undefined }} />
            </button>
            <button className="ico-btn !min-w-[48px] !min-h-[48px] shrink-0" onClick={() => setShowQueue((s) => !s)} aria-label={showQueue ? 'Ocultar cola' : 'Ver cola'} aria-expanded={showQueue ? 'true' : 'false'} style={showQueue ? { color: viz } : undefined}><ListMusic size={23} /></button>
          </div>

          {/* Letra: solo la línea que suena (altura fija, no rompe el diseño) */}
          <div className="mt-3 rounded-[24px] px-4 pt-2.5 pb-3 min-h-[6.5rem] flex flex-col justify-center text-center" style={{ background: 'color-mix(in srgb, var(--s) 60%, transparent)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', border: '1px solid var(--bd)' }}>
            <div className="flex items-center justify-center gap-2 mb-1 text-[11px]" style={{ color: 'var(--m)' }}>
              <ScrollText size={13} />
              <span>{lrc?.state === 'ok' ? `Letra vía ${lrc.provider || ''}${lrc.wordSync ? ' · palabra por palabra' : ''}` : 'Letra'}</span>
              <span className="flex items-center gap-1">
                <button className="ico-btn !p-1" onClick={() => setLrcOffset((o) => Math.max(-5, +(o - 0.5).toFixed(1)))} aria-label="Adelantar letra">-0.5s</button>
                <span className="tabular-nums">{lrcOffset > 0 ? `+${lrcOffset}s` : `${lrcOffset}s`}</span>
                <button className="ico-btn !p-1" onClick={() => setLrcOffset((o) => Math.min(5, +(o + 0.5).toFixed(1)))} aria-label="Retrasar letra">+0.5s</button>
              </span>
            </div>
            {(!lrc || lrc.state === 'loading') && <p className="text-[13px] flex items-center justify-center gap-2" role="status"><Loader2 size={15} className="animate-spin" /> Buscando letra…</p>}
            {lrc?.state === 'empty' && <p className="text-[13px]" style={{ color: 'var(--m)' }}>Sin letra disponible para este tema.</p>}
            {lrc?.state === 'ok' && lines.length > 0 && activeLine && (() => {
              const l = activeLine;
              if (l.words?.length) {
                let wi = -1;
                for (let k = 0; k < l.words.length; k++) if ((l.words[k].t ?? 0) <= tcur) wi = k;
                const activeColor = dark ? '#fff' : wash;
                return (
                  <>
                    <p className="text-xl font-bold leading-snug line-clamp-2 break-words" style={dark ? { color: '#fff', textShadow: '0 2px 12px rgba(0,0,0,.5)' } : { color: wash }}>
                      {l.words.map((w, k) => <span key={k} style={{ opacity: k <= wi ? 1 : 0.45 }}>{w.x}{k < l.words.length - 1 ? ' ' : ''}</span>)}
                    </p>
                    {nextLine && <p className="text-[13px] mt-1 truncate" style={{ color: 'var(--m)' }}>{nextLine.x}</p>}
                  </>
                );
              }
              return (
                <>
                  <p className="text-xl font-bold leading-snug line-clamp-2 break-words" style={dark ? { color: '#fff', textShadow: '0 2px 12px rgba(0,0,0,.5)' } : { color: wash }}>{l.x}</p>
                  {nextLine && <p className="text-[13px] mt-1 truncate" style={{ color: 'var(--m)' }}>{nextLine.x}</p>}
                </>
              );
            })()}
            {lrc?.state === 'ok' && !lines.length && <p className="text-sm whitespace-pre-line line-clamp-3">{lrc.plain}</p>}
          </div>

          {/* Progreso lineal — táctil 44px + teclado */}
          <div className="mt-4">
            <div className="rounded-full cursor-pointer touch-none select-none py-3 -my-3" style={{ backgroundClip: 'content-box' }}
              onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); if (r.width && dur) p.seek(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)) * dur); }}
              onKeyDown={(e) => {
                if (!dur) return;
                if (e.key === 'ArrowRight') { e.preventDefault(); p.seek(Math.min(dur, tReal + 10)); }
                else if (e.key === 'ArrowLeft') { e.preventDefault(); p.seek(Math.max(0, tReal - 10)); }
                else if (e.key === 'Home') { e.preventDefault(); p.seek(0); }
                else if (e.key === 'End') { e.preventDefault(); p.seek(dur); }
              }}
              tabIndex={0}
              role="slider" aria-label={`Progreso de ${t.title}`} aria-valuemin={0} aria-valuemax={Math.round(dur)} aria-valuenow={Math.round(tReal)}>
              <div className="h-1.5 rounded-full" style={{ background: 'color-mix(in srgb, var(--t) 20%, transparent)' }}>
                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: dark ? '#fff' : wash }} />
              </div>
            </div>
            <div className="flex justify-between text-[12px] tabular-nums mt-1" style={{ color: 'var(--m)' }}>
              <span>{fmtTime(tReal)}</span>
              <span>{p.resolving ? 'buscando…' : `-${fmtTime(Math.max(0, dur - tReal))}`}</span>
            </div>
          </div>

          {/* Controles grandes — 48px+ */}
          <div className="mt-3 flex items-center justify-between px-1 sm:px-2">
            <button className="ico-btn !min-w-[48px] !min-h-[48px] flex-col !gap-0.5" onClick={() => p.toggleShuffle?.()} aria-label={p.shuffle ? 'Desactivar aleatorio' : 'Activar aleatorio'} aria-pressed={p.shuffle ? 'true' : 'false'} style={p.shuffle ? { color: dark ? '#fff' : wash } : undefined}><Shuffle size={22} /><span className="text-[9px] font-bold leading-none">{p.shuffle ? 'ON' : ''}</span></button>
            <button onClick={p.prev} aria-label="Anterior" className="min-w-[56px] min-h-[56px] grid place-items-center rounded-2xl active:scale-90 transition" style={{ color: dark ? '#fff' : 'var(--t)' }}><SkipBack size={42} fill="currentColor" /></button>
            <button onClick={p.toggle} aria-label={p.resolving ? 'Buscando audio' : p.playing ? `Pausar ${t.title}` : `Reproducir ${t.title}`} aria-busy={p.resolving ? 'true' : undefined} className="min-w-[72px] min-h-[72px] grid place-items-center rounded-3xl active:scale-90 transition" style={{ color: dark ? '#fff' : 'var(--t)' }}>
              {p.resolving ? <Loader2 size={60} className="animate-spin" /> : p.playing ? <Pause size={60} fill="currentColor" /> : <Play size={60} fill="currentColor" className="ml-2" />}
            </button>
            <button onClick={() => p.next(false)} aria-label="Siguiente" className="min-w-[56px] min-h-[56px] grid place-items-center rounded-2xl active:scale-90 transition" style={{ color: dark ? '#fff' : 'var(--t)' }}><SkipForward size={42} fill="currentColor" /></button>
            <button className="ico-btn !min-w-[48px] !min-h-[48px] flex-col !gap-0.5" onClick={() => p.cycleRepeat?.()} aria-label="Repetir" aria-pressed={p.repeat && p.repeat !== 'off' ? 'true' : 'false'} style={p.repeat && p.repeat !== 'off' ? { color: dark ? '#fff' : wash } : undefined}>
              {p.repeat === 'one' ? <Repeat1 size={22} /> : <Repeat size={22} />}<span className="text-[9px] font-bold leading-none">{p.repeat === 'one' ? '1' : p.repeat === 'all' ? 'ALL' : ''}</span>
            </button>
          </div>

          {/* Volumen + velocidad + EQ + fundido + sleep */}
          <div className="mt-3 flex items-center gap-2 text-xs flex-wrap justify-center" style={{ color: 'var(--m)' }}>
            <VolumeX size={15} />
            <input type="range" min="0" max="1" step="0.05" value={p.muted ? 0 : p.volume}
              onChange={(e) => p.setVolume(+e.target.value)} className="w-28 h-1" style={{ accentColor: '#fff' }} aria-label="Volumen" />
            <Volume2 size={15} />
            <button className="ico-btn inline-flex items-center gap-1" onClick={() => {
              const i = RATES.indexOf(p.rate || 1); const n = RATES[(i + 1) % RATES.length];
              p.setRate?.(n); toast?.(n === 1 ? 'Velocidad normal' : `Velocidad ${n}x`, Gauge);
            }} aria-label="Velocidad"><Gauge size={15} /><span className="text-[10px] font-bold">{(p.rate || 1) !== 1 ? `${p.rate}x` : ''}</span></button>
            <button className="ico-btn" onClick={() => setShowEQ((s) => !s)} aria-label="EQ" style={showEQ ? { color: '#fff' } : undefined}><SlidersHorizontal size={15} /></button>
            <select value={p.xfade ?? 1.5} onChange={(e) => p.setXfade?.(+e.target.value)}
              className="bg-transparent text-[11px] outline-none border rounded-full px-1.5 py-0.5" style={{ borderColor: 'var(--bd)', color: 'var(--m)' }} aria-label="Fundido">
              {[0, 1, 1.5, 2, 3].map((s) => <option key={s} value={s}>{s === 0 ? 'sin fade' : `fade ${s}s`}</option>)}
            </select>
            <Timer size={15} style={sleepMin ? { color: '#fff' } : undefined} />
            <select value={sleepMin} onChange={(e) => { setSleepMin(+e.target.value); if (+e.target.value) toast?.(`Apago en ${e.target.value} min`, Timer); }}
              className="bg-transparent text-[11px] outline-none" style={{ color: 'var(--m)' }} aria-label="Sleep">
              {SLEEPS.map((m) => <option key={m} value={m}>{m === 0 ? 'Sleep' : `${m}m`}</option>)}
            </select>
            {sleepMin > 0 && <span className="tabular-nums">{fmtTime(sleepLeft)}</span>}
          </div>

          {showEQ && (
            <div className="mt-3 rounded-2xl border p-3" style={{ borderColor: 'var(--bd)', background: 'color-mix(in srgb, var(--s) 70%, transparent)' }}>
              <div className="flex gap-1 flex-wrap mb-2">
                {Object.keys(EQ_PRESETS).map((name) => (
                  <button key={name} onClick={() => { p.applyEQ?.(name, EQ_PRESETS[name]); const el = p.audio?.current; if (el) setEQPreset(el, EQ_PRESETS[name]); }}
                    className={`px-2 py-1 rounded-full text-[11px] ${p.eqPreset === name ? 'btn' : 'btn btn-o'}`}>{name}</button>
                ))}
              </div>
              <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
                {(p.eqGains || []).map((g, i) => (
                  <label key={i} className="flex flex-col items-center gap-1 text-[10px]" style={{ color: 'var(--m)' }}>
                    <input type="range" min="-12" max="12" step="1" value={g}
                      onChange={(e) => { const ng = (p.eqGains || []).slice(); ng[i] = +e.target.value; p.applyEQ?.('Manual', ng); const el = p.audio?.current; if (el) setEQBand(el, i, +e.target.value); }}
                      className="w-full" style={{ accentColor: '#fff' }} aria-label={`${EQ_FREQS[i]} Hz`} />
                    <span className="tabular-nums">{g > 0 ? `+${g}` : g}</span>
                    <span>{EQ_FREQS[i] >= 1000 ? `${EQ_FREQS[i] / 1000}k` : EQ_FREQS[i]}</span>
                  </label>
                ))}
              </div>
              {t?.source === 'YouTube' && <p className="text-[11px] mt-2" style={{ color: 'var(--m)' }}>EQ no aplica a YouTube (embed).</p>}
            </div>
          )}

          {showQueue && (
            <div className="mt-3 rounded-2xl border p-2 max-h-72 overflow-y-auto overscroll-contain" style={{ borderColor: 'var(--bd)', background: 'color-mix(in srgb, var(--s) 70%, transparent)' }}>
              <p className="text-[12px] px-2 py-1.5" style={{ color: 'var(--m)' }}>{p.queue.length} en cola{p.queueDuration ? ` · ${fmtTime(p.queueDuration())}` : ''}</p>
              {!p.queue.length && <p className="text-[13px] text-center px-2 py-4" style={{ color: 'var(--m)' }}>Cola vacía — la radio automática seguirá sonando.</p>}
              {p.queue.map((qq, i) => (
                <div key={`${qq.id}-${i}`} className={`flex items-center gap-2 p-1.5 rounded-xl ${qq.id === t.id ? 'acc-soft' : ''}`} aria-current={qq.id === t.id ? 'true' : undefined}>
                  <Cover src={qq.art} className="w-10 h-10 !rounded-lg shrink-0" iconSize={14} alt={qq.title} />
                  <button onClick={() => p.playAt(i)} className="flex-1 min-w-0 text-left rounded-lg px-1 py-1.5" aria-label={`Reproducir ${qq.title}`}>
                    <p className="text-[13px] truncate">{i + 1}. {qq.title}</p>
                    <p className="text-[12px] truncate" style={{ color: 'var(--m)' }}>{qq.artist}</p>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
