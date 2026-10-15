/**
 * Escenario del reproductor YouTube: UN solo player oculto (solo audio).
 * El modo video se eliminó (lento y con fallos): el iframe vive siempre
 * en el slot oculto de 2px, sin moverse ni redimensionarse.
 */
export const stage = { container: null, hiddenSlot: null };

export function ensureContainer() {
  if (!stage.container && typeof document !== 'undefined') {
    const d = document.createElement('div');
    d.style.width = '2px';
    d.style.height = '2px';
    stage.container = d;
    ensureHidden();
  }
  return stage.container;
}

/** Deja el player en el slot oculto (modo solo-audio permanente). */
export function ensureHidden() {
  const c = stage.container;
  const slot = stage.hiddenSlot;
  if (c && slot && c.parentNode !== slot) slot.appendChild(c);
}

/** Compat: antes movía el player al banner; ahora siempre oculto. */
export function place() {
  ensureHidden();
}

/** Compat: ya no se redimensiona (el player es fijo de 2px). */
export function sizeToSlot() {}
