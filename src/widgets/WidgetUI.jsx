import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, ChevronUp, Plus, RotateCcw, SlidersHorizontal, Trash2, X } from 'lucide-react';
import useStore from '../hooks/useStore';
import { DEFAULT_WIDGETS, ORDER_CATALOG, WIDGETS, makeWidget, normalizeWidgets } from './registry';
import LedWidget from './LedWidgets';

/** Estado compartido de los widgets (misma clave en Inicio y en Ajustes: se sincronizan en vivo). */
export function useWidgets() {
  const [raw, setRaw] = useStore('h_widgets', DEFAULT_WIDGETS);
  const widgets = normalizeWidgets(raw);
  const set = (next) => setRaw(typeof next === 'function' ? next(widgets) : next);
  return {
    widgets, set,
    add: (type) => { const w = makeWidget(type); set((ws) => [...ws, w]); return w; },
    remove: (id) => set((ws) => ws.filter((w) => w.id !== id)),
    patch: (id, p) => set((ws) => ws.map((w) => (w.id === id ? { ...w, ...p, cfg: p.cfg ? { ...w.cfg, ...p.cfg } : w.cfg } : w))),
    move: (id, dir) => set((ws) => { const i = ws.findIndex((w) => w.id === id); const j = i + dir; if (i < 0 || j < 0 || j >= ws.length) return ws; const a = [...ws]; [a[i], a[j]] = [a[j], a[i]]; return a; }),
    reset: () => set(DEFAULT_WIDGETS),
  };
}

export function Sheet({ title, onClose, children }) {
  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm fin" onClick={onClose} aria-hidden="true" />
      <div className="relative w-full sm:max-w-lg max-h-[88dvh] flex flex-col glass rounded-t-3xl sm:rounded-3xl sheet overflow-hidden">
        <div className="flex items-center justify-between px-5 pt-4 pb-2 shrink-0">
          <p className="text-base font-semibold truncate">{title}</p>
          <button className="ico-btn" onClick={onClose} aria-label="Cerrar"><X size={18} /></button>
        </div>
        <div className="overflow-y-auto px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] min-h-0">{children}</div>
      </div>
    </div>, document.body);
}

const same = (a, b) => String(a) === String(b);
function Field({ f, cfg, onChange }) {
  const v = cfg[f.key];
  const set = (x) => onChange({ [f.key]: x });
  if (f.type === 'toggle') {
    return (
      <button onClick={() => set(!v)} role="switch" aria-checked={!!v} className="w-full flex items-center justify-between gap-3 py-2 text-left">
        <span className="text-xs font-semibold">{f.label}</span>
        <span className="w-11 h-6 rounded-full relative shrink-0" style={{ background: v ? 'var(--a)' : 'var(--bd)' }}><span className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all" style={{ left: v ? 22 : 2 }} /></span>
      </button>
    );
  }
  return (
    <div className="py-2">
      <p className="text-xs font-semibold mb-1.5">{f.label}</p>
      {f.type === 'seg' && (
        <div className="flex flex-wrap gap-1.5">
          {f.options.map(([val, label]) => (
            <button key={String(val)} onClick={() => set(val)} aria-pressed={same(v, val)} className={`px-3 py-1.5 rounded-full text-xs font-semibold ${same(v, val) ? 'btn' : 'btn btn-o'}`} style={{ minHeight: 36 }}>{label}</button>
          ))}
        </div>
      )}
      {f.type === 'select' && (
        <select className="inp" value={String(v)} onChange={(e) => set((f.options.find(([val]) => same(val, e.target.value)) || [])[0] ?? e.target.value)}>
          {f.options.map(([val, label]) => <option key={String(val)} value={String(val)}>{label}</option>)}
        </select>
      )}
      {f.type === 'text' && <input className="inp" value={v ?? ''} maxLength={f.max || 60} onChange={(e) => set(e.target.value.toUpperCase())} />}
      {f.type === 'range' && (
        <div className="flex items-center gap-3">
          <input type="range" className="flex-1" min={f.min} max={f.max} step={f.step || 1} value={v} onChange={(e) => set(+e.target.value)} style={{ accentColor: 'var(--a)' }} />
          <span className="text-xs tabular-nums w-8 text-right" style={{ color: 'var(--m)' }}>{v}</span>
        </div>
      )}
    </div>
  );
}

/** Personalizar un widget (se aplica en vivo; las pantallas de puntos muestran una vista previa). */
export function WidgetConfig({ item, onChange, onClose, onRemove }) {
  const def = WIDGETS[item.type];
  return (
    <Sheet title={def.name} onClose={onClose}>
      <p className="text-xs mb-3" style={{ color: 'var(--m)' }}>{def.desc}</p>
      {def.kind === 'led' && <div className="mb-3"><LedWidget item={{ ...item, size: 1 }} ctx={{ playing: false, idle: 0, hour: 12 }} interactive={false} /></div>}
      {def.settings.length === 0 && <p className="text-xs py-2" style={{ color: 'var(--m)' }}>Este widget no tiene opciones: se ordena, se achica o se quita desde el inicio.</p>}
      {def.settings.filter((f) => !f.when || f.when(item.cfg)).map((f) => <Field key={f.key} f={f} cfg={item.cfg} onChange={(p) => onChange({ cfg: p })} />)}
      <div className="flex gap-2 mt-4">
        {onRemove && <button className="btn btn-o flex-1" onClick={onRemove}><Trash2 size={15} /> Quitar</button>}
        <button className="btn flex-1" onClick={onClose}><Check size={15} /> Listo</button>
      </div>
    </Sheet>
  );
}

