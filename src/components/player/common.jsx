import { useEffect, useMemo, useRef, useState } from 'react';
import { X, ChevronDown, Shuffle, Repeat, Repeat1, Share2, Loader2, Gauge, Timer, Copy, ImageIcon, Headphones, Trash2, Music2 } from 'lucide-react';
import { fmtTime } from '../../lib/format';
import { attachAnalyser, setEQPreset, EQ_PRESETS } from '../../lib/analyser';
import { getLyrics, activeLineIndex } from '../../services/lyrics';

export const FONT = "'Inter', system-ui, -apple-system, Roboto, 'SF Pro Display', sans-serif";
export const SLEEPS = [0, 5, 10, 15, 30, 45, 60];
export const RATES = [0.75, 1, 1.25, 1.5, 1.75, 2];

/** Nombre de la salida de audio (auriculares/bluetooth) si el navegador lo revela; si no, "Este teléfono".
 *  Límite real de la web: los nombres de dispositivos solo se ven con permiso de audio y no en todos los navegadores. */
export function useAudioOutput(isPhone = true) {
  const [label, setLabel] = useState('');
  useEffect(() => {
    const md = navigator.mediaDevices;
    if (!md?.enumerateDevices) return undefined;
    let dead = false;
    const read = async () => {
      try {
        const ds = await md.enumerateDevices();
        const outs = ds.filter((d) => d.kind === 'audiooutput' && d.label);
        const pick = outs.find((d) => d.deviceId !== 'default' && d.deviceId !== 'communications') || outs[0];
        const name = String(pick?.label || '').replace(/^(default|predeterminado)\s*[-–]\s*/i, '').trim();
        if (!dead) setLabel(name && !/speaker|altavoz|earpiece|built-?in|interno/i.test(name) ? name : '');
      } catch { if (!dead) setLabel(''); }
    };
    read();
    md.addEventListener?.('devicechange', read);
    return () => { dead = true; md.removeEventListener?.('devicechange', read); };
  }, []);
  return label || (isPhone ? 'Este teléfono' : 'Este dispositivo');
}

