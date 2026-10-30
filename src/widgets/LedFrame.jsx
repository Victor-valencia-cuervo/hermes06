import { useEffect, useRef, useState } from 'react';
import { ledColor } from './color';
import { useAccent } from './useAccent';

/** Pantalla de puntos en un iframe aislado (los HTML de widgets/led). El color de la app y la configuración
 *  le llegan por postMessage; `extras` = mensajes sueltos (reacciones de la mascota, música sonando…). */
/** Tema actual de la app (data-theme del <html>), reactivo: los widgets de puntos lo usan para verse bien en claro y oscuro. */
function useTheme() {
  const get = () => (typeof document !== 'undefined' && document.documentElement.dataset.theme === 'light' ? 'light' : 'dark');
  const [th, setTh] = useState(get);
  useEffect(() => {
    const mo = new MutationObserver(() => setTh(get()));
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => mo.disconnect();
  }, []);
  return th;
}

export default function LedFrame({ html, cfg, extra, extras, aspect = '148 / 78', title, interactive = true, frameRef, className = '', style, transparent = false }) {
  const own = useRef(null);
  const ref = frameRef || own;
  const [ready, setReady] = useState(false);
  const accent = useAccent();
  const color = ledColor(accent);
  const theme = useTheme();
  const send = (msg) => { try { ref.current?.contentWindow?.postMessage({ __hw: 1, ...msg }, '*'); } catch { /* iframe aún no listo */ } };

  useEffect(() => {
    const on = (e) => {
      if (!ref.current || e.source !== ref.current.contentWindow || e.data?.__hw !== 1) return;
      if (e.data.k === 'ready') setReady(true);
      // El toque dentro del iframe se reenvía al inicio (para la pulsación larga de 5 s)
      if (e.data.k === 'ptrev') { const r = ref.current.getBoundingClientRect(); window.dispatchEvent(new CustomEvent('hermes:wpress', { detail: { t: e.data.t, x: r.left + e.data.x, y: r.top + e.data.y, el: ref.current } })); }
    };
    window.addEventListener('message', on);
    return () => window.removeEventListener('message', on);
  }, [ref]);
  useEffect(() => { setReady(false); }, [html]);
  useEffect(() => { if (ready) send({ k: 'cfg', cfg, color, ...(extra || {}) }); }, [ready, JSON.stringify(cfg), color, JSON.stringify(extra)]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (ready && extras) Object.values(extras).forEach((m) => m && send(m)); }, [ready, JSON.stringify(extras)]); // eslint-disable-line react-hooks/exhaustive-deps

  // Marco premium para las pantallas de puntos (negras): degradado con un toque del color de la app, borde fino de cristal,
  // brillo arriba y sombra suave. En modo transparente (la carita) no lleva fondo: se ve sobre la tarjeta, en claro y en oscuro.
  const frameStyle = transparent ? {} : {
    background: `radial-gradient(120% 90% at 12% 0%, ${color}26 0%, transparent 55%), linear-gradient(160deg, #111116 0%, #050507 100%)`,
    boxShadow: `inset 0 0 0 1px rgba(255,255,255,.09), inset 0 1px 0 rgba(255,255,255,.18), 0 18px 38px -20px rgba(0,0,0,.65), 0 0 34px -16px ${color}88`,
  };
  return (
    <div className={`relative w-full overflow-hidden ${className}`} style={{ aspectRatio: aspect, borderRadius: transparent ? 0 : 26, ...frameStyle, ...style }}>
      <iframe ref={ref} title={title} srcDoc={html} sandbox="allow-scripts" loading="lazy"
        onLoad={() => send({ k: 'cfg', cfg, color, theme, ...(extra || {}) })}
        className="absolute inset-0 w-full h-full border-0" style={{ pointerEvents: interactive ? 'auto' : 'none', colorScheme: transparent ? 'normal' : 'dark', background: 'transparent' }} />
      {!transparent && (
        <div aria-hidden="true" className="pointer-events-none absolute inset-0" style={{ borderRadius: 'inherit', mixBlendMode: 'screen', background: `linear-gradient(180deg, rgba(255,255,255,.10) 0%, rgba(255,255,255,0) 24%), radial-gradient(90% 60% at 100% 100%, ${color}24, transparent 62%)` }} />
      )}
    </div>
  );
}
