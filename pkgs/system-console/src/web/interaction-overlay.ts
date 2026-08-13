import type { SimulationStep } from '../types';

/** Extract `home` from `testId("home")`. */
export function parseTestIdSelector(
  selector: string | undefined
): string | null {
  if (!selector) return null;
  const m = /^testId\("((?:\\.|[^"\\])*)"\)$/.exec(selector.trim());
  if (!m) return null;
  return m[1]!.replace(/\\"/g, '"');
}

/** Parse `xRatio=0.5, yRatio=0.25` from tapAt detail. */
export function parseTapAtRatios(
  detail: string | undefined
): { readonly xRatio: number; readonly yRatio: number } | null {
  if (!detail) return null;
  const x = /xRatio=([0-9.]+)/.exec(detail);
  const y = /yRatio=([0-9.]+)/.exec(detail);
  if (!x || !y) return null;
  const xRatio = Number(x[1]);
  const yRatio = Number(y[1]);
  if (!Number.isFinite(xRatio) || !Number.isFinite(yRatio)) return null;
  return { xRatio, yRatio };
}

const OVERLAY_STYLE_ID = 'sim-interaction-overlay-style';
const OVERLAY_CLASS = 'sim-interaction-target';
const CROSSHAIR_ID = 'sim-interaction-crosshair';

/**
 * Highlight the interacted element in a same-origin snapshot document.
 * Returns false when the target was not found.
 */
export function applyInteractionOverlay(
  doc: Document,
  step: Pick<SimulationStep, 'kind' | 'selector' | 'detail'>
): boolean {
  clearInteractionOverlay(doc);
  const testId = parseTestIdSelector(step.selector);
  if (!testId) return false;
  const el = doc.querySelector(`[data-testid="${cssEscape(testId)}"]`);
  if (!(el instanceof HTMLElement)) return false;

  ensureOverlayStyle(doc);
  el.classList.add(OVERLAY_CLASS);
  el.setAttribute('data-sim-kind', step.kind);

  if (step.kind === 'tapAt') {
    const ratios = parseTapAtRatios(step.detail);
    if (ratios) {
      const rect = el.getBoundingClientRect();
      const x = rect.left + rect.width * ratios.xRatio;
      const y = rect.top + rect.height * ratios.yRatio;
      const mark = doc.createElement('div');
      mark.id = CROSSHAIR_ID;
      mark.style.cssText = [
        'position:fixed',
        `left:${x}px`,
        `top:${y}px`,
        'width:14px',
        'height:14px',
        'margin:-7px 0 0 -7px',
        'border:2px solid #ff6b6b',
        'border-radius:50%',
        'box-shadow:0 0 0 2px rgba(255,107,107,0.35)',
        'pointer-events:none',
        'z-index:2147483647',
      ].join(';');
      doc.body.appendChild(mark);
    }
  }
  try {
    el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  } catch {
    /* ignore */
  }
  return true;
}

export function clearInteractionOverlay(doc: Document): void {
  for (const el of doc.querySelectorAll(`.${OVERLAY_CLASS}`)) {
    el.classList.remove(OVERLAY_CLASS);
    el.removeAttribute('data-sim-kind');
  }
  doc.getElementById(CROSSHAIR_ID)?.remove();
}

function ensureOverlayStyle(doc: Document): void {
  if (doc.getElementById(OVERLAY_STYLE_ID)) return;
  const style = doc.createElement('style');
  style.id = OVERLAY_STYLE_ID;
  style.textContent = `
.${OVERLAY_CLASS} {
  outline: 2px solid #82aaff !important;
  outline-offset: 2px !important;
  box-shadow: 0 0 0 4px rgba(130, 170, 255, 0.35) !important;
  position: relative !important;
}
.${OVERLAY_CLASS}::after {
  content: attr(data-sim-kind);
  position: absolute;
  left: 0;
  top: -1.4em;
  font: 600 10px/1 "IBM Plex Mono", ui-monospace, monospace;
  color: #0a0b0d;
  background: #82aaff;
  padding: 2px 5px;
  border-radius: 2px;
  white-space: nowrap;
  z-index: 2147483646;
  pointer-events: none;
}
`;
  doc.head.appendChild(style);
}

function cssEscape(value: string): string {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
    return CSS.escape(value);
  }
  return value.replace(/["\\]/g, '\\$&');
}
