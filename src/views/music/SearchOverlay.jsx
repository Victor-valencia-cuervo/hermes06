import { Search, ArrowUpLeft, History, X, Loader2 } from 'lucide-react';
import { CATEGORIES, MOODS } from './data';

// Paleta para las tarjetas de "Explorar todo" (degradados de las categorías + momentos)
const TILES = [
  ...MOODS.map(([label, query, bg]) => ({ label, bg, kind: 'mood', query })),
  ...CATEGORIES.map(([name, , bg]) => ({ label: name, bg, kind: 'cat', query: name })),
];

/** Página de búsqueda (dentro de la app, con la flecha de volver arriba junto al menú):
 *  barra de búsqueda limpia, recientes y "Explorar todo" en cuadrícula, como Spotify.
 *  Enter busca; no hay botones duplicados. */
export default function SearchPage({ q, onType, sugs, loading, onPick, onSubmit, hist, onPickHist, onDelHist, onClearHist, onTile, inputRef }) {
  const typing = q.trim().length >= 2;
  return (
    <div className="space-y-5">
      <form onSubmit={onSubmit} className="sticky top-0 z-20 -mx-5 px-5 lg:-mx-10 lg:px-10 py-3"
        style={{ background: 'color-mix(in srgb, var(--bg) 92%, transparent)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)' }}>
        <div className="relative">
          <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--m)' }} />
          <input ref={inputRef} type="search" className="inp !pl-12 !pr-12 !py-3.5 !text-base !rounded-full" placeholder="¿Qué quieres escuchar?"
            value={q} onChange={(e) => onType(e.target.value)} aria-label="Buscar música" autoComplete="off" enterKeyHint="search" />
          {loading
            ? <Loader2 size={18} className="absolute right-4 top-1/2 -translate-y-1/2 animate-spin" style={{ color: 'var(--m)' }} />
            : !!q && <button type="button" onClick={() => onType('')} aria-label="Borrar" className="absolute right-1.5 top-1/2 -translate-y-1/2 w-10 h-10 grid place-items-center rounded-full"><X size={18} style={{ color: 'var(--m)' }} /></button>}
        </div>
      </form>

      {typing && (
        <div>
          {!sugs.length && <p className="text-sm px-1 py-3" style={{ color: 'var(--m)' }}>Pulsa Enter para buscar “{q.trim().slice(0, 30)}”.</p>}
          {sugs.map((s, i) => (
            <button key={`${s.label}-${i}`} type="button" onClick={() => onPick(s.label)}
              className="w-full flex items-center gap-3 px-2 py-3.5 text-left rounded-xl hover:bg-[var(--s2)] active:scale-[.99] transition">
              {s.from === 'web' ? <Search size={18} className="shrink-0" style={{ color: 'var(--a)' }} /> : <History size={18} className="shrink-0" style={{ color: 'var(--m)' }} />}
              <span className="truncate flex-1 text-[15px]" title={s.label}>{s.label}</span>
              <ArrowUpLeft size={17} className="shrink-0" style={{ color: 'var(--m)' }} />
            </button>
          ))}
        </div>
      )}

      {!typing && (
        <>
          {!!hist.length && (
            <section>
              <div className="flex items-end justify-between mb-2">
                <h3 className="serif text-[2rem] font-semibold leading-none">Recientes</h3>
                <button className="text-xs px-3 py-2 rounded-full" style={{ background: 'var(--s2)', color: 'var(--m)' }} onClick={onClearHist}>Limpiar</button>
              </div>
              {hist.slice(0, 6).map((s) => (
                <div key={s} className="flex items-center rounded-xl hover:bg-[var(--s2)]">
                  <button onClick={() => onPickHist(s)} className="flex-1 min-w-0 flex items-center gap-3 px-2 py-3 text-left" title={s}>
                    <History size={17} className="shrink-0" style={{ color: 'var(--m)' }} /><span className="text-[15px] truncate">{s}</span>
                  </button>
                  <button className="w-11 h-11 grid place-items-center shrink-0" aria-label={`Borrar ${s}`} onClick={() => onDelHist(s)}><X size={16} style={{ color: 'var(--m)' }} /></button>
                </div>
              ))}
            </section>
          )}

          <section>
            <h3 className="serif text-[2rem] font-semibold leading-none mb-3">Explorar todo</h3>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {TILES.map((tl) => (
                <button key={`${tl.kind}-${tl.label}`} onClick={() => onTile(tl)}
                  className="relative overflow-hidden rounded-xl h-[5.5rem] text-left p-3.5 text-white active:scale-95 transition-transform" style={{ background: tl.bg }}>
                  <span className="relative z-10 text-[17px] font-bold leading-tight block max-w-[85%]" style={{ textShadow: '0 1px 8px rgba(0,0,0,.35)' }}>{tl.label}</span>
                  <span aria-hidden="true" className="absolute -right-3 -bottom-3 w-16 h-16 rounded-lg" style={{ background: 'rgba(255,255,255,.2)', transform: 'rotate(25deg)', boxShadow: '-4px 4px 14px rgba(0,0,0,.25)' }} />
                </button>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
