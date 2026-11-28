/** A button activates on click, after pointerup. IMEs may issue a final input
 * after compositionend. Leave the original control attached through that frame. */
export function finishOpeningGesture(
  opening: HTMLElement,
  finish: () => void
): void | (() => void) {
  const window = opening.ownerDocument.defaultView;
  const busy = () =>
    opening.matches(':active') ||
    opening.querySelector('[data-composing]') !== null;
  if (window === null || !busy()) {
    finish();
    return;
  }
  const events = new AbortController();
  let frame: number | undefined;
  const commit = (): void => {
    events.abort();
    finish();
  };
  const afterEvent = (): void => {
    if (frame !== undefined) return;
    frame = window.requestAnimationFrame(() => {
      frame = undefined;
      if (!events.signal.aborted && !busy()) commit();
    });
  };
  const options = { capture: true, signal: events.signal };
  for (const type of [
    'pointerup',
    'pointercancel',
    'keyup',
    'compositionend',
    'click',
    'focusout',
  ])
    opening.ownerDocument.addEventListener(type, afterEvent, options);
  window.addEventListener('blur', commit, { signal: events.signal });
  return () => {
    events.abort();
    if (frame !== undefined) window.cancelAnimationFrame(frame);
  };
}
