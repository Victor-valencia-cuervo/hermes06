import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AlarmClock, Check, Columns2, GripVertical, Plus, Quote, RectangleHorizontal, SlidersHorizontal, Trash2 } from 'lucide-react';
import PixelFace from '../components/PixelFace';
import DeviceCard from '../components/DeviceCard';
import { APP_NAME } from '../lib/format';
import { WIDGETS } from './registry';
import LedWidget from './LedWidgets';
import { WidgetCatalog, WidgetConfig, useWidgets } from './WidgetUI';

// ---------- Widgets nativos (lo que ya tenía el inicio) ----------
function Saludo({ now, greeting }) {
  return (
    <div className="text-center pt-2 pb-2">
      <h1 className="serif text-5xl sm:text-6xl tracking-[0.3em] uppercase pl-[0.3em]">{APP_NAME}</h1>
      <p className="text-xs mt-3 tracking-[0.25em] uppercase capitalize" style={{ color: 'var(--m)' }}>{now.toLocaleDateString('es-CO', { weekday: 'long' })}</p>
      <p className="text-sm mt-1 tabular-nums" style={{ color: 'var(--a)' }}>{now.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}</p>
      <p className="serif mt-4 italic text-xl" style={{ color: 'var(--m)' }}>“{greeting}”</p>
    </div>
  );
}
function Carita({ react, weather, onPoke, onOpenWeather }) {
  const WI = weather?.I;
  return (
    <div className="card h-full flex flex-col items-center gap-4">
      <PixelFace face={react.face} kind={react.kind} onClick={onPoke} />
      {/* Diálogo: globo grande y legible, con la colita hacia la carita */}
      <div className="relative w-full rounded-2xl px-5 py-4 text-center" style={{ background: 'var(--s2)' }} aria-live="polite">
        <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rotate-45" style={{ background: 'var(--s2)' }} aria-hidden="true" />
        <p className="serif text-[1.35rem] sm:text-2xl leading-snug text-balance">{react.say}</p>
      </div>
      {weather && (
        <button onClick={onOpenWeather} className="w-full flex items-center justify-center gap-3 pt-3 hover:opacity-80 transition" style={{ borderTop: '1px solid var(--bd)' }} aria-label="Ver detalles del clima">
          <WI size={26} style={{ color: 'var(--a)' }} />
          <span className="text-left leading-tight">
            <span className="block text-xl font-semibold tabular-nums">{weather.temp}{weather.sym || '°C'} <span className="text-sm font-normal" style={{ color: 'var(--m)' }}>{weather.t}</span></span>
            <span className="block text-xs" style={{ color: 'var(--m)' }}>máx {weather.max}° · mín {weather.min}°{weather.pop >= 30 ? ` · ☂ ${weather.pop}%` : ''}</span>
          </span>
        </button>
      )}
    </div>
  );
}
function Frase({ quote }) {
  return (
    <div className="card h-full flex flex-col justify-center">
      <Quote size={20} style={{ color: 'var(--a)' }} className="mb-3" />
      <p className="serif text-2xl leading-snug italic">{quote.t}</p>
      <p className="text-xs tracking-widest uppercase mt-3" style={{ color: 'var(--a)' }}>{quote.a}</p>
    </div>
  );
}
function Recordatorios({ reminders }) {
  const pending = reminders.filter((r) => !r.done).slice(0, 3);
  return (
    <div className="card">
      <p className="text-xs tracking-widest mb-3" style={{ color: 'var(--m)' }}>PRÓXIMOS RECORDATORIOS</p>
      {pending.map((r) => (
        <p key={r.id} className="flex items-center gap-2 text-sm py-1"><AlarmClock size={15} style={{ color: 'var(--a)' }} />{r.text}
          <span className="text-xs" style={{ color: 'var(--m)' }}>{new Date(r.at).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })}</span></p>
      ))}
      {!pending.length && <p className="text-sm" style={{ color: 'var(--m)' }}>Nada pendiente.</p>}
    </div>
  );
}

