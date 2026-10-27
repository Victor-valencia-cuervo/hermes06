import { useEffect, useMemo, useRef, useState } from 'react';
import { Timer, Copy } from 'lucide-react';
import { attachAnalyser, setEQPreset } from '../../lib/analyser';
import { getLyrics, activeLineIndex } from '../../services/lyrics';

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

  // Sondeo de tiempo en vivo a alta frecuencia (100ms) para sincronía exacta de letra
  const [liveTime, setLiveTime] = useState(() => p.getCurrentTime?.() || p.time?.cur || 0);
  useEffect(() => {
    const update = () => {
      const cur = p.getCurrentTime?.();
      if (typeof cur === 'number' && !isNaN(cur)) {
        setLiveTime(cur);
      } else {
        setLiveTime(p.time?.cur || 0);
      }
    };
    update();
    if (!p.playing) return undefined;
    const iv = setInterval(update, 100);
    return () => clearInterval(iv);
  }, [p.playing, p.getCurrentTime, p.time?.cur, t?.id]);

  const lines = lrc?.lines || [];
  const effectiveTime = liveTime + lrcOffset;
  const activeIdx = useMemo(() => activeLineIndex(lines, effectiveTime), [lines, effectiveTime]);
  const hasLyrics = lrc?.state === 'ok' && (lines.length > 0 || !!lrc.plain);
  return { closing, onClose, sleepMin, setSleepMin, sleepLeft, lrc, lines, lrcOffset, setLrcOffset, activeIdx, tReal: effectiveTime, liveTime: effectiveTime, hasLyrics };
}

export async function shareTrack(t, toast) {
  const text = `${t.title}${t.artist ? ` — ${t.artist}` : ''}`;
  const url = t.videoId ? `https://youtu.be/${t.videoId}` : undefined;
  try {
    if (navigator.share) await navigator.share({ title: t.title, text, url });
    else { await navigator.clipboard.writeText(url ? `${text} ${url}` : text); toast?.('Enlace copiado', Copy); }
  } catch { /* cancelado */ }
}
