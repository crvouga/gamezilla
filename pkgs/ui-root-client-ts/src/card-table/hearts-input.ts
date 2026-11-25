import { createSignal, onSettled } from 'solid-js';

type Point = { x: number; y: number };
type Contact = { at: Point; felt: boolean };
type Pickup = {
  card: HTMLButtonElement;
  start: Point;
  position: string | undefined;
};
type View = Point & { scale: number };

const fit: View = { x: 0, y: 0, scale: 1 };
const point = (e: PointerEvent | WheelEvent): Point => ({
  x: e.clientX,
  y: e.clientY,
});
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const middle = (a: Point, b: Point) => ({
  x: (a.x + b.x) / 2,
  y: (a.y + b.y) / 2,
});
const clamp = (n: number, low: number, high: number) =>
  Math.min(high, Math.max(low, n));

/** Offsets are fractions of the fitted box, so resize keeps each edge bounded. */
function lens() {
  const [view, set] = createSignal<View>(fit);
  function move(rect: DOMRect, from: Point, to: Point, factor: number) {
    if (!rect.width || !rect.height) return;
    set((old) => {
      const scale = clamp(old.scale * factor, 1, 3);
      const ratio = scale / old.scale;
      const x = (to.x - rect.left - (from.x - rect.left) * ratio) / rect.width;
      const y = (to.y - rect.top - (from.y - rect.top) * ratio) / rect.height;
      return {
        scale,
        x: clamp(old.x * ratio + x, 1 - scale, 0),
        y: clamp(old.y * ratio + y, 1 - scale, 0),
      };
    });
  }
  return { view, move, reset: () => set(fit) };
}

type Lens = ReturnType<typeof lens>;
function contactsOnFelt(contacts: Map<number, Contact>) {
  const [a, b] = contacts.values();
  return contacts.size === 2 && a?.felt && b?.felt
    ? { a: a.at, b: b.at }
    : null;
}

class TableContacts {
  constructor(
    private readonly root: HTMLElement,
    private readonly camera: Lens
  ) {}
  readonly contacts = new Map<number, Contact>();
  pickup: Pickup | undefined;
  suppress = false;
  viewport() {
    return this.root.querySelector<HTMLElement>('[data-hearts-viewport]');
  }
  restore() {
    this.pickup?.card.style.removeProperty('translate');
    this.pickup?.card.removeAttribute('data-picked-up');
    this.root.removeAttribute('data-dragging');
    this.pickup = undefined;
  }
  cancel() {
    this.restore();
    this.contacts.clear();
    this.suppress = true;
  }
  down(e: PointerEvent) {
    if (e.button !== 0 || !(e.target instanceof Element)) return;
    if (!this.contacts.size && !this.root.contains(e.target)) return;
    const at = point(e);
    if (this.camera.view().scale > 1 && this.viewport()?.contains(e.target))
      e.target.setPointerCapture(e.pointerId);
    this.contacts.set(e.pointerId, {
      at,
      felt: !!this.viewport()?.contains(e.target),
    });
    if (this.contacts.size > 1 || !e.isPrimary) {
      this.restore();
      this.suppress = true;
      return;
    }
    this.suppress = false;
    const card = e.target.closest<HTMLButtonElement>('button[data-card]');
    if (
      card &&
      this.root.contains(card) &&
      card.getAttribute('aria-disabled') !== 'true'
    ) {
      this.pickup = {
        card,
        start: at,
        position: this.root.dataset['position'],
      };
    }
  }
  move(e: PointerEvent) {
    const contact = this.contacts.get(e.pointerId);
    if (!contact) return;
    const old = contact.at;
    const pair = contactsOnFelt(this.contacts);
    contact.at = point(e);
    const next = contactsOnFelt(this.contacts);
    const rect = contact.felt
      ? this.viewport()?.getBoundingClientRect()
      : undefined;
    if (rect && pair && next) {
      const span = distance(pair.a, pair.b);
      if (span > 0)
        this.camera.move(
          rect,
          middle(pair.a, pair.b),
          middle(next.a, next.b),
          distance(next.a, next.b) / span
        );
    } else if (
      rect &&
      this.contacts.size === 1 &&
      contact.felt &&
      this.camera.view().scale > 1
    ) {
      this.camera.move(rect, old, contact.at, 1);
      this.suppress = true;
    } else if (
      this.pickup &&
      (this.suppress || distance(this.pickup.start, contact.at) >= 8)
    ) {
      if (!this.suppress) this.pickup.card.setPointerCapture(e.pointerId);
      this.suppress = true;
      this.pickup.card.dataset['pickedUp'] = 'true';
      this.root.dataset['dragging'] = 'true';
      this.pickup.card.style.translate = `${contact.at.x - this.pickup.start.x}px ${contact.at.y - this.pickup.start.y}px`;
    }
  }
  up(e: PointerEvent) {
    if (!this.contacts.delete(e.pointerId)) return;
    const card = this.pickup?.card;
    const rect =
      card && this.suppress
        ? this.viewport()?.getBoundingClientRect()
        : undefined;
    const drop =
      card &&
      this.pickup &&
      this.suppress &&
      this.pickup.position === this.root.dataset['position'] &&
      rect &&
      e.clientX >= rect.left &&
      e.clientX < rect.right &&
      e.clientY >= rect.top &&
      e.clientY < rect.bottom;
    this.restore();
    if (
      drop &&
      this.root.contains(card) &&
      card.getAttribute('aria-pressed') !== 'true' &&
      card.getAttribute('aria-disabled') !== 'true'
    )
      card.click();
  }
}

