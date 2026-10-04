/**
 * Blur the active element so a departing screen's focused control does not
 * keep keyboard focus (and its `:focus-visible` ring) after navigation.
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
}
