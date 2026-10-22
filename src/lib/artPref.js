// Preferencia por canción: ¿carátula original (por defecto) o la miniatura de YouTube?
// El botón "Revertir carátula" la cambia y se recuerda para esa canción.
const KEY = 'h_art_pref_v1';
const read = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch { return {}; } };

export const prefersYT = (id) => !!id && !!read()[id];

export function setPrefYT(id, yt) {
  if (!id) return;
  try {
    const m = read();
    if (yt) m[id] = 1; else delete m[id];
    const ks = Object.keys(m);
    if (ks.length > 400) for (const k of ks.slice(0, ks.length - 400)) delete m[k];
    localStorage.setItem(KEY, JSON.stringify(m));
  } catch { /* sin almacenamiento */ }
}
