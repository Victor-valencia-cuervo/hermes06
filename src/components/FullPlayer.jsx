import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, Music2 } from 'lucide-react';
import { StatusBar } from '@capacitor/status-bar';
import { Capacitor } from '@capacitor/core';
import useArtColors from '../hooks/useArtColors';
import useStore from '../hooks/useStore';
import { usePlayerBits } from './fullplayer/bits';
import { Backdrop, FP_CSS, FONT, useMedia, useReducedMotion, Sheet } from './fullplayer/ui';
import { Progress, Transport, VolumeRow, Toolbar, MetaRow } from './fullplayer/Controls';
import LyricsPane from './fullplayer/LyricsPane';
import QueuePane from './fullplayer/QueuePane';
import MoreSheet from './fullplayer/MoreSheet';
import CoverPicker from './fullplayer/CoverPicker';
import ClipLayer from './ClipLayer';

// Reproductor completo estilo Apple Music con dos presentaciones:
//   Tema 1 («apple-1»): carátula inmersiva a pantalla completa que se funde con el fondo.
//   Tema 2 («apple-2»): carátula en un cuadro redondeado.
// Mismas funciones en ambos. Vistas: reproductor · letra · cola. En letra y cola, tocar una zona
// vacía oculta/muestra los controles. Una sola instancia de audio: cambiar de vista no la toca.
const EASE = 'cubic-bezier(.32,.72,0,1)';
const SAFE_TOP = 'max(env(safe-area-inset-top, 0px), 8px)';