/** Catálogo para agregar widgets (los que no admiten varias copias se bloquean cuando ya están). */
export function WidgetCatalog({ widgets, onAdd, onClose }) {
  return (
    <Sheet title="Agregar widget" onClose={onClose}>
      <div className="space-y-2">
        {ORDER_CATALOG.map((type) => {
          const d = WIDGETS[type]; const I = d.icon; const has = widgets.some((w) => w.type === type); const blocked = has && !d.multi;
          return (
            <div key={type} className="flex items-center gap-3 p-3 rounded-2xl" style={{ background: 'var(--s2)' }}>
              <span className="w-10 h-10 rounded-xl grid place-items-center shrink-0 acc-soft"><I size={20} /></span>
              <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{d.name}</span><span className="block text-[11px]" style={{ color: 'var(--m)' }}>{d.desc}</span></span>
              <button className={`btn ${blocked ? 'btn-o' : ''} !px-3 shrink-0`} disabled={blocked} aria-label={`Agregar ${d.name}`} onClick={() => onAdd(type)} style={{ opacity: blocked ? 0.5 : 1 }}>
                {blocked ? <Check size={16} /> : <Plus size={16} />}
              </button>
            </div>
          );
        })}
      </div>
    </Sheet>
  );
}

/** Tarjeta de Ajustes: qué widgets hay en el inicio, en qué orden, y cómo se ven. */
export function WidgetManager({ onEditHome }) {
  const api = useWidgets();
  const [adding, setAdding] = useState(false);
  const [cfgId, setCfgId] = useState(null);
  const cfgItem = api.widgets.find((w) => w.id === cfgId);
  return (
    <div className="card">
      <p className="text-sm mb-1 font-semibold flex items-center gap-2"><SlidersHorizontal size={16} style={{ color: 'var(--a)' }} />Widgets del inicio</p>
      <p className="text-xs mb-3" style={{ color: 'var(--m)' }}>Agrega o quita lo que ves al abrir Hermes. Todos toman el color de la app. Para moverlos como en un escritorio, usa «Editar en el inicio».</p>
      <div className="space-y-1.5 mb-3">
        {api.widgets.map((w, i) => {
          const d = WIDGETS[w.type]; const I = d.icon;
          return (
            <div key={w.id} className="flex items-center gap-2 p-2 rounded-2xl" style={{ background: 'var(--s2)' }}>
              <span className="w-9 h-9 rounded-xl grid place-items-center shrink-0 acc-soft"><I size={18} /></span>
              <span className="text-sm min-w-0 flex-1 truncate">{d.name}</span>
              <button className="ico-btn" disabled={i === 0} onClick={() => api.move(w.id, -1)} aria-label={`Subir ${d.name}`}><ChevronUp size={18} /></button>
              <button className="ico-btn" disabled={i === api.widgets.length - 1} onClick={() => api.move(w.id, 1)} aria-label={`Bajar ${d.name}`}><ChevronDown size={18} /></button>
              {d.settings.length > 0 && <button className="ico-btn" onClick={() => setCfgId(w.id)} aria-label={`Personalizar ${d.name}`}><SlidersHorizontal size={17} /></button>}
              <button className="ico-btn" onClick={() => api.remove(w.id)} aria-label={`Quitar ${d.name}`}><Trash2 size={17} /></button>
            </div>
          );
        })}
        {!api.widgets.length && <p className="text-xs py-2" style={{ color: 'var(--m)' }}>El inicio está vacío. Agrega un widget.</p>}
      </div>
      <div className="flex gap-2 flex-wrap">
        <button className="btn flex-1" onClick={() => setAdding(true)}><Plus size={15} /> Agregar</button>
        {onEditHome && <button className="btn btn-o flex-1" onClick={onEditHome}>Editar en el inicio</button>}
        <button className="btn btn-o" onClick={api.reset} aria-label="Restaurar el inicio original" title="Restaurar el inicio original"><RotateCcw size={15} /></button>
      </div>
      {adding && <WidgetCatalog widgets={api.widgets} onClose={() => setAdding(false)} onAdd={(t) => { const w = api.add(t); if (WIDGETS[t].settings.length) { setAdding(false); setCfgId(w.id); } }} />}
      {cfgItem && <WidgetConfig item={cfgItem} onChange={(p) => api.patch(cfgItem.id, p)} onClose={() => setCfgId(null)} onRemove={() => { api.remove(cfgItem.id); setCfgId(null); }} />}
    </div>
  );
}
