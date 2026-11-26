import { t } from '@lingui/core/macro';
import type { JSX } from '@solidjs/web';
import { Button } from '../button/index';
import { StackHorizontal } from '../stack/index';

function middle(a: Contact, b: Contact): Contact {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

const distance = (a: Contact, b: Contact) => Math.hypot(a.x - b.x, a.y - b.y);

/** Scale the real grid's layout inside its native scrolling viewport. Browser
 * hit testing, sticky coordinates, and scrollbar clamping share that layout. */
export function bindWordNavigation(
  viewport: HTMLElement,
  board: HTMLElement,
  changed: (custom: boolean) => void
) {
  let scale = 1;
  let baseWidth = 0;
  const zoom = (from: Contact, to: Contact, ratio: number) => {
    const before = board.getBoundingClientRect();
    if (!baseWidth) {
      baseWidth = before.width;
      viewport.style.height = `${viewport.getBoundingClientRect().height}px`;
      board.style.width = `${baseWidth}px`;
    }
    const min = Math.min(
      1,
      viewport.clientWidth / baseWidth,
      viewport.clientHeight / (before.height / scale)
    );
    const next = Math.max(min, Math.min(3, scale * ratio));
    const growth = next / scale;
    scale = next;
    board.style.zoom = String(next);
    const after = board.getBoundingClientRect();
    viewport.scrollLeft += after.left + (from.x - before.left) * growth - to.x;
    viewport.scrollTop += after.top + (from.y - before.top) * growth - to.y;
    changed(true);
  };
  const reset = () => {
    scale = 1;
    baseWidth = 0;
    board.style.removeProperty('zoom');
    board.style.removeProperty('width');
    viewport.style.removeProperty('height');
    changed(false);
  };
  const stop = bindWordPointers(viewport, () => ({
    allowPinch: true,
    move(previous, current) {
      const [a, b] = [...previous.values()];
      const [c, d] = [...current.values()];
      if (!a || !c) return;
      if (b && d)
        zoom(
          middle(a, b),
          middle(c, d),
          distance(c, d) / Math.max(1, distance(a, b))
        );
      else {
        viewport.scrollLeft += a.x - c.x;
        viewport.scrollTop += a.y - c.y;
      }
    },
  }));
  const wheel = (e: WheelEvent) => {
    if (!e.ctrlKey) return;
    e.preventDefault();
    const anchor = { x: e.clientX, y: e.clientY };
    zoom(
      anchor,
      anchor,
      Math.exp(-Math.max(-100, Math.min(100, e.deltaY)) / 200)
    );
  };
  viewport.addEventListener('wheel', wheel, { passive: false });
  return {
    reset,
    dispose() {
      stop();
      viewport.removeEventListener('wheel', wheel);
    },
  };
}

/** Switch between the whole board and precise scrollable cells, keeping navigation guidance visible. */
export function WordTileViewControls(props: {
  enlarged: boolean;
  onChange: (enlarged: boolean) => void;
}): JSX.Element {
  return (
    <>
      <StackHorizontal gap="xs" wrap dataSet={{ 'view-controls': 'true' }}>
        <Button
          title={props.enlarged ? t`Fit` : t`Fit board`}
          aria-label={t`Fit board`}
          size={props.enlarged ? 'sm' : 'md'}
          variant={props.enlarged ? 'outline' : 'solid'}
          aria-pressed={!props.enlarged}
          onClick={() => props.onChange(false)}
        />
        <Button
          title={props.enlarged ? t`Enlarge` : t`Enlarge board`}
          aria-label={t`Enlarge board`}
          size={props.enlarged ? 'sm' : 'md'}
          variant={props.enlarged ? 'solid' : 'outline'}
          aria-pressed={props.enlarged}
          onClick={() => props.onChange(true)}
        />
      </StackHorizontal>
    </>
  );
}

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