export default function FullPlayer({ p, toast, theme = 'apple-1', setTheme, onClose: onCloseProp }) {
  const t = p.track;
  const nav = useNavigate();
  const bits = usePlayerBits(p, toast, onCloseProp);
  const colors = useArtColors(t?.art);
  const wide = useMedia('(min-width: 1024px)');
  const reduced = useReducedMotion();
  const [lyFont] = useStore('h_lyrics_font', 'apple');
  const [clips] = useStore('h_clips', true); // clips de video de la canción (Ajustes)
  const [view, setView] = useState('player'); // móvil/tableta: player | lyrics | queue
  const [side, setSide] = useState('lyrics'); // escritorio: panel derecho
  const [hidden, setHidden] = useState(false); // controles ocultos (solo letra/cola)
  const [sheet, setSheet] = useState(null); // 'more' | 'cover'
  const [bh, setBh] = useState(300);
  const blockRef = useRef(null);
  const colRef = useRef(null);
  const [col, setCol] = useState({ w: 390, h: 800 }); // tamaño real de la columna (para el cuadrado del Tema 2)
  const T1 = theme !== 'apple-2';
  const dur = p.time?.dur || t?.duration || 0;

  // Inmersivo: al abrir el full player oculta la barra de estado del celular (hora, batería, wifi).
  // Al salir o cerrar, la restaura automáticamente.
  useEffect(() => {
    try {
      if (Capacitor.isPluginAvailable('StatusBar')) {
        StatusBar.hide().catch(() => {});
      }
    } catch {}
    return () => {
      try {
        if (Capacitor.isPluginAvailable('StatusBar')) {
          StatusBar.show().catch(() => {});
        }
      } catch {}
    };
  }, []);

  // Al iniciar la animación de cierre, restauramos la barra para una transición suave
  useEffect(() => {
    if (bits.closing) {
      try {
        if (Capacitor.isPluginAvailable('StatusBar')) {
          StatusBar.show().catch(() => {});
        }
      } catch {}
    }
  }, [bits.closing]);

  useEffect(() => { setHidden(false); }, [view]);
  // Altura real del bloque de controles: la letra/cola deja ese espacio libre abajo.
  useEffect(() => {
    const el = blockRef.current; if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(() => setBh(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, [wide]);

  useEffect(() => {
    const el = colRef.current; if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(() => setCol({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el); setCol({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, [wide]);

  const goView = (v) => setView((cur) => (cur === v ? 'player' : v));
  const goArtist = () => {
    const a = String(t.artist || '').replace(/\s*-\s*topic\s*$/i, '').trim();
    if (!a) return;
    bits.onClose();
    nav(`/musica/resultados?q=${encodeURIComponent(a)}`);
  };
  const openMore = () => setSheet('more');

  // Deslizar hacia abajo para cerrar (zona del asa y de la carátula).
  const sw = useRef(null);
  const [dy, setDy] = useState(0);
  const swipe = {
    onTouchStart: (e) => { sw.current = { y: e.touches[0].clientY, x: e.touches[0].clientX }; },
    onTouchMove: (e) => { if (!sw.current) return; const d = e.touches[0].clientY - sw.current.y; if (d > 0 && Math.abs(e.touches[0].clientX - sw.current.x) < 60) setDy(Math.min(d, 260)); },
    onTouchEnd: () => { if (dy > 110) bits.onClose(); setDy(0); sw.current = null; },
  };

  if (!t) return null;
  const rootStyle = {
    fontFamily: FONT, color: '#fff',
    transform: bits.closing ? 'translateY(100%)' : dy ? `translateY(${dy}px)` : 'none',
    transition: dy ? 'none' : `transform .3s ${EASE}`,
    borderRadius: dy || bits.closing ? '24px 24px 0 0' : 0,
  };

  // ============ ESCRITORIO: carátula + controles a la izquierda, letra/cola a la derecha ============
  if (wide) {
    const cs = T1 ? 'min(52vh, 34vw)' : 'min(44vh, 30vw)';
    return (
      <div className={`fp-root fixed inset-0 z-40 overflow-hidden ${reduced ? 'fp-rm' : ''}`} style={rootStyle} role="dialog" aria-label="Reproductor completo">
        <style>{FP_CSS}</style>
        <Backdrop art={t.art} colors={colors} reduced={reduced} />
        <button onClick={bits.onClose} aria-label="Cerrar el reproductor" className="absolute top-5 left-6 z-20 w-11 h-11 rounded-full grid place-items-center active:scale-90 transition hover:bg-white/20" style={{ background: 'rgba(255,255,255,.14)' }}><ChevronDown size={24} /></button>
        <div className="absolute inset-0 flex gap-10 px-12 py-8">
          <div className="flex-1 min-w-0 flex flex-col items-center justify-center gap-6 max-w-[640px] mx-auto">
            <div style={{ width: cs, height: cs, borderRadius: T1 ? 22 : 16, overflow: 'hidden', boxShadow: T1 ? '0 30px 90px rgba(0,0,0,.55), 0 0 120px -10px rgba(255,255,255,.12)' : '0 24px 60px rgba(0,0,0,.45)', background: 'rgba(255,255,255,.1)', transition: `box-shadow .5s ${EASE}` }}>
              {t.art ? <img key={t.art} src={t.art} alt={`Carátula de ${t.title}`} referrerPolicy="no-referrer" className="w-full h-full object-cover" style={{ animation: reduced ? 'none' : (p.playing ? 'fpFade .6s ease both, fpKb 32s ease-in-out .6s infinite alternate' : 'fpFade .6s ease both') }} /> : <div className="w-full h-full grid place-items-center"><Music2 size={48} className="text-white/60" /></div>}
              <ClipLayer track={t} playing={p.playing} getTime={() => p.getCurrentTime?.() || p.time?.cur || 0} enabled={clips} />
            </div>
            <div className="w-full max-w-[520px] space-y-5">
              <MetaRow p={p} onMore={openMore} onArtist={goArtist} />
              <Progress p={p} bits={bits} dur={dur} />
              <Transport p={p} />
              <VolumeRow p={p} />
            </div>
          </div>
          <div className="w-[44%] max-w-[560px] min-w-[340px] my-8 rounded-[28px] overflow-hidden flex flex-col" style={{ background: 'rgba(0,0,0,.22)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', border: '1px solid rgba(255,255,255,.1)' }}>
            <div className="flex gap-2 p-3 shrink-0" role="tablist">
              {[['lyrics', 'Letra'], ['queue', 'Cola']].map(([id, label]) => (
                <button key={id} role="tab" aria-selected={side === id} onClick={() => setSide(id)} className="px-5 min-h-[40px] rounded-full text-[14px] font-semibold transition" style={side === id ? { background: '#fff', color: '#111' } : { background: 'rgba(255,255,255,.14)' }}>{label}</button>
              ))}
            </div>
            <div className="relative flex-1 min-h-0">
              {side === 'lyrics'
                ? <LyricsPane p={p} bits={bits} fontKey={lyFont} bottomPad={40} />
                : <QueuePane p={p} toast={toast} bottomPad={40} />}
            </div>
          </div>
        </div>
        {sheet === 'more' && <MoreSheet p={p} toast={toast} bits={bits} theme={theme} setTheme={setTheme} onClose={() => setSheet(null)} onQueue={() => setSide('queue')} onCover={() => setSheet('cover')} onCloseAll={bits.onClose} />}
        {sheet === 'cover' && <CoverPicker p={p} toast={toast} onClose={() => setSheet(null)} />}
      </div>
    );
  }

  // ============ MÓVIL / TABLETA ============
  // Con la barra de estado oculta, el reproductor aprovecha la pantalla completa en ambos temas
  const cw = Math.round(Math.max(160, Math.min(col.w - 40, col.h - bh - 60))); // lado del cuadro (Tema 2): más grande y aprovechado
  const inPlayer = view === 'player';
  const mini = !inPlayer;
  const coverStyle = mini
    ? { left: 20, top: `calc(${SAFE_TOP} + 14px)`, width: 46, height: 46, borderRadius: 8, '--fade': '0%', boxShadow: '0 4px 14px rgba(0,0,0,.35)' }
    : T1
      ? { left: 0, top: 0, width: '100%', height: 'min(62dvh, 720px)', borderRadius: 0, '--fade': '34%', boxShadow: 'none' }
      : { left: `calc(50% - ${cw / 2}px)`, top: `calc(${SAFE_TOP} + 28px + ${Math.max(0, (col.h - bh - 36 - cw) / 2)}px)`, width: cw, height: cw, borderRadius: 20, '--fade': '0%', boxShadow: '0 24px 60px rgba(0,0,0,.45)' };
  const tr = reduced ? 'none' : `left .55s ${EASE}, top .55s ${EASE}, width .55s ${EASE}, height .55s ${EASE}, border-radius .55s ${EASE}, --fade .55s ${EASE}, box-shadow .55s`;
  const maskV = 'linear-gradient(#000 calc(100% - var(--fade)), transparent 100%)';
  const controlsHidden = mini && hidden;

  return (
    <div className={`fp-root fixed inset-0 z-40 overflow-hidden ${reduced ? 'fp-rm' : ''}`} style={rootStyle} role="dialog" aria-label="Reproductor completo">
      <style>{FP_CSS}</style>
      <Backdrop art={t.art} colors={colors} reduced={reduced} />
      {/* Degradado de lectura bajo los controles: de borde a borde (no se corta en tabletas) */}
      <div aria-hidden="true" className="absolute inset-x-0 bottom-0 pointer-events-none" style={{ height: bh + 70, opacity: controlsHidden ? 0 : 1, transition: reduced ? 'none' : 'opacity .35s', background: 'linear-gradient(180deg, transparent, rgba(0,0,0,.3) 45%)' }} />
      <div ref={colRef} className="absolute inset-0 mx-auto w-full max-w-[560px]">
        {/* Asa: tocar o deslizar cierra */}
        <div className="absolute top-0 inset-x-0 z-30 h-9 grid place-items-center touch-none" style={{ paddingTop: SAFE_TOP }} {...swipe}>
          <button onClick={bits.onClose} aria-label="Cerrar el reproductor" className="w-12 h-6 grid place-items-center"><span className="block w-10 h-[5px] rounded-full" style={{ background: 'rgba(255,255,255,.5)' }} /></button>
        </div>

        {/* Carátula única: se achica y sube al abrir letra/cola; tocarla (en mini) vuelve al reproductor */}
        <div className="absolute z-20 overflow-hidden" style={{ ...coverStyle, transition: tr, WebkitMaskImage: maskV, maskImage: maskV, background: 'rgba(255,255,255,.1)' }} {...(inPlayer ? swipe : {})}>
          {mini
            ? <button onClick={() => setView('player')} aria-label="Volver al reproductor completo" className="block w-full h-full">{t.art ? <img src={t.art} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" /> : <Music2 className="m-auto" />}</button>
            : (t.art ? <img key={t.art} src={t.art} alt={`Carátula de ${t.title}`} referrerPolicy="no-referrer" draggable={false} className="w-full h-full object-cover" style={{ objectPosition: T1 ? 'center 30%' : 'center', animation: reduced ? 'none' : (p.playing ? 'fpFade .6s ease both, fpKb 32s ease-in-out .6s infinite alternate' : 'fpFade .6s ease both') }} /> : <div className="w-full h-full grid place-items-center"><Music2 size={48} className="text-white/60" /></div>)}
        {inPlayer && <ClipLayer track={t} playing={p.playing} getTime={() => p.getCurrentTime?.() || p.time?.cur || 0} enabled={clips} />}
        </div>

        {/* Cabecera compacta (letra/cola): siempre visible aunque se oculten los controles */}
        <div className="absolute z-30 flex items-center" style={{ left: 78, right: 16, top: `calc(${SAFE_TOP} + 14px)`, height: 46, opacity: mini ? 1 : 0, pointerEvents: mini ? 'auto' : 'none', transform: mini ? 'none' : 'translateY(-6px)', transition: reduced ? 'none' : `opacity .35s, transform .45s ${EASE}` }} aria-hidden={!mini}>
          <div className="w-full"><MetaRow p={p} onMore={openMore} onArtist={goArtist} compact /></div>
        </div>

        {/* Contenido de letra / cola con mayor altura disponible */}
        {mini && (
          <div key={view} className="absolute inset-x-0 bottom-0" style={{ top: `calc(${SAFE_TOP} + 68px)`, animation: reduced ? 'none' : 'fpUp .45s ease both' }}>
            {view === 'lyrics'
              ? <LyricsPane p={p} bits={bits} fontKey={lyFont} onEmptyTap={() => setHidden((h) => !h)} bottomPad={controlsHidden ? 56 : bh + 16} fadePx={controlsHidden ? 0 : bh} />
              : <QueuePane p={p} toast={toast} onEmptyTap={() => setHidden((h) => !h)} bottomPad={controlsHidden ? 56 : bh + 16} fadePx={controlsHidden ? 0 : bh} />}
          </div>
        )}

        {/* Bloque inferior: título (solo en el reproductor) + progreso + transporte + volumen + barra */}
        <div ref={blockRef} className="absolute inset-x-0 bottom-0 z-30 px-6"
          style={{ paddingBottom: 'calc(max(env(safe-area-inset-bottom, 0px), 14px) + 22px)', paddingTop: 10, transform: controlsHidden ? 'translateY(105%)' : 'none', opacity: controlsHidden ? 0 : 1, pointerEvents: controlsHidden ? 'none' : 'auto', transition: reduced ? 'none' : `transform .45s ${EASE}, opacity .3s`}}
          aria-hidden={controlsHidden}>
          <div style={{ maxHeight: inPlayer ? 90 : 0, opacity: inPlayer ? 1 : 0, overflow: 'hidden', transition: reduced ? 'none' : `max-height .45s ${EASE}, opacity .3s`, marginBottom: inPlayer ? 14 : 0 }} aria-hidden={!inPlayer}>
            <MetaRow p={p} onMore={openMore} onArtist={goArtist} />
          </div>
          <Progress p={p} bits={bits} dur={dur} />
          <div className="my-0.5"><Transport p={p} /></div>
          <div className="mb-2"><VolumeRow p={p} /></div>
          <Toolbar view={view} onView={goView} p={p} toast={toast} />
        </div>

        {/* Pista para recuperar los controles cuando están ocultos */}
        {controlsHidden && (
          <button onClick={() => setHidden(false)} aria-label="Mostrar los controles" className="absolute z-30 left-1/2 -translate-x-1/2 bottom-[max(env(safe-area-inset-bottom,0px),10px)] w-16 h-8 grid place-items-center"><span className="block w-10 h-[5px] rounded-full" style={{ background: 'rgba(255,255,255,.45)' }} /></button>
        )}
      </div>

      {sheet === 'more' && <MoreSheet p={p} toast={toast} bits={bits} theme={theme} setTheme={setTheme} onClose={() => setSheet(null)} onQueue={() => setView('queue')} onCover={() => setSheet('cover')} onCloseAll={bits.onClose} />}
      {sheet === 'cover' && <CoverPicker p={p} toast={toast} onClose={() => setSheet(null)} />}
    </div>
  );
}
