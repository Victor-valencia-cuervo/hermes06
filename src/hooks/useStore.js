import { useState, useEffect, useRef } from 'react';

// Guarda en localStorage con un pequeño retraso: antes cada cambio (la cola con 40 temas,
// el progreso, etc.) serializaba y escribía al instante, lo que en celulares lentos congelaba
// la apertura de canciones. Se vacía siempre al ocultar/cerrar la página para no perder nada.
export default function useStore(key, initial) {
  const [v, setV] = useState(() => { try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : initial; } catch { return initial; } });
  const latest = useRef(v); latest.current = v;
  const dirty = useRef(false);
  const write = () => {
    if (!dirty.current) return;
    dirty.current = false;
    try { localStorage.setItem(key, JSON.stringify(latest.current)); } catch { /* storage lleno o bloqueado */ }
  };
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return undefined; }
    dirty.current = true;
    const t = setTimeout(write, 300);
    return () => clearTimeout(t);
  }, [key, v]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const flush = () => write();
    const vis = () => { if (document.hidden) write(); };
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', vis);
    return () => { window.removeEventListener('pagehide', flush); document.removeEventListener('visibilitychange', vis); write(); };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return [v, setV];
}
