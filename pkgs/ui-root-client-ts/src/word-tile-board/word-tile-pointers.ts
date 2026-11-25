export type Contact = { x: number; y: number };
type Contacts = ReadonlyMap<number, Contact>;

type Interaction = {
  move: (previous: Contacts, current: Contacts) => void;
  release?: (point: Contact) => void;
  cancel?: () => void;
  allowPinch: boolean;
};

const point = (e: PointerEvent): Contact => ({ x: e.clientX, y: e.clientY });

/** Native clicks own taps. Once movement or another contact wins, consume the
 * corresponding compatibility clicks, including a release over another control. */
function wordContacts(
  host: HTMLElement,
  start: (event: PointerEvent) => Interaction | undefined
) {
  const contacts = new Map<number, Contact>();
  const consumed = new Set<number>();
  let active: Interaction | undefined;
  let origin: Contact = { x: 0, y: 0 };
  let moved = false;
  const cancel = () => {
    for (const id of contacts.keys()) consumed.add(id);
    active?.cancel?.();
    active = undefined;
  };
  const down = (e: PointerEvent) => {
    consumed.delete(e.pointerId);
    if (!active && contacts.size === 0) {
      if (!e.isPrimary || e.button !== 0 || !host.contains(e.target as Node))
        return;
      active = start(e);
      if (!active) return;
      origin = point(e);
      moved = false;
    } else {
      moved = true;
      if (
        !active?.allowPinch ||
        contacts.size >= 2 ||
        !host.contains(e.target as Node)
      )
        cancel();
    }
    if (active && e.target instanceof Element && e.isTrusted)
      e.target.setPointerCapture(e.pointerId);
    contacts.set(e.pointerId, point(e));
    if (moved) for (const id of contacts.keys()) consumed.add(id);
  };
  const move = (e: PointerEvent) => {
    if (!contacts.has(e.pointerId) || !active) return;
    const next = point(e);
    if (!moved && Math.hypot(next.x - origin.x, next.y - origin.y) < 6) return;
    moved = true;
    consumed.add(e.pointerId);
    const previous = new Map(contacts);
    contacts.set(e.pointerId, next);
    active.move(previous, contacts);
  };
  const end = (e: PointerEvent) => {
    if (!contacts.has(e.pointerId)) return;
    if (e.type !== 'pointerup') cancel();
    contacts.delete(e.pointerId);
    if (contacts.size === 0) {
      if (moved) active?.release?.(point(e));
      active = undefined;
    }
  };
  const interrupt = () => {
    cancel();
    contacts.clear();
  };
  return { down, move, end, interrupt, consumed };
}

export function bindWordPointers(
  host: HTMLElement,
  start: (event: PointerEvent) => Interaction | undefined
): () => void {
  const { down, move, end, interrupt, consumed } = wordContacts(host, start);
  const doc = host.ownerDocument;
  const abort = new AbortController();
  const options = { capture: true, signal: abort.signal };
  doc.addEventListener('pointerdown', down, options);
  doc.addEventListener('pointermove', move, options);
  doc.addEventListener('pointerup', end, options);
  doc.addEventListener('pointercancel', end, options);
  doc.addEventListener('lostpointercapture', end, options);
  doc.addEventListener(
    'click',
    (e) => {
      if (e.detail === 0 || !consumed.has(e.pointerId)) return;
      e.preventDefault();
      e.stopImmediatePropagation();
    },
    options
  );
  doc.defaultView?.addEventListener('blur', interrupt, {
    signal: abort.signal,
  });
  doc.addEventListener(
    'visibilitychange',
    () => {
      if (doc.hidden) interrupt();
    },
    options
  );
  doc.addEventListener(
    'keydown',
    (e) => {
      if (e.key === 'Escape') interrupt();
    },
    options
  );
  return () => {
    interrupt();
    abort.abort();
  };
}
