import { useEffect, useRef, useState } from 'react';
import { ledColor } from './color';
import { useAccent } from './useAccent';

/** Pantalla de puntos en un iframe aislado (los HTML de widgets/led). El color de la app y la configuración
 *  le llegan por postMessage; `extras` = mensajes sueltos (reacciones de la mascota, música sonando…). */
export default function LedFrame({ html, cfg, extra, extras, aspect = '148 / 78', title, interactive = true, frameRef, className = '', style }) {
  const own = useRef(null);
  const ref = frameRef || own;
  const [ready, setReady] = useState(false);
  const accent = useAccent();
  const color = ledColor(accent);
  const send = (msg) => { try { ref.current?.contentWindow?.postMessage({ __hw: 1, ...msg }, '*'); } catch { /* iframe aún no listo */ } };

  useEffect(() => {
    const on = (e) => { if (ref.current && e.source === ref.current.contentWindow && e.data?.__hw === 1 && e.data.k === 'ready') setReady(true); };
    window.addEventListener('message', on);
    return () => window.removeEventListener('message', on);
  }, [ref]);
  useEffect(() => { setReady(false); }, [html]);
  useEffect(() => { if (ready) send({ k: 'cfg', cfg, color, ...(extra || {}) }); }, [ready, JSON.stringify(cfg), color, JSON.stringify(extra)]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (ready && extras) Object.values(extras).forEach((m) => m && send(m)); }, [ready, JSON.stringify(extras)]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className={`relative w-full overflow-hidden bg-black ${className}`} style={{ aspectRatio: aspect, borderRadius: 24, ...style }}>
      <iframe ref={ref} title={title} srcDoc={html} sandbox="allow-scripts" loading="lazy"
        onLoad={() => send({ k: 'cfg', cfg, color, ...(extra || {}) })}
        className="absolute inset-0 w-full h-full border-0" style={{ pointerEvents: interactive ? 'auto' : 'none', colorScheme: 'dark' }} />
    </div>
  );
}