function tableInput(root: HTMLElement, camera: Lens, signal: AbortSignal) {
  const win = root.ownerDocument.defaultView;
  if (!win) return;
  const input = new TableContacts(root, camera);
  signal.addEventListener('abort', () => input.cancel(), { once: true });
  listen({
    root,
    win,
    signal,
    down: (e) => input.down(e),
    move: (e) => input.move(e),
    up: (e) => input.up(e),
    cancel: () => input.cancel(),
    suppress: () => input.suppress,
  });
  const wheel = (e: WheelEvent) => {
    const box = input.viewport();
    if (!box || !(e.target instanceof Node) || !box.contains(e.target)) return;
    if (!e.ctrlKey && camera.view().scale === 1) return;
    e.preventDefault();
    const at = point(e);
    const unit =
      e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? box.clientHeight : 1;
    const to = e.ctrlKey
      ? at
      : { x: at.x - e.deltaX * unit, y: at.y - e.deltaY * unit };
    camera.move(
      box.getBoundingClientRect(),
      at,
      to,
      e.ctrlKey ? Math.exp((-e.deltaY * unit) / 300) : 1
    );
  };
  root.addEventListener('wheel', wheel, { signal, passive: false });
}

type Handlers = {
  root: HTMLElement;
  win: Window;
  signal: AbortSignal;
  down(e: PointerEvent): void;
  move(e: PointerEvent): void;
  up(e: PointerEvent): void;
  cancel(): void;
  suppress(): boolean;
};
function listen(h: Handlers) {
  const options = { capture: true, signal: h.signal };
  h.root.ownerDocument.addEventListener('pointerdown', h.down, options);
  h.root.ownerDocument.addEventListener('pointermove', h.move, options);
  h.root.ownerDocument.addEventListener('pointerup', h.up, options);
  h.root.ownerDocument.addEventListener('pointercancel', h.cancel, options);
  h.root.addEventListener(
    'lostpointercapture',
    (e) => {
      if (e.buttons) h.cancel();
    },
    options
  );
  h.win.addEventListener('blur', h.cancel, { signal: h.signal });
  h.root.ownerDocument.addEventListener('visibilitychange', h.cancel, options);
  h.win.addEventListener(
    'keydown',
    (e) => {
      if (e.key === 'Escape') h.cancel();
    },
    options
  );
  h.root.addEventListener(
    'click',
    (e) => {
      if (h.suppress() && e.detail > 0) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    },
    options
  );
}

export function createHeartsInput() {
  const camera = lens();
  let root: HTMLElement | undefined;
  onSettled(() => {
    if (!root) return undefined;
    const controller = new AbortController();
    tableInput(root, camera, controller.signal);
    root.addEventListener('keydown', keys, { signal: controller.signal });
    return () => controller.abort();
  });
  function toggle() {
    if (camera.view().scale > 1) {
      camera.reset();
      return;
    }
    const box = root?.querySelector<HTMLElement>('[data-hearts-viewport]');
    const rect = box?.getBoundingClientRect();
    if (!rect?.width) return;
    const center = {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };
    camera.move(rect, center, center, 2);
  }
  function keys(e: KeyboardEvent) {
    if (camera.view().scale === 1) return;
    if (e.key === 'Escape') {
      camera.reset();
      return;
    }
    const rect = root
      ?.querySelector('[data-hearts-viewport]')
      ?.getBoundingClientRect();
    if (
      !rect ||
      !(e.target instanceof Element) ||
      !e.target.closest('[data-hearts-navigation]')
    )
      return;
    const step: Record<string, Point> = {
      ArrowLeft: { x: 48, y: 0 },
      ArrowRight: { x: -48, y: 0 },
      ArrowUp: { x: 0, y: 48 },
      ArrowDown: { x: 0, y: -48 },
    };
    const delta = step[e.key];
    if (delta) {
      e.preventDefault();
      camera.move(rect, fit, delta, 1);
    }
  }
  return {
    view: camera.view,
    toggle,
    bind: (element: HTMLElement) => {
      root = element;
    },
  };
}
