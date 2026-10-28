import { useEffect, useRef } from 'react';
import useStore from '../hooks/useStore';
import { DEFAULT_PLACE } from '../services/weather';
import { WIDGETS } from './registry';
import LedFrame from './LedFrame';

// Qué hace la mascota según lo que pasa en la app (prioridad: aviso > música > dormida > automática).
function petState({ playing, idle = 0, hour = 12, react }) {
  if (react?.kind === 'alert') return { e: 'surprised', music: false };
  if (playing) return { e: 'dance', music: true };
  if (idle >= 90 || (hour < 5 && idle >= 30)) return { e: 'sleepy', music: false };
  return { e: null, music: false }; // null = automática: va cambiando de carita sola
}

/** Un widget de puntos (reloj, clima, zen, mascota, pantalla LED) ya conectado a la app: color, ubicación, unidad y música. */
export default function LedWidget({ item, ctx = {}, interactive = true }) {
  const def = WIDGETS[item.type];
  const [place] = useStore('h_place', DEFAULT_PLACE);
  const [unit] = useStore('h_unit', 'c');
  const frame = useRef(null);
  let cfg = item.cfg; let extra; let extras;

  if (item.type === 'clima') {
    cfg = { ...cfg, unit: cfg.unit === 'app' ? (unit === 'f' ? 'F' : 'C') : cfg.unit, place: { lat: place.lat, lon: place.lon, name: String(place.name || '').split(',')[0] } };
  } else if (item.type === 'pantalla') {
    extra = { playing: !!ctx.playing };
  } else if (item.type === 'mascota') {
    const s = petState(ctx);
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

  return (
    <div className={item.size === 2 && def.square ? 'max-w-[520px] mx-auto w-full' : 'w-full'}>
      <LedFrame html={def.html} cfg={cfg} extra={extra} extras={extras} aspect={def.aspect} title={def.name} interactive={interactive} frameRef={frame} />
    </div>
  );
}
