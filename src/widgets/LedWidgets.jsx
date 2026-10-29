import { useEffect, useRef, useState } from 'react';
import useStore from '../hooks/useStore';
import { DEFAULT_PLACE } from '../services/weather';
import { WIDGETS } from './registry';
import LedFrame from './LedFrame';

// Caritas del día (react.face) → expresiones de la mascota de puntos.
const FACE2EX = { feliz: 'happy', enamorado: 'love', lentes: 'cool', guino: 'wink', neutral: 'neutral', pensando: 'talking', llanto: 'sad', sorpresa: 'surprised', dormido: 'sleepy', musica: 'dance', travieso: 'wink', diablito: 'cool', enojado: 'angry', risa: 'happy', mareado: 'dizzy', corazon: 'love', asustado: 'surprised' };
// Mientras suena música va pasando por varias caritas (no solo bailando).
const MUSIC_FACES = ['dance', 'happy', 'love', 'wink', 'cool', 'dance', 'talking', 'happy'];

// Qué hace la mascota según lo que pasa en la app (prioridad: aviso > toque > música > dormida > clima > automática).
function petState({ playing, idle = 0, hour = 12, react }, beat = 0) {
  if (react?.kind === 'alert') return { e: 'surprised', music: false };
  if (react?.kind === 'poke') return { e: FACE2EX[react.face] || 'happy', music: false };
  if (playing) return { e: MUSIC_FACES[beat % MUSIC_FACES.length], music: true };
  if (react?.kind === 'sleep' || idle >= 90 || (hour < 5 && idle >= 30)) return { e: 'sleepy', music: false };
  if (react?.kind === 'weather' && FACE2EX[react.face]) return { e: FACE2EX[react.face], music: false };
  return { e: null, music: false }; // null = automática: va cambiando de carita sola
}

/** Un widget de puntos (reloj, clima, zen, mascota, pantalla LED) ya conectado a la app: color, ubicación, unidad y música. */
export default function LedWidget({ item, ctx = {}, interactive = true }) {
  const def = WIDGETS[item.type];
  const [place] = useStore('h_place', DEFAULT_PLACE);
  const [unit] = useStore('h_unit', 'c');
  const frame = useRef(null);
  const [beat, setBeat] = useState(0);
  const musicOn = item.type === 'mascota' && !!ctx.playing;
  useEffect(() => { if (!musicOn) return undefined; const iv = setInterval(() => setBeat((b) => b + 1), 4500); return () => clearInterval(iv); }, [musicOn]);
  let cfg = item.cfg; let extra; let extras;

  if (item.type === 'clima') {
    cfg = { ...cfg, unit: cfg.unit === 'app' ? (unit === 'f' ? 'F' : 'C') : cfg.unit, place: { lat: place.lat, lon: place.lon, name: String(place.name || '').split(',')[0] } };
  } else if (item.type === 'pantalla') {
    extra = { playing: !!ctx.playing };
  } else if (item.type === 'mascota') {
    const s = petState(ctx, beat);
    extras = { state: { k: 'state', ...s } };
  }

  // La mascota sigue el puntero aunque esté fuera de su cuadro.
  useEffect(() => {
    if (item.type !== 'mascota') return undefined;
    let last = 0;
    const on = (e) => {
      const now = performance.now(); if (now - last < 60) return; last = now;
      const f = frame.current; const r = f?.getBoundingClientRect(); if (!r || !r.width) return;
      try { f.contentWindow?.postMessage({ __hw: 1, k: 'ptr', x: (e.clientX - (r.left + r.width / 2)) / r.width, y: (e.clientY - (r.top + r.height / 2)) / r.height }, '*'); } catch { /* sin iframe */ }
    };
    window.addEventListener('pointermove', on, { passive: true });
    return () => window.removeEventListener('pointermove', on);
  }, [item.type]);

  const led = (cls = 'w-full') => (
    <div className={cls}><LedFrame html={def.html} cfg={cfg} extra={extra} extras={extras} aspect={def.aspect} title={def.name} interactive={interactive} frameRef={frame} /></div>
  );
  if (item.type === 'mascota') return <PetCard tile={led(item.size === 2 ? 'w-40 sm:w-48 shrink-0' : 'w-[6.75rem] sm:w-28 shrink-0')} ctx={ctx} showText={cfg.text !== false} />;
  return (
    <div className={item.size === 2 && def.square ? 'max-w-[520px] mx-auto w-full' : 'w-full'}>
      <LedFrame html={def.html} cfg={cfg} extra={extra} extras={extras} aspect={def.aspect} title={def.name} interactive={interactive} frameRef={frame} />
    </div>
  );
}

/** La mascota pequeñita con su diálogo (saludos, música, clima) como la carita del día. */
function PetCard({ tile, ctx, showText }) {
  const say = ctx.react?.say || '¡Hola! Soy tu mascota de puntos.';
  const w = ctx.weather; const WI = w?.I;
  if (!showText) return <div className="flex justify-center">{tile}</div>;
  return (
    <div className="card !p-3 sm:!p-4 flex items-center gap-3.5 h-full">
      {tile}
      <div className="min-w-0 flex-1" aria-live="polite">
        <div className="relative rounded-2xl px-3.5 py-2.5" style={{ background: 'var(--s2)' }}>
          <span className="absolute top-1/2 -left-1 w-2.5 h-2.5 -translate-y-1/2 rotate-45" style={{ background: 'var(--s2)' }} aria-hidden="true" />
          <p className="serif text-[17px] leading-snug">{say}</p>
        </div>
        {w && (
          <p className="mt-2 flex items-center gap-1.5 text-xs flex-wrap" style={{ color: 'var(--m)' }}>
            {WI && <WI size={14} style={{ color: 'var(--a)' }} />}
            <b className="text-sm tabular-nums" style={{ color: 'var(--t)' }}>{w.temp}{w.sym || '°C'}</b>
            <span>{w.t} · {w.max}° / {w.min}°</span>
          </p>
        )}
      </div>
    </div>
  );
}
