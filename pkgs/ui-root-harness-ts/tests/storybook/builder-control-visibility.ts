/** Serializable browser probe: clipping is distinct from an obscured control. */
export function builderControlsUncovered() {
  // The builder's board is a screen of its own, with nothing pinned over it.
  const scroller = document.querySelector<HTMLElement>(
    '[data-screen="puzzle-content-author-board"]'
  );
  if (scroller === null) return ["the builder's board screen is missing"];
  const controls = document.querySelectorAll<HTMLElement>(
    '[data-testid="content-author-stage"] :is(button, input)'
  );
  const covered: string[] = [];
  const check = (control: HTMLElement, at: string, mustReach = false): void => {
    const box = control.getBoundingClientRect();
    const bounds = scroller.getBoundingClientRect();
    const x = box.left + box.width / 2;
    const y = box.top + box.height / 2;
    const inView =
      x >= Math.max(0, bounds.left) &&
      x < Math.min(window.innerWidth, bounds.right) &&
      y >= Math.max(0, bounds.top) &&
      y < Math.min(window.innerHeight, bounds.bottom);
    if (!inView && !mustReach) return;
    const top = inView ? document.elementFromPoint(x, y) : null;
    if (top !== null && control.contains(top)) return;
    const name =
      control.getAttribute('data-testid') ??
      control.getAttribute('aria-label') ??
      control.textContent.trim();
    covered.push(`${at}: ${name}`);
  };
  scroller.scrollTop = 0;
  for (const control of controls) check(control, 'top');
  scroller.scrollTop = scroller.scrollHeight;
  for (const control of controls) check(control, 'bottom');
  for (const control of controls) {
    control.scrollIntoView({
      block: 'center',
      inline: 'center',
      behavior: 'instant',
    });
    check(control, 'reach', true);
  }
  return covered;
}
