type Capturable = {
  setPointerCapture: (id: number) => void;
  releasePointerCapture: (id: number) => void;
  hasPointerCapture?: (id: number) => boolean;
  getBoundingClientRect: () => { left: number };
};

function asCapturable(target: unknown): Capturable | null {
  if (target == null || typeof target !== 'object') return null;
  if (
    !('setPointerCapture' in target) ||
    !('releasePointerCapture' in target) ||
    !('getBoundingClientRect' in target)
  ) {
    return null;
  }
  return target as Capturable;
}

export function readTrackLeft(target: unknown): number | null {
  const el = asCapturable(target);
  if (el == null) return null;
  return el.getBoundingClientRect().left;
}

export function capturePointer(target: unknown, pointerId: number): void {
  const el = asCapturable(target);
  if (el == null) return;
  el.setPointerCapture(pointerId);
}

export function releasePointer(target: unknown, pointerId: number): void {
  const el = asCapturable(target);
  if (el == null) return;
  try {
    if (el.hasPointerCapture?.(pointerId) !== false) {
      el.releasePointerCapture(pointerId);
    }
  } catch {
    // Capture may already be released.
  }
}

export function lockBodyUserSelect(saved: { current: string | null }): void {
  if (typeof document === 'undefined') return;
  if (saved.current !== null) return;
  saved.current = document.body.style.userSelect;
  document.body.style.userSelect = 'none';
}

export function restoreBodyUserSelect(saved: { current: string | null }): void {
  if (typeof document === 'undefined') return;
  if (saved.current === null) return;
  document.body.style.userSelect = saved.current;
  saved.current = null;
}
