/**
 * Drop focus on web so a stack screen / modal can be aria-hidden without
 * Chrome logging "Blocked aria-hidden on an element because its descendant
 * retained focus".
 */
export function releaseWebFocus(): void {
  if (typeof document === 'undefined') return;
  const active = document.activeElement;
  if (active instanceof HTMLElement) active.blur();
}