/** Letra, temporizador de apagado, EQ y cierre animado: lo común a los dos reproductores. */
export function usePlayerBits(p, toast, onCloseProp) {
  const t = p.track;
  const [closing, setClosing] = useState(false);
  const [sleepMin, setSleepMin] = useState(0);
  const [sleepLeft, setSleepLeft] = useState(0);
  const [lrc, setLrc] = useState(null);
  const [lrcOffset, setLrcOffset] = useState(0);
  const onClose = () => { if (closing) return; setClosing(true); setTimeout(() => onCloseProp?.(), 260); };
  const closeRef = useRef(null); closeRef.current = onClose;
  useEffect(() => {
    const k = (e) => { if (e.key === 'Escape') closeRef.current?.(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, []);

  useEffect(() => {
    if (!t || t.source === 'YouTube') return undefined;
    let dead = false;
    const el = p.audio.current;
    if (el) attachAnalyser(el).then((a) => { if (!dead && a) setEQPreset(el, p.eqGains || [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]); });
    return () => { dead = true; };
  }, [t?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!t) return undefined;
    setLrc({ state: 'loading' }); setLrcOffset(0);
    const ctrl = new AbortController();
    getLyrics({ artist: t.artist || '', title: t.title || '', duration: t.duration || p.time?.dur || 0, signal: ctrl.signal })
      .then((j) => setLrc({ state: 'ok', lines: j.lines || [], plain: j.plain || '', provider: j.provider || '' }))
      .catch(() => setLrc({ state: 'empty' }));
    return () => ctrl.abort();
  }, [t?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!sleepMin) return undefined;
    const end = Date.now() + sleepMin * 60000;
    setSleepLeft(sleepMin * 60);
    const iv = setInterval(() => {
      const s = Math.max(0, Math.round((end - Date.now()) / 1000));
      setSleepLeft(s);
      if (s <= 0) { clearInterval(iv); setSleepMin(0); p.pause(); toast?.('Temporizador: música en pausa', Timer); }
    }, 1000);
    return () => clearInterval(iv);
  }, [sleepMin]); // eslint-disable-line react-hooks/exhaustive-deps

  const lines = lrc?.lines || [];
  const tReal = p.time?.cur || 0;
  const activeIdx = useMemo(() => activeLineIndex(lines, tReal + lrcOffset), [lines, tReal, lrcOffset]);
  const hasLyrics = lrc?.state === 'ok' && (lines.length > 0 || !!lrc.plain);
  return { closing, onClose, sleepMin, setSleepMin, sleepLeft, lrc, lines, lrcOffset, setLrcOffset, activeIdx, tReal, hasLyrics };
}

/** Texto amable de la vista previa de letra. */
export function lyricPreview(lrc, lines, activeIdx) {
  if (!lrc || lrc.state === 'loading') return 'Buscando los versos…';
  if (lrc.state === 'empty' || (lrc.state === 'ok' && !lines.length && !lrc.plain)) return 'Esta canción aún no tiene letra, pero la música sigue ♪';
  if (lines.length) return (activeIdx >= 0 ? lines[activeIdx] : lines[0])?.x || '♪';
  return String(lrc.plain).split('\n').find((l) => l.trim()) || '♪';
}

export async function shareTrack(t, toast) {
  const text = `${t.title}${t.artist ? ` — ${t.artist}` : ''}`;
  const url = t.videoId ? `https://youtu.be/${t.videoId}` : undefined;
  try {
    if (navigator.share) await navigator.share({ title: t.title, text, url });
    else { await navigator.clipboard.writeText(url ? `${text} ${url}` : text); toast?.('Enlace copiado', Copy); }
  } catch { /* cancelado */ }
}

/** Letra a pantalla completa (como Apple/BitChord): fuente elegante, línea activa grande, el resto difuminado.
 *  Los controles se ocultan solos a los 3 s; tocar fuera de una línea los trae de vuelta. */
export function LyricsMode({ t, colors, lrc, lines, activeIdx, onSeek, controls, onShare }) {
  const main = colors?.main || '#6b4a2a';
  const [show, setShow] = useState(true);
  const timer = useRef(null);
  const box = useRef(null);
  const lineEls = useRef([]);
  const userScroll = useRef(0);
  const arm = () => { clearTimeout(timer.current); timer.current = setTimeout(() => setShow(false), 3000); };
  useEffect(() => { arm(); return () => clearTimeout(timer.current); }, []);
  const toggle = () => { if (show) { clearTimeout(timer.current); setShow(false); } else { setShow(true); arm(); } };

  // Seguir la letra: centra la línea activa en el tercio superior, con animación suave.
  useEffect(() => {
    const el = box.current; const ln = lineEls.current[activeIdx];
    if (!el || !ln || Date.now() < userScroll.current) return;
    el.scrollTo({ top: Math.max(0, ln.offsetTop - el.clientHeight * 0.3), behavior: 'smooth' });
  }, [activeIdx]);
  const pauseFollow = () => { userScroll.current = Date.now() + 3500; };

  return (
    <div className="absolute inset-0 z-30 flex flex-col" style={{ background: `linear-gradient(180deg, ${main} 0%, color-mix(in srgb, ${main} 45%, #000) 100%)`, animation: 'lyIn .3s ease-out' }}>
      <style>{`@keyframes lyIn{from{opacity:0}to{opacity:1}}@keyframes lyNote{0%,100%{transform:translateY(0);opacity:.5}50%{transform:translateY(-8px);opacity:1}}`}</style>
      {/* Cabecera: carátula pequeña + nombre + artista */}
      <div className="shrink-0 flex items-center gap-3 px-5 pt-[max(1rem,env(safe-area-inset-top))] pb-3" style={{ background: `linear-gradient(180deg, ${main} 60%, transparent)`, zIndex: 2 }}>
        {t.art && <img src={t.art} alt="" referrerPolicy="no-referrer" className="w-12 h-12 rounded-md object-cover shadow-lg shrink-0" />}
        <div className="min-w-0 flex-1">
          <p className="serif text-[22px] leading-tight truncate text-white font-semibold">{t.title}</p>
          <p className="serif text-[17px] leading-tight truncate text-white/65">{t.artist}</p>
        </div>
        <button onClick={onShare} className="w-10 h-10 rounded-full grid place-items-center shrink-0 bg-white/15" aria-label="Compartir"><Share2 size={18} color="#fff" /></button>
      </div>

      <div ref={box} onClick={toggle} onTouchStart={pauseFollow} onWheel={pauseFollow} className="flex-1 overflow-y-auto px-6" style={{ paddingTop: '2rem', paddingBottom: '55vh', maskImage: 'linear-gradient(180deg, transparent 0, #000 6%, #000 90%, transparent 100%)', WebkitMaskImage: 'linear-gradient(180deg, transparent 0, #000 6%, #000 90%, transparent 100%)' }}>
        {(!lrc || lrc.state === 'loading') && (
          <div className="pt-24 text-center text-white">
            <div className="flex justify-center gap-2 mb-4" aria-hidden="true">{[0, 1, 2].map((i) => <Music2 key={i} size={22} style={{ animation: `lyNote 1.2s ease-in-out ${i * 0.2}s infinite` }} />)}</div>
            <p className="serif text-[28px] font-semibold">Buscando los versos…</p>
            <p className="text-sm text-white/65 mt-1">Un momento, ya casi.</p>
          </div>
        )}
        {(lrc?.state === 'empty' || (lrc?.state === 'ok' && !lines.length && !lrc.plain)) && (
          <div className="pt-24 text-center text-white">
            <Music2 size={34} className="mx-auto mb-4 opacity-80" />
            <p className="serif text-[28px] font-semibold leading-snug">Aún no tenemos la letra de esta canción</p>
            <p className="text-sm text-white/65 mt-2">Disfruta la música: si la encontramos, aparecerá aquí.</p>
          </div>
        )}
        {lrc?.state === 'ok' && lines.length > 0 && lines.map((l, i) => {
          const on = i === activeIdx;
          const d = activeIdx < 0 ? 2 : Math.min(5, Math.abs(i - activeIdx));
          return (
            <p key={i} ref={(el) => { lineEls.current[i] = el; }} onClick={(e) => { e.stopPropagation(); onSeek(Math.max(0, (l.t ?? 0) - 0.2)); }}
              className="serif cursor-pointer leading-[1.15] origin-left"
              style={{ fontSize: 'clamp(30px, 8.6vw, 40px)', fontWeight: on ? 600 : 500, padding: '.42em 0', color: '#fff', opacity: on ? 1 : Math.max(.16, .5 - d * .08), filter: on ? 'none' : `blur(${Math.min(2.4, d * .55)}px)`, transform: on ? 'scale(1.03)' : 'scale(1)', transition: 'opacity .5s, filter .5s, transform .5s, font-weight .3s' }}>
              {l.x || '♪'}
            </p>
          );
        })}
        {lrc?.state === 'ok' && !lines.length && !!lrc.plain && (
          <p className="serif text-[28px] leading-snug whitespace-pre-line text-white/90">{lrc.plain}</p>
        )}
      </div>

      {/* Controles: se ocultan a los 3 s */}
      <div onClick={(e) => e.stopPropagation()} onPointerDown={arm}
        className="absolute inset-x-0 bottom-0 px-5 pt-10 pb-[max(1rem,env(safe-area-inset-bottom))]"
        style={{ background: `linear-gradient(180deg, transparent, color-mix(in srgb, ${main} 55%, #000) 55%)`, transform: show ? 'translateY(0)' : 'translateY(105%)', opacity: show ? 1 : 0, transition: 'transform .4s cubic-bezier(.3,.9,.3,1), opacity .3s', pointerEvents: show ? 'auto' : 'none' }}>
        <div className="max-w-md mx-auto">{controls}</div>
      </div>
    </div>
  );
}

/** Hoja con Cola / Más (velocidad, temporizador, ecualizador, carátula original). */
export function PlayerSheet({ p, toast, bits, initial = 'cola', onClose }) {
  const t = p.track;
  const [tab, setTab] = useState(initial);
  const canRevert = !!(t.ytArt || t.origArt || /i\.ytimg\.com/.test(String(t.art || '')));
  const revert = async () => {
    const r = await p.toggleArt?.();
    toast?.(r === 'yt' ? 'Carátula de YouTube' : r === 'original' ? 'Carátula original' : 'No hay otra carátula disponible', ImageIcon);
  };
  const copy = async () => { try { await navigator.clipboard.writeText(`${t.title} — ${t.artist}`); toast?.('Título copiado', Copy); } catch { /* sin permiso */ } };
  const chip = 'rounded-2xl px-3 py-3 bg-white/12 hover:bg-white/20 inline-flex items-center justify-center gap-2 text-[13px] font-semibold min-h-[48px]';
  return (
    <div className="absolute inset-0 z-50 flex flex-col" style={{ background: 'rgba(0,0,0,.78)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)', fontFamily: FONT, color: '#fff' }} role="dialog" aria-label="Opciones">
      <div className="flex items-center justify-between px-5 pt-[max(1rem,env(safe-area-inset-top))] pb-2 max-w-md w-full mx-auto">
        <p className="text-base font-bold truncate">{t.title}</p>
        <button className="w-11 h-11 grid place-items-center" onClick={onClose} aria-label="Cerrar"><X size={22} /></button>
      </div>
      <div className="px-5 pb-2 flex gap-2 max-w-md w-full mx-auto">
        {[['cola', 'Cola'], ['mas', 'Más']].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} className="flex-1 px-3 py-2.5 rounded-full text-xs font-semibold min-h-[44px]"
            style={tab === id ? { background: '#fff', color: '#000' } : { background: 'rgba(255,255,255,.15)' }}>{label}</button>
        ))}
      </div>
      {tab === 'mas' && (
        <div className="px-5 pb-6 max-w-md w-full mx-auto space-y-3 overflow-y-auto">
          <div className="grid grid-cols-2 gap-2">
            <button className={chip} onClick={() => p.toggleShuffle?.()} aria-pressed={p.shuffle ? 'true' : 'false'} style={p.shuffle ? { background: '#fff', color: '#000' } : undefined}><Shuffle size={15} /> Aleatorio{p.shuffle ? ' · on' : ''}</button>
            <button className={chip} onClick={() => p.cycleRepeat?.()} style={p.repeat !== 'off' ? { background: '#fff', color: '#000' } : undefined}>{p.repeat === 'one' ? <Repeat1 size={15} /> : <Repeat size={15} />} {p.repeat === 'one' ? 'Repite una' : p.repeat === 'all' ? 'Repite cola' : 'Repetir'}</button>
            <button className={chip} onClick={() => p.setRate?.(RATES[(RATES.indexOf(p.rate || 1) + 1) % RATES.length])}><Gauge size={15} /> Velocidad {p.rate || 1}x</button>
            <label className={`${chip} relative`}>
              <Timer size={15} />
              <select value={bits.sleepMin} onChange={(e) => bits.setSleepMin(+e.target.value)} className="bg-transparent outline-none appearance-none font-semibold" aria-label="Temporizador">
                {SLEEPS.map((m) => <option key={m} value={m} className="text-black">{m === 0 ? 'Temporizador' : `${m} min${bits.sleepMin === m ? ` (${fmtTime(bits.sleepLeft)})` : ''}`}</option>)}
              </select>
            </label>
            <button className={chip} onClick={revert} disabled={!canRevert} style={!canRevert ? { opacity: .4 } : undefined}><ImageIcon size={15} /> {t.artOriginal ? 'Carátula de YouTube' : 'Carátula original'}</button>
            <button className={chip} onClick={copy}><Copy size={15} /> Copiar título</button>
            {t.source === 'YouTube' && <button className={`${chip} col-span-2`} onClick={() => { p.swapToBg?.(true); onClose(); }}><Headphones size={15} /> Seguir en segundo plano</button>}
          </div>
          {bits.lines.length > 0 && (
            <div className="flex items-center justify-between rounded-2xl px-3 py-2 bg-white/10 text-[12px]">
              <span className="opacity-70">Sincronía de la letra</span>
              <span className="inline-flex items-center gap-2">
                <button className="px-3 py-2 rounded-full bg-white/15" onClick={() => bits.setLrcOffset((o) => Math.max(-5, +(o - 0.5).toFixed(1)))}>-0.5s</button>
                <span className="tabular-nums w-10 text-center">{bits.lrcOffset > 0 ? `+${bits.lrcOffset}` : bits.lrcOffset}s</span>
                <button className="px-3 py-2 rounded-full bg-white/15" onClick={() => bits.setLrcOffset((o) => Math.min(5, +(o + 0.5).toFixed(1)))}>+0.5s</button>
              </span>
            </div>
          )}
          <div>
            <p className="text-[11px] mb-1.5 opacity-60">Ecualizador {t.source === 'YouTube' ? '(no aplica a YouTube)' : ''}</p>
            <div className="flex gap-1.5 flex-wrap">
              {Object.keys(EQ_PRESETS).map((name) => (
                <button key={name} onClick={() => { p.applyEQ?.(name, EQ_PRESETS[name]); const el = p.audio?.current; if (el) setEQPreset(el, EQ_PRESETS[name]); }}
                  className="px-3 py-2 rounded-full text-[11px] font-semibold min-h-[40px]" style={{ background: p.eqPreset === name ? '#fff' : 'rgba(255,255,255,.14)', color: p.eqPreset === name ? '#000' : '#fff' }}>{name}</button>
              ))}
            </div>
          </div>
          {bits.lrc?.provider && <p className="text-[11px] text-center opacity-50">Letra vía {bits.lrc.provider}</p>}
        </div>
      )}
      {tab === 'cola' && (
        <div className="flex-1 overflow-y-auto px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] max-w-md w-full mx-auto">
          <div className="flex items-center justify-between my-2">
            <p className="text-[12px] opacity-70">Cola ({p.queue.length}){p.queueDuration ? ` · ${fmtTime(p.queueDuration())}` : ''}{p.radioBusy ? ' · buscando…' : ''}</p>
            <span className="flex gap-1">
              <button className="px-2.5 py-1.5 rounded-full bg-white/12 text-[11px] inline-flex items-center gap-1" onClick={() => p.dedupeQueue?.()}><Trash2 size={12} /> Duplicados</button>
              <button className="px-2.5 py-1.5 rounded-full bg-white/12 text-[11px]" onClick={() => p.clearQueue?.()}>Limpiar</button>
            </span>
          </div>
          {!p.queue.length && <p className="text-sm text-center py-6 opacity-70">Cola vacía — la radio automática seguirá sonando.</p>}
          {p.queue.map((q, i) => {
            const cur = i === p.index;
            return (
              <div key={`${q.id}-${i}`} draggable onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(i)); }}
                onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const from = +e.dataTransfer.getData('text/plain'); if (!Number.isNaN(from)) p.moveInQueue(from, i); }}
                className="flex items-center gap-2.5 py-1 rounded-xl" style={cur ? { background: 'rgba(255,255,255,.1)' } : undefined}>
                <button onClick={() => p.playAt(i)} className="w-11 h-11 rounded-lg overflow-hidden bg-white/10 shrink-0" aria-label={`Reproducir ${q.title}`}>{q.art && <img src={q.art} alt="" loading="lazy" referrerPolicy="no-referrer" className="w-full h-full object-cover" />}</button>
                <button onClick={() => p.playAt(i)} className="flex-1 min-w-0 text-left py-2 px-1">
                  <p className="text-[14px] font-semibold truncate">{q.title}</p>
                  <p className="text-[12px] truncate opacity-65">{q.artist}</p>
                </button>
                {cur ? <span className="w-11 h-11 grid place-items-center text-[10px] font-bold opacity-80">AHORA</span>
                  : <button onClick={() => p.removeAt(i)} aria-label={`Quitar ${q.title}`} className="w-11 h-11 grid place-items-center opacity-70"><X size={17} /></button>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export const CloseArrow = ({ onClick, size = 28 }) => (
  <button onClick={onClick} aria-label="Cerrar reproductor" className="w-11 h-11 grid place-items-center rounded-full active:scale-90 transition">
    <ChevronDown size={size} color="#fff" style={{ filter: 'drop-shadow(0 1px 6px rgba(0,0,0,.4))' }} />
  </button>
);
export { Loader2 };
