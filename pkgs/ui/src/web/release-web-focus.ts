/**
 * Drop focus on web so a stack screen / modal can be aria-hidden without
 * Chrome logging "Blocked aria-hidden on an element because its descendant
 * retained focus".
 *
 * Blur immediately and again after the current turn: browsers often restore
 * focus onto the pressed control once the click handler returns.
 */
export function releaseWebFocus(): void {
  if (typeof document === 'undefined' || typeof HTMLElement === 'undefined') {
    return;
  }
  const blurActive = () => {
    const active = document.activeElement;
    if (active instanceof HTMLElement) active.blur();
  };
  blurActive();
  queueMicrotask(blurActive);
  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(blurActive);
  }
}