function Body({ w, p, interactive }) {
  switch (w.type) {
    case 'saludo': return <Saludo {...p} />;
    case 'carita': return <Carita {...p} />;
    case 'frase': return <Frase {...p} />;
    case 'dispositivo': return <DeviceCard />;
    case 'recordatorios': return <Recordatorios {...p} />;
    default: return <LedWidget item={w} ctx={p} interactive={interactive} />;
  }
}

// ---------- Inicio: rejilla de widgets que se ordena como un escritorio ----------
export default function HomeWidgets(props) {
  const api = useWidgets();
  const { widgets } = api;
  const loc = useLocation();
  const nav = useNavigate();
  const [edit, setEdit] = useState(false);
  const [adding, setAdding] = useState(false);
  const [cfgId, setCfgId] = useState(null);
  const [drag, setDrag] = useState(null);
  const dragRef = useRef(null);
  const lastSwap = useRef(0);

  // «Editar en el inicio» (desde Ajustes) llega con ?editar
  useEffect(() => {
    if (/(^|[?&])editar/.test(loc.search)) { setEdit(true); nav('/', { replace: true }); }
  }, [loc.search]); // eslint-disable-line react-hooks/exhaustive-deps

  const startDrag = (e, w) => {
    e.preventDefault();
    const r = e.currentTarget.closest('[data-wid]').getBoundingClientRect();
    const d = { id: w.id, ox: Math.min(e.clientX - r.left, 220), oy: Math.min(e.clientY - r.top, 40), x: e.clientX, y: e.clientY, w: Math.min(r.width, 360) };
    dragRef.current = d; setDrag(d);
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* sin captura */ }
  };
  const moveDrag = (e) => {
    const d = dragRef.current; if (!d) return;
    d.x = e.clientX; d.y = e.clientY; setDrag({ ...d });
    const hit = document.elementsFromPoint(e.clientX, e.clientY).map((n) => n.closest?.('[data-wid]')).find((n) => n && n.dataset.wid !== d.id);
    if (hit && performance.now() - lastSwap.current > 140) {
      lastSwap.current = performance.now();
      api.set((ws) => {
        const from = ws.findIndex((x) => x.id === d.id); const to = ws.findIndex((x) => x.id === hit.dataset.wid);
        if (from < 0 || to < 0 || from === to) return ws;
        const a = [...ws]; const [it] = a.splice(from, 1); a.splice(to, 0, it); return a;
      });
    }
  };
  const endDrag = () => { dragRef.current = null; setDrag(null); };
  // Con el dedo/ratón cerca del borde, la pantalla se desplaza sola.
  useEffect(() => {
    if (!drag) return undefined;
    const iv = setInterval(() => {
      const d = dragRef.current; const sc = document.querySelector('main'); if (!d || !sc) return;
      if (d.y < 90) sc.scrollBy(0, -12); else if (d.y > window.innerHeight - 90) sc.scrollBy(0, 12);
    }, 16);
    return () => clearInterval(iv);
  }, [!!drag]); // eslint-disable-line react-hooks/exhaustive-deps

  const cfgItem = widgets.find((w) => w.id === cfgId);
  const gripKeys = (e, w) => {
    const k = e.key;
    if (k === 'ArrowUp' || k === 'ArrowLeft') { e.preventDefault(); api.move(w.id, -1); }
    if (k === 'ArrowDown' || k === 'ArrowRight') { e.preventDefault(); api.move(w.id, 1); }
  };
  const dragging = drag && widgets.find((w) => w.id === drag.id);

  return (
    <>
      {edit ? (
        <div className="sticky top-0 z-30 glass rounded-2xl p-2.5 pl-4 flex items-center gap-2 fin">
          <p className="text-xs flex-1 min-w-0" style={{ color: 'var(--m)' }}><b style={{ color: 'var(--t)' }}>Editando el inicio.</b> Arrastra <GripVertical size={12} className="inline -mt-0.5" /> para ordenar.</p>
          <button className="btn btn-o !py-1.5 !px-3 !min-h-[38px]" onClick={() => setAdding(true)}><Plus size={15} /> Agregar</button>
          <button className="btn !py-1.5 !px-3 !min-h-[38px]" onClick={() => setEdit(false)}><Check size={15} /> Listo</button>
        </div>
      ) : (
        <div className="flex justify-end -mb-2">
          <button className="ico-btn !w-auto gap-2 px-3 text-xs" onClick={() => setEdit(true)} aria-label="Personalizar el inicio"><SlidersHorizontal size={16} /> Personalizar</button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch">
        {widgets.map((w) => {
          const def = WIDGETS[w.type];
          const lifted = drag?.id === w.id;
          return (
            <div key={w.id} data-wid={w.id} className={`relative ${w.size === 2 ? 'md:col-span-2' : ''} ${edit ? 'rounded-3xl' : ''}`}
              style={edit ? { outline: '2px dashed color-mix(in srgb, var(--a) 55%, transparent)', outlineOffset: 4, opacity: lifted ? 0.3 : 1, transition: 'opacity .15s' } : undefined}>
              <Body w={w} p={props} interactive={!edit} />
              {edit && (
                <>
                  <div className="absolute inset-0 z-10 rounded-3xl" aria-hidden="true" />
                  <div className="absolute top-2 right-2 z-20 flex items-center gap-1 p-1 rounded-2xl glass">
                    <button className="ico-btn touch-none cursor-grab active:cursor-grabbing" style={{ color: 'var(--t)' }} aria-label={`Mover ${def.name}. Arrastra o usa las flechas`}
                      onPointerDown={(e) => startDrag(e, w)} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag} onKeyDown={(e) => gripKeys(e, w)}><GripVertical size={18} /></button>
                    <button className="ico-btn" aria-label={w.size === 2 ? `${def.name}: ocupar media fila` : `${def.name}: ocupar toda la fila`} title={w.size === 2 ? 'Media fila' : 'Fila completa'} onClick={() => api.patch(w.id, { size: w.size === 2 ? 1 : 2 })}>
                      {w.size === 2 ? <Columns2 size={17} /> : <RectangleHorizontal size={17} />}
                    </button>
                    {def.settings.length > 0 && <button className="ico-btn" aria-label={`Personalizar ${def.name}`} onClick={() => setCfgId(w.id)}><SlidersHorizontal size={16} /></button>}
                    <button className="ico-btn" aria-label={`Quitar ${def.name}`} onClick={() => api.remove(w.id)}><Trash2 size={16} /></button>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      {!widgets.length && (
        <div className="card text-center py-10">
          <p className="text-sm mb-3" style={{ color: 'var(--m)' }}>Tu inicio está vacío.</p>
          <button className="btn" onClick={() => { setEdit(true); setAdding(true); }}><Plus size={16} /> Agregar un widget</button>
        </div>
      )}
      {edit && !!widgets.length && (
        <button onClick={() => setAdding(true)} className="w-full rounded-3xl py-6 text-sm flex items-center justify-center gap-2" style={{ border: '2px dashed var(--bd)', color: 'var(--m)' }}><Plus size={18} /> Agregar widget</button>
      )}

      {dragging && (
        <div className="fixed z-[80] pointer-events-none rounded-2xl glass px-4 py-3 flex items-center gap-3 shadow-2xl" style={{ left: drag.x - drag.ox, top: drag.y - drag.oy, width: drag.w, border: '2px solid var(--a)' }}>
          {(() => { const I = WIDGETS[dragging.type].icon; return <I size={20} style={{ color: 'var(--a)' }} />; })()}
          <span className="text-sm font-semibold truncate">{WIDGETS[dragging.type].name}</span>
        </div>
      )}
      {adding && <WidgetCatalog widgets={widgets} onClose={() => setAdding(false)} onAdd={(t) => { const w = api.add(t); if (WIDGETS[t].settings.length) { setAdding(false); setCfgId(w.id); } }} />}
      {cfgItem && <WidgetConfig item={cfgItem} onChange={(p) => api.patch(cfgItem.id, p)} onClose={() => setCfgId(null)} onRemove={() => { api.remove(cfgItem.id); setCfgId(null); }} />}
    </>
  );
}
