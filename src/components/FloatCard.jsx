import { useEffect, useRef, useState } from 'react';
import styled from 'styled-components';
import { Play, Pause, SkipBack, SkipForward, Heart, Volume2, VolumeX, X, Loader2, Minus } from 'lucide-react';

/* Tarjeta flotante estilo Spotify: arrastrable, se queda donde la dejas,
   X para ocultarla hasta el próximo play, color del tema + chip MÚSICA/RADIO. */

const StyledWrapper = styled.div`
  position: fixed;
  z-index: 30;
  left: ${(p) => (p.$pos ? `${p.$pos.x}px` : '12px')};
  top: ${(p) => (p.$pos ? `${p.$pos.y}px` : 'auto')};
  bottom: ${(p) => (p.$pos ? 'auto' : p.$defaultBottom)};
  touch-action: pinch-zoom;
  user-select: none;

  .card {
    position: relative; width: 300px; padding: 12px 14px 10px;
    background: #141416; border-radius: 22px; color: #fff;
    border: 1px solid rgba(255,255,255,.08);
    box-shadow: 0 18px 40px -12px rgba(0,0,0,.6);
    cursor: grab; display: flex; flex-direction: column; gap: 8px;
  }
  .card.dragging { cursor: grabbing; }
  .card.dragging * { pointer-events: none; }
  .bgwrap { position: absolute; inset: 0; border-radius: inherit; overflow: hidden; pointer-events: none; }
  .bgwrap img { width: 100%; height: 100%; object-fit: cover; filter: blur(28px) saturate(1.5); transform: scale(1.4); opacity: .32; }
  .bgwrap::after { content: ''; position: absolute; inset: 0; background: linear-gradient(180deg, rgba(20,20,22,.2), rgba(20,20,22,.78)); }
  .top, .prog, .controls { position: relative; z-index: 1; }

  .top { display: flex; align-items: center; gap: 12px; padding-right: 84px; }
  .pfp {
    position: relative; height: 52px; width: 52px; min-width: 52px;
    background-color: #2a2a2a; border-radius: 14px; overflow: hidden;
    border: none; padding: 0; cursor: pointer;
    display: flex; justify-content: center; align-items: center;
    box-shadow: 0 6px 16px -6px rgba(0,0,0,.7);
  }
  .pfp img { width: 100%; height: 100%; object-fit: cover; }
  .pfp .eqveil { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,.4); }

  .texts { flex: 1; min-width: 0; }
  .texts .kind { margin-bottom: 5px; }
  .title-1 { color: #fff; font-size: 17px; font-weight: 700; line-height: 1.15; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .title-2 { color: rgba(255,255,255,.68); font-size: 14px; font-weight: 500; margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .kind {
    display: inline-flex; align-items: center; font-size: 9px; font-weight: 800; letter-spacing: .14em;
    color: ${(p) => p.$accent}; border: 1px solid color-mix(in srgb, ${(p) => p.$accent} 60%, transparent);
    border-radius: 99px; padding: 2px 7px; line-height: 1;
  }
  .kind .dot { display: inline-block; width: 5px; height: 5px; border-radius: 99px; background: ${(p) => p.$accent}; margin-right: 5px; }
  .kind .dot.pulse { animation: kindpulse 1.2s ease-in-out infinite; }
  @keyframes kindpulse { 0%,100% { opacity: 1; } 50% { opacity: .25; } }

  .corner { position: absolute; top: 8px; right: 8px; display: flex; gap: 2px; z-index: 2; }
  .corner button { background: none; border: none; color: rgba(255,255,255,.7); cursor: pointer; min-width: 36px; min-height: 36px; padding: 8px; border-radius: 10px; display: grid; place-items: center; }
  .corner button:hover { color: ${(p) => p.$accent}; background: rgba(255,255,255,.08); }
  .corner button:focus-visible, .controls button:focus-visible, .pfp:focus-visible { outline: 2px solid ${(p) => p.$accent}; outline-offset: 2px; }

  .prog { display: flex; align-items: center; gap: 8px; }
  .timetext { color: rgba(255,255,255,.7); font-size: 12px; font-variant-numeric: tabular-nums; min-width: 32px; }
  .prog .timetext:last-child { text-align: right; }
  /* Visual intacto (5px); la zona táctil crece con aire invisible arriba/abajo */
  .time { position: relative; flex: 1; background-color: rgba(255,255,255,.2); height: 5px; border-radius: 3px; cursor: pointer; touch-action: none; }
  .time::before { content: ''; position: absolute; left: 0; right: 0; top: -14px; bottom: -14px; }
  .time.live { cursor: default; }
  .elapsed { height: 100%; border-radius: 3px; background-color: ${(p) => p.$accent}; }
  .elapsed.indet { width: 35% !important; animation: liveslide 1.6s ease-in-out infinite; }
  @keyframes liveslide { 0% { margin-left: -35%; } 100% { margin-left: 100%; } }

  .controls { display: flex; align-items: center; justify-content: space-between; padding: 0 2px; }
  .controls button { background: none; border: none; color: #fff; cursor: pointer; min-width: 44px; min-height: 44px; padding: 10px; border-radius: 12px; display: grid; place-items: center; transition: color .15s, transform .15s, background .15s; }
  .controls button:hover { color: ${(p) => p.$accent}; background: rgba(255,255,255,.06); }
  .controls button:active { transform: scale(.92); }
  .controls button:disabled { opacity: .45; cursor: default; }
  .controls .mainbtn { width: 52px; height: 52px; border-radius: 99px; background: ${(p) => p.$accent}; color: #fff; box-shadow: 0 6px 18px -4px ${(p) => p.$accent}; }
  .controls .mainbtn:hover { color: #fff; transform: scale(1.05); background: ${(p) => p.$accent}; }
  @media (prefers-reduced-motion: reduce) {
    .kind .dot.pulse, .playing.on .greenline, .elapsed.indet { animation: none !important; }
  }
  .fav-on { color: ${(p) => p.$accent} !important; }

  .volwrap { position: relative; display: flex; align-items: center; }
  .volume { position: absolute; left: -6px; bottom: calc(100% + 8px); padding: 10px 12px; border-radius: 12px; background: #202024; border: 1px solid rgba(255,255,255,.1); opacity: 0; pointer-events: none; transform: translateY(4px); transition: opacity .18s, transform .18s; }
  .volume.open { opacity: 1; pointer-events: auto; transform: none; }
  .volume input { width: 96px; height: 4px; accent-color: ${(p) => p.$accent}; cursor: pointer; display: block; }
  .live-tag { color: #ff6b6b; font-weight: 800; letter-spacing: .08em; }

  .playing { display: flex; position: relative; justify-content: center; gap: 1px; width: 30px; height: 20px; }
  .greenline {
    background-color: ${(p) => p.$accent};
    height: 20px; width: 2px; position: relative; transform-origin: bottom;
    transform: scaleY(0.1);
  }
  .playing.on .greenline { animation: infinite playing 1s ease-in-out; }
  .playing.on .line-1 { animation-delay: 0.2s; }
  .playing.on .line-2 { animation-delay: 0.5s; }
  .playing.on .line-3 { animation-delay: 0.6s; }
  .playing.on .line-4 { animation-delay: 0s; }
  .playing.on .line-5 { animation-delay: 0.4s; }
  @keyframes playing {
    0% { transform: scaleY(0.1); }
    33% { transform: scaleY(0.6); }
    66% { transform: scaleY(0.9); }
    100% { transform: scaleY(0.1); }
  }

  .queuepop {
    position: absolute; bottom: calc(100% + 8px); right: 0;
    width: 300px; max-height: min(320px, 52dvh); overflow-y: auto; overscroll-behavior: contain;
    background: var(--s); border: 1px solid var(--bd); border-radius: 14px;
    padding: 8px; color: var(--t); cursor: default;
    box-shadow: 0 -12px 32px rgba(0,0,0,.35);
  }

  .cardbanner {
    width: 300px; margin-bottom: 8px; cursor: default;
  }

  .card-in { animation: cardin .28s ease-out; }
  .card-out { animation: cardout .2s ease-in forwards; }
  @keyframes cardin { from { opacity: 0; transform: translateY(16px) scale(.96); } to { opacity: 1; transform: none; } }
  @keyframes cardout { to { opacity: 0; transform: translateY(16px) scale(.95); } }

  @media (max-width: 640px) {
    .card { width: min(300px, calc(100vw - 24px)); }
    .queuepop, .cardbanner { width: min(300px, calc(100vw - 24px)); }
  }
`;

