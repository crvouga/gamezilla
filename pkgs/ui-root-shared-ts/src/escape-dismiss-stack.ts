/**
 * LIFO stack of Escape dismiss handlers for nested web overlays.
 * Innermost active overlay receives Escape.
 */

type EscapeDismissHandler = () => void;

const stack: EscapeDismissHandler[] = [];
let listening = false;

function onDocumentKeyDown(event: KeyboardEvent): void {
  if (event.key !== 'Escape') return;
  const handler = stack[stack.length - 1];
  if (handler === undefined) return;
  event.preventDefault();
  event.stopPropagation();
  handler();
}

function ensureListener(): void {
  if (listening || typeof document === 'undefined') return;
  document.addEventListener('keydown', onDocumentKeyDown, true);
  listening = true;
}

function teardownListenerIfIdle(): void {
  if (!listening || stack.length > 0) return;
  document.removeEventListener('keydown', onDocumentKeyDown, true);
  listening = false;
}

/** Register an Escape dismiss handler; returns unsubscribe. */
export function pushEscapeDismissHandler(
  handler: EscapeDismissHandler
): () => void {
  stack.push(handler);
  ensureListener();
  return () => {
    const index = stack.lastIndexOf(handler);
    if (index >= 0) stack.splice(index, 1);
    teardownListenerIfIdle();
  };
}
