import { useEffect, useRef, useState } from 'react';
import { Music2, RotateCw } from 'lucide-react';
import { FONT, SERIF } from './ui';

/** Letra estilo Apple Music & Spotify con resaltado de alta precisión:
 *  - Palabra por palabra (word-sync) cuando la fuente lo incluye (TTML / enhanced LRC).
 *  - Relleno progresivo fluido en tiempo real cuando es sincronía por línea (LRC).
 *  - Indicador visual luminoso de posición exacta y seguimiento automático suave.
 *  - Tocar cualquier línea salta al instante a ese momento.
 *  - Tocar zona vacía muestra/oculta los controles inferiores.
 */
export default function LyricsPane({ p, bits, fontKey = 'apple', onEmptyTap, bottomPad = 24, fadePx = 0 }) {
  const box = useRef(null);
  const els = useRef([]);
  const userScroll = useRef(0);
  const [userBrowsing, setUserBrowsing] = useState(false);
  const { lrc, lines, activeIdx, effectiveTime = bits.tReal || 0 } = bits;
  const synced = lrc?.state === 'ok' && lines.length > 0;
  const serif = fontKey === 'hermes';
  const font = serif ? SERIF : FONT;
  const size = serif ? 'clamp(30px, 8.4vw, 42px)' : 'clamp(26px, 7.2vw, 36px)';

  // Sigue la letra: la línea actual queda suavemente centrada en el tercio superior (~32%)
  useEffect(() => {
    const el = box.current; const ln = els.current[activeIdx];
    if (!el || !ln || Date.now() < userScroll.current) return;
    el.scrollTo({ top: Math.max(0, ln.offsetTop - el.clientHeight * 0.32), behavior: 'smooth' });
  }, [activeIdx]);

  const pauseAutoScroll = () => {
    userScroll.current = Date.now() + 4000;
    setUserBrowsing(true);
    setTimeout(() => {
      if (Date.now() >= userScroll.current) setUserBrowsing(false);
    }, 4100);
  };

  const resumeSync = (e) => {
    e?.stopPropagation?.();
    userScroll.current = 0;
    setUserBrowsing(false);
    const el = box.current; const ln = els.current[activeIdx];
    if (el && ln) {
      el.scrollTo({ top: Math.max(0, ln.offsetTop - el.clientHeight * 0.32), behavior: 'smooth' });
    }
  };

  const tapBackground = (e) => {
    if (e.target.closest('[data-nohide],button,a,input')) return;
    onEmptyTap?.();
  };

  // Con los controles visibles, la letra se desvanece con elegancia antes de llegar a la barra
  const mask = fadePx
    ? `linear-gradient(180deg, transparent 0, #000 6%, #000 calc(100% - ${fadePx + 44}px), transparent calc(100% - ${fadePx - 6}px))`
    : 'linear-gradient(180deg, transparent 0, #000 6%, #000 94%, transparent 100%)';

  return (
    <div ref={box} onClick={tapBackground} onWheel={pauseAutoScroll} onTouchMove={pauseAutoScroll}
      className="fp-scroll absolute inset-0 overflow-y-auto px-6 select-none" aria-label="Letra"
      style={{ paddingTop: '1.2rem', paddingBottom: bottomPad, transition: 'padding-bottom .4s cubic-bezier(.32,.72,0,1)', maskImage: mask, WebkitMaskImage: mask, fontFamily: font }}>

      {(!lrc || lrc.state === 'loading') && (
        <div className="pt-20 text-center text-white" role="status">
          <div className="flex justify-center gap-2 mb-4" aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <Music2 key={i} size={22} style={{ animation: `fpEq 1.2s ease-in-out ${i * 0.2}s infinite` }} />
            ))}
          </div>
          <p className="text-[24px] font-bold">Buscando la letra…</p>
          <p className="text-sm text-white/60 mt-1">Sincronizando con la música.</p>
        </div>
      )}

      {(lrc?.state === 'empty' || (lrc?.state === 'ok' && !lines.length && !lrc.plain)) && (
        <div className="pt-20 text-center text-white">
          <Music2 size={34} className="mx-auto mb-4 opacity-80" />
          <p className="text-[24px] font-bold leading-snug">Esta canción aún no tiene letra</p>
          <p className="text-sm text-white/60 mt-2">La música sigue sonando. Si la encontramos, aparecerá aquí.</p>
        </div>
      )}

      {synced && lines.map((l, i) => {
        const on = i === activeIdx;
        const d = activeIdx < 0 ? 2 : Math.min(6, Math.abs(i - activeIdx));
        const hasWords = l.words && l.words.length > 0;

        // Progreso continuo de la línea cuando no hay marcas individuales por palabra
        let lineProg = 0;
        if (on && !hasWords) {
          const nextT = lines[i + 1]?.t ?? ((l.t ?? 0) + 4.5);
          const dur = Math.max(0.6, nextT - (l.t ?? 0));
          lineProg = Math.min(100, Math.max(0, ((effectiveTime - (l.t ?? 0)) / dur) * 100));
        }

        return (
          <p key={i} ref={(el) => { els.current[i] = el; }} data-nohide="1" role="button" tabIndex={0}
            aria-current={on ? 'true' : undefined}
            aria-label={`${l.x || 'Instrumental'}. Saltar a este momento`}
            onClick={(e) => { e.stopPropagation(); p.seek(Math.max(0, (l.t ?? 0) - bits.lrcOffset - 0.15)); }}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); p.seek(Math.max(0, (l.t ?? 0) - bits.lrcOffset - 0.15)); } }}
            className={`fp-lyric relative cursor-pointer origin-left leading-[1.2] outline-none transition-all duration-300 ${on ? 'py-2.5 my-1.5' : 'py-1'}`}
            style={{
              fontSize: size,
              fontWeight: serif ? (on ? 700 : 600) : (on ? 800 : 700),
              color: on ? '#fff' : 'rgba(255,255,255,0.42)',
              opacity: on ? 1 : Math.max(0.18, 0.44 - d * 0.05),
              filter: on ? 'none' : `blur(${Math.min(2.2, d * 0.55)}px)`,
              transform: on ? 'scale(1.02)' : 'scale(.97)',
            }}>

            {/* Indicador luminoso en la línea activa */}
            {on && (
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-white shadow-[0_0_12px_#fff] mr-3 -translate-y-0.5 align-middle shrink-0 animate-pulse" aria-hidden="true" />
            )}

            {/* Sincronización palabra por palabra si está disponible */}
            {on && hasWords ? (
              <span>
                {l.words.map((w, wi) => {
                  const sung = effectiveTime >= w.t;
                  return (
                    <span key={wi} className="inline-block mr-[0.22em] transition-all duration-150"
                      style={{
                        color: sung ? '#ffffff' : 'rgba(255,255,255,0.4)',
                        textShadow: sung ? '0 0 16px rgba(255,255,255,0.7)' : 'none',
                        fontWeight: sung ? 800 : 600,
                        transform: sung ? 'scale(1.03)' : 'scale(1)',
                      }}>
                      {w.x}
                    </span>
                  );
                })}
              </span>
            ) : on ? (
              /* Sincronización de línea fluida con gradiente activo que sigue el canto */
              <span style={{
                background: `linear-gradient(90deg, #ffffff ${lineProg.toFixed(1)}%, rgba(255,255,255,0.38) ${Math.min(100, lineProg + 6).toFixed(1)}%)`,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                textShadow: '0 0 18px rgba(255,255,255,0.35)',
              }}>
                {l.x || '♪'}
              </span>
            ) : (
              <span>{l.x || '♪'}</span>
            )}
          </p>
        );
      })}

      {lrc?.state === 'ok' && !synced && !!lrc.plain && (
        <div className="pb-4">
          <p className="mb-3 text-[12px] font-semibold uppercase tracking-wide text-white/55">Letra sin sincronizar</p>
          <p className="whitespace-pre-line text-white/90" data-nohide="1" style={{ fontSize: serif ? 26 : 22, fontWeight: serif ? 600 : 600, lineHeight: 1.4 }}>{lrc.plain}</p>
        </div>
      )}

      {lrc?.provider && lrc.state === 'ok' && (
        <p className="mt-8 mb-2 text-[11px] text-white/40" style={{ fontFamily: 'system-ui' }}>
          Letra vía {lrc.provider}{lrc.wordSync ? ' · Sincronizada palabra por palabra' : ' · Sincronizada'}
        </p>
      )}

      {/* Botón flotante para reanudar el seguimiento automático si el usuario se desplazó */}
      {userBrowsing && synced && (
        <button onClick={resumeSync}
          className="fixed bottom-28 right-6 z-40 inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold bg-white/20 hover:bg-white/30 text-white backdrop-blur shadow-lg active:scale-95 transition-all">
          <RotateCw size={13} className="animate-spin" />
          Sincronizar
        </button>
      )}
    </div>
  );
}