function clampPos(x, y) {
  const w = typeof window !== 'undefined' ? window.innerWidth : 400;
  const h = typeof window !== 'undefined' ? window.innerHeight : 800;
  const cw = Math.min(300, w - 24);
  const ch = 150;
  return {
    x: Math.min(Math.max(0, x), Math.max(0, w - cw)),
    y: Math.min(Math.max(0, y), Math.max(0, h - ch)),
  };
}

// La posición se guarda en px Y como fracción de la pantalla: si recargas con otra
// altura (barra del navegador, giro del celular) la tarjeta queda en el mismo sitio relativo.
function posFromFrac(fx, fy) {
  const w = typeof window !== 'undefined' ? window.innerWidth : 400;
  const h = typeof window !== 'undefined' ? window.innerHeight : 800;
  const cw = Math.min(300, w - 24);
  return clampPos(fx * Math.max(0, w - cw), fy * Math.max(0, h - 150));
}
function toSaved(p) {
  const w = window.innerWidth; const h = window.innerHeight; const cw = Math.min(300, w - 24);
  return { x: p.x, y: p.y, fx: w - cw > 0 ? p.x / (w - cw) : 0, fy: h - 150 > 0 ? p.y / (h - 150) : 0 };
}
function loadPos(key) {
  try {
    const s = JSON.parse(localStorage.getItem(key));
    if (s && typeof s.fx === 'number' && typeof s.fy === 'number') return posFromFrac(s.fx, s.fy);
    if (s && typeof s.x === 'number' && typeof s.y === 'number') return clampPos(s.x, s.y);
  } catch { /* sin posición */ }
  return null;
}

/**
 * Props: accent, kind, art, title, sub, statusText, playing, loading,
 * onToggle, onPrev, onNext, fav, onFav, volume, muted, onVolume, onMute,
 * progress {cur,dur} | null (null = en vivo), onSeek(frac), liveRight,
 * posKey, defaultBottom, resetKey (reaparece al cambiar), onClose,
 * onArtClick, toggleLabel, queuePop + QueueIcon (botón cola),
 * minKey (persiste minimizado), min + onMinChange (modo controlado).
 */
export default function FloatCard(props) {
  const {
    accent = '#1db954', kind = 'MÚSICA', art, title, sub, statusText,
    playing, loading, onToggle, onPrev, onNext, fav, onFav,
    volume = 0.9, muted = false, onVolume, onMute,
    progress = null, onSeek, liveRight = '',
    posKey, defaultBottom = '12px', resetKey, onClose,
    onArtClick, toggleLabel, kindPulse, queuePop, QueueIcon,
    minKey, miniBottom,
  } = props;

  const [pos, setPos] = useState(() => loadPos(posKey));
  // «Quitada» (X) también se recuerda: al recargar no reaparecen las dos tarjetas.
  // Vuelve sola al reproducir algo (play / tema nuevo).
  const hideKey = posKey ? `${posKey}_hidden` : null;
  const [hidden, setHiddenState] = useState(() => { try { return !!hideKey && localStorage.getItem(hideKey) === '1'; } catch { return false; } });
  const setHidden = (v) => {
    setHiddenState(v);
    try { if (hideKey) localStorage.setItem(hideKey, v ? '1' : '0'); } catch { /* noop */ }
  };
  const firstRun = useRef(true);
  // Minimizado: la tarjeta se oculta (el audio sigue) y se reabre desde los
  // botones de icono junto al de mascotas (header móvil / sidebar PC).
  // Controlado si se pasan `min` + `onMinChange`; si no, interno con `minKey`.
  const [innerMin, setInnerMin] = useState(() => { try { return !!minKey && localStorage.getItem(minKey) === '1'; } catch { return false; } });
  const min = props.min ?? innerMin;
  const setMinPersist = (v) => {
    if (props.onMinChange) props.onMinChange(v);
    else setInnerMin(v);
    try { if (minKey) localStorage.setItem(minKey, v ? '1' : '0'); } catch {}
  };
  const [showVol, setShowVol] = useState(false);
  const [showQueue, setShowQueue] = useState(false);
  const [dragging, setDragging] = useState(false);
  // Salida animada (X / minimizar): se encoge 200ms y recién ahí se oculta
  const [leaving, setLeaving] = useState(false);
  const leavingTimer = useRef(null);
  const animateOut = (fn) => {
    if (leaving) return;
    setLeaving(true);
    if (leavingTimer.current) clearTimeout(leavingTimer.current);
    leavingTimer.current = setTimeout(() => { fn(); setLeaving(false); }, 200);
  };
  useEffect(() => () => { if (leavingTimer.current) clearTimeout(leavingTimer.current); }, []);
  const drag = useRef(null);
  const cardRef = useRef(null);
  // Scrub del timeline: tocar o arrastrar sobre la línea (incluye el aire invisible)
  const scrub = useRef(false);
  const seekFromX = (el, clientX) => {
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (!r.width) return;
    onSeek?.(Math.min(1, Math.max(0, (clientX - r.left) / r.width)));
  };

  // Reaparece sola al reproducir algo nuevo (o al dar play de nuevo)
  // (el primer render NO cuenta: al recargar se respeta lo que dejaste)
  useEffect(() => {
    if (firstRun.current) { firstRun.current = false; return; }
    setHidden(false); setLeaving(false);
  }, [resetKey]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (playing) { setHidden(false); setLeaving(false); } }, [playing]); // eslint-disable-line react-hooks/exhaustive-deps
  // Si cambia el tamaño de ventana, mantiene la posición relativa
  useEffect(() => {
    const onRs = () => setPos(() => loadPos(posKey));
    window.addEventListener('resize', onRs);
    return () => window.removeEventListener('resize', onRs);
  }, []);

  const onPointerDown = (e) => {
    if (e.target.closest('button, input, a, select, .queuepop, .time')) return;
    const wr = cardRef.current.parentElement.getBoundingClientRect(); // el contenedor (incluye el aviso de arriba)
    const startX = e.clientX - (pos ? pos.x : wr.left);
    const startY = e.clientY - (pos ? pos.y : wr.top);
    drag.current = { startX, startY, moved: false };
    setDragging(true);
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e) => {
    if (!drag.current) return;
    const nx = e.clientX - drag.current.startX;
    const ny = e.clientY - drag.current.startY;
    if (!drag.current.moved && Math.hypot(e.movementX || 0, e.movementY || 0) < 1) {
      drag.current.moved = true;
    }
    const c = clampPos(nx, ny);
    setPos(c);
  };
  const endDrag = () => {
    if (!drag.current) return;
    drag.current = null;
    setDragging(false);
    setPos((pp) => {
      if (pp) { try { localStorage.setItem(posKey, JSON.stringify(toSaved(pp))); } catch { /* noop */ } }
      return pp;
    });
  };

  if (hidden) return null;

  const close = () => animateOut(() => { setHidden(true); onClose?.(); });
  // Minimizado: no se muestra nada aquí (ni flecha ni píldora); el audio
  // sigue y la tarjeta se reabre desde el botón de icono correspondiente.
  if (min) return null;

  const pct = progress && progress.dur > 0
    ? Math.min(100, (progress.cur / progress.dur) * 100) : 0;

  return (
    <StyledWrapper $accent={accent} $pos={pos} $defaultBottom={defaultBottom}>
      {props.banner && <div className="cardbanner">{props.banner}</div>}
      <div
        ref={cardRef}
        className={`card${dragging ? ' dragging' : ''}${leaving ? ' card-out' : ' card-in'}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        role="region"
        aria-label={`${kind} ${title}`}
      >
        {art && <div className="bgwrap" aria-hidden="true"><img src={art} alt="" draggable={false} /></div>}
        <div className="top">
          <button className="pfp" onClick={onArtClick} aria-label="Abrir sonando" title="Abrir sonando">
            {art ? <img src={art} alt="" draggable={false} onError={(e) => { e.currentTarget.style.display = 'none'; }} /> : null}
            <span className="eqveil">
              <span className={`playing${playing ? ' on' : ''}`}>
                <span className="greenline line-1" />
                <span className="greenline line-2" />
                <span className="greenline line-3" />
                <span className="greenline line-4" />
                <span className="greenline line-5" />
              </span>
            </span>
          </button>
          <div className="texts">
            <span className="kind"><span className={`dot${kindPulse ? ' pulse' : ''}`} />{kind}</span>
            <p className="title-1" title={title}>{title}</p>
            <p className="title-2" title={statusText || sub}>{statusText || sub}</p>
          </div>
        </div>

        <div className="corner">
          {queuePop && QueueIcon && (
            <button onClick={() => setShowQueue((s) => !s)} aria-label={showQueue ? 'Ocultar cola' : 'Ver cola'} aria-expanded={showQueue ? 'true' : 'false'} title="Cola"
              style={showQueue ? { color: accent } : undefined}>
              <QueueIcon size={16} />
            </button>
          )}
          <button onClick={() => animateOut(() => setMinPersist(true))} aria-label="Minimizar (sigue sonando)" title="Minimizar (sigue sonando)"><Minus size={16} /></button>
          <button onClick={close} aria-label="Pausar y quitar tarjeta" title="Quitar"><X size={16} /></button>
        </div>

        <div className="prog">
          {progress ? (
            <>
              <span className="timetext" aria-hidden="true">{progress.curText}</span>
              <div className="time"
                ref={undefined}
                onPointerDown={(e) => {
                  if (!onSeek) return;
                  scrub.current = true;
                  e.currentTarget.setPointerCapture?.(e.pointerId);
                  seekFromX(e.currentTarget, e.clientX);
                }}
                onPointerMove={(e) => { if (scrub.current) seekFromX(e.currentTarget, e.clientX); }}
                onPointerUp={() => { scrub.current = false; }}
                onPointerCancel={() => { scrub.current = false; }}
                onKeyDown={(e) => {
                  if (!onSeek || !progress?.dur) return;
                  const d = progress.dur;
                  if (e.key === 'ArrowRight') { e.preventDefault(); onSeek(Math.min(1, (progress.cur + 10) / d)); }
                  else if (e.key === 'ArrowLeft') { e.preventDefault(); onSeek(Math.max(0, (progress.cur - 10) / d)); }
                  else if (e.key === 'Home') { e.preventDefault(); onSeek(0); }
                  else if (e.key === 'End') { e.preventDefault(); onSeek(1); }
                }}
                tabIndex={onSeek ? 0 : -1}
                role="slider" aria-label={`Progreso de ${title}`} aria-valuemin={0} aria-valuemax={Math.round(progress.dur || 0)} aria-valuenow={Math.round(progress.cur || 0)} aria-valuetext={`${progress.curText} de ${progress.durText}`}
                title="Adelantar / atrasar (flechas ← →)"><div className="elapsed" style={{ width: `${pct}%` }} /></div>
              <span className="timetext" aria-hidden="true">{progress.durText}</span>
            </>
          ) : (
            <>
              <span className="timetext live-tag">EN VIVO</span>
              <div className="time live" aria-hidden="true"><div className="elapsed indet" /></div>
              <span className="timetext">{liveRight}</span>
            </>
          )}
        </div>

        <div className="controls">
          <span className="volwrap">
            <button
              aria-label={showVol ? 'Ocultar volumen' : 'Mostrar volumen'} aria-expanded={showVol ? 'true' : 'false'} title="Volumen"
              onClick={() => setShowVol((s) => !s)}
              onMouseEnter={() => { if (window.matchMedia?.('(hover: hover)').matches) setShowVol(true); }}
            >
              {muted || volume === 0 ? <VolumeX size={21} /> : <Volume2 size={21} />}
            </button>
            <span className={`volume${showVol ? ' open' : ''}`}>
              <input
                type="range" min="0" max="1" step="0.05"
                value={muted ? 0 : volume}
                onChange={(e) => onVolume?.(+e.target.value)}
                onDoubleClick={() => onMute?.()}
                aria-label={`Volumen ${Math.round((muted ? 0 : volume) * 100)} por ciento, doble toque para silenciar`}
              />
            </span>
          </span>
          <button onClick={onPrev} aria-label="Anterior" title="Anterior"><SkipBack size={23} /></button>
          <button className="mainbtn" onClick={onToggle} aria-label={loading ? 'Cargando audio' : toggleLabel} title={loading ? 'Cargando…' : toggleLabel} aria-busy={loading ? 'true' : undefined} disabled={!!loading}>
            {loading
              ? <Loader2 size={26} className="animate-spin" />
              : playing ? <Pause size={26} /> : <Play size={26} className="ml-0.5" />}
          </button>
          <button onClick={onNext} aria-label="Siguiente" title="Siguiente"><SkipForward size={23} /></button>
          <button onClick={onFav} aria-label={fav ? `Quitar de favoritos: ${title}` : `Marcar favorito: ${title}`} aria-pressed={fav ? 'true' : 'false'} title="Favorito" className={fav ? 'fav-on' : ''}>
            <Heart size={21} fill={fav ? accent : 'none'} />
          </button>
        </div>

        {showQueue && (
          <div className="queuepop" onPointerDown={(e) => e.stopPropagation()}>
            {props.queuePop}
          </div>
        )}
      </div>
    </StyledWrapper>
  );
}

