import type { JSX } from '@solidjs/web';
import { createEffect, createSignal } from 'solid-js';
import { observeElementResize } from '../observe-element-resize';
import styles from './disc-drop-board.module.css';
import type { DiscDropBoardProps } from './index';

type RackViewportProps = {
  board: DiscDropBoardProps;
  enabled: boolean;
  preview: (column: number | null) => void;
  inspect: (value: boolean) => void;
  register: (toggle: () => void) => void;
  commit: (column: number) => void;
  children: JSX.Element;
};
type Point = { x: number; y: number };
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const middle = (a: Point, b: Point) => ({
  x: (a.x + b.x) / 2,
  y: (a.y + b.y) / 2,
});
const clamp = (n: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, n));

/** Magnification lives on the columns; the instruction and fit control stay reachable. */
function rackCamera(frame: HTMLElement, props: RackViewportProps) {
  let scale = 1;
  let x = 0;
  let y = 0;
  function move(from: Point, to: Point, factor: number) {
    const rect = frame.getBoundingClientRect();
    const next = clamp(scale * factor, 1, 3);
    const ratio = next / scale;
    x = clamp(
      to.x - rect.left - (from.x - rect.left - x) * ratio,
      rect.width * (1 - next),
      0
    );
    y = clamp(
      to.y - rect.top - (from.y - rect.top - y) * ratio,
      rect.height * (1 - next),
      0
    );
    scale = next;
    frame.style.setProperty(
      '--rack-transform',
      `translate(${x}px,${y}px) scale(${scale})`
    );
    frame.dataset['zoom'] = String(scale);
    props.inspect(scale > 1);
  }
  function toggle() {
    const rect = frame.getBoundingClientRect();
    const center = {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };
    move(center, center, scale === 1 ? 2 : 1 / scale);
  }
  return { move, toggle, enlarged: () => scale > 1 };
}

function rackColumnAt(frame: HTMLElement, event: PointerEvent) {
  const node = frame.ownerDocument
    .elementFromPoint(event.clientX, event.clientY)
    ?.closest<HTMLElement>('[data-column]');
  return node && frame.contains(node) ? Number(node.dataset['column']) : null;
}

function moveContact(
  event: PointerEvent,
  contacts: Map<number, Point>,
  camera: ReturnType<typeof rackCamera>
) {
  const previous = contacts.get(event.pointerId);
  if (!previous) return;
  const point = { x: event.clientX, y: event.clientY };
  contacts.set(event.pointerId, point);
  const other = [...contacts].find(([id]) => id !== event.pointerId)?.[1];
  if (other) {
    const oldDistance = distance(previous, other);
    if (oldDistance > 0)
      camera.move(
        middle(previous, other),
        middle(point, other),
        distance(point, other) / oldDistance
      );
  } else if (camera.enlarged()) camera.move(previous, point, 1);
}

function verticalSwipe(origin: Point, event: PointerEvent) {
  const dy = Math.abs(event.clientY - origin.y);
  return dy > 12 && dy > 2 * Math.abs(event.clientX - origin.x);
}
function rackPointers(frame: HTMLElement, props: RackViewportProps) {
  const camera = rackCamera(frame, props);
  const contacts = new Map<number, Point>();
  let aim: { column: number; cells: readonly number[]; origin: Point } | null =
    null;
  let suppressClick = false;
  const cancel = () => {
    aim = null;
    suppressClick = true;
    props.preview(null);
  };
  function down(event: PointerEvent) {
    // Only hardware pointers have a browser capture session. Programmatic
    // activation and assistive clicks use the column button directly.
    if (!event.isTrusted || event.button !== 0) return;
    const column = rackColumnAt(frame, event);
    const playable =
      contacts.size === 0 &&
      event.isPrimary &&
      !camera.enlarged() &&
      props.board.interactive;
    cancel();
    contacts.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (playable && column !== null) {
      aim = {
        column,
        cells: props.board.cells,
        origin: { x: event.clientX, y: event.clientY },
      };
      props.preview(column);
      frame.dataset['aiming'] = 'true';
    } else delete frame.dataset['aiming'];
    const target =
      event.target instanceof Element
        ? event.target.closest('[data-column]')
        : null;
    (target ?? frame).setPointerCapture(event.pointerId);
  }
  function up(event: PointerEvent) {
    if (!contacts.delete(event.pointerId)) return;
    const start = aim;
    const column = rackColumnAt(frame, event);
    cancel();
    delete frame.dataset['aiming'];
    if (
      !start ||
      column === null ||
      start.cells !== props.board.cells ||
      !props.board.interactive ||
      camera.enlarged()
    )
      return;
    props.preview(column);
    if (column === start.column) suppressClick = false;
    else props.commit(column);
  }
  function interrupt() {
    contacts.clear();
    cancel();
    delete frame.dataset['aiming'];
  }
  return {
    down,
    move(event: PointerEvent) {
      if (!contacts.has(event.pointerId)) return;
      moveContact(event, contacts, camera);
      if (aim && verticalSwipe(aim.origin, event)) {
        cancel();
        delete frame.dataset['aiming'];
      }
      if (aim) props.preview(rackColumnAt(frame, event) ?? -1);
    },
    up,
    interrupt,
    contacts,
    camera,
    suppress: () => suppressClick,
  };
}

function arrowPan(key: string): Point {
  return {
    x: key === 'ArrowLeft' ? 48 : key === 'ArrowRight' ? -48 : 0,
    y: key === 'ArrowUp' ? 48 : key === 'ArrowDown' ? -48 : 0,
  };
}

function bindRackNavigation(
  frame: HTMLElement,
  p: ReturnType<typeof rackPointers>,
  options: AddEventListenerOptions
) {
  frame.addEventListener(
    'wheel',
    (event) => {
      if (!event.ctrlKey && !p.camera.enlarged()) return;
      event.preventDefault();
      p.interrupt();
      const anchor = { x: event.clientX, y: event.clientY };
      if (event.ctrlKey)
        p.camera.move(anchor, anchor, Math.exp(-event.deltaY / 300));
      else
        p.camera.move(
          anchor,
          { x: anchor.x - event.deltaX, y: anchor.y - event.deltaY },
          1
        );
    },
    { ...options, passive: false }
  );
  frame.addEventListener(
    'keydown',
    (event) => {
      if (
        event.key.toLowerCase() === 'i' &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey &&
        !event.repeat
      ) {
        p.interrupt();
        p.camera.toggle();
        event.preventDefault();
        return;
      }
      if (event.key === 'Escape') {
        p.interrupt();
        if (p.camera.enlarged()) p.camera.toggle();
      }
      if (!p.camera.enlarged() || !event.key.startsWith('Arrow')) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      p.camera.move({ x: 0, y: 0 }, arrowPan(event.key), 1);
    },
    { ...options, capture: true }
  );
}
function bindRack(frame: HTMLElement, props: RackViewportProps) {
  const p = rackPointers(frame, props);
  const abort = new AbortController();
  const options = { signal: abort.signal };
  props.register(() => {
    p.interrupt();
    p.camera.toggle();
  });
  frame.addEventListener('pointerdown', p.down, options);
  frame.addEventListener('pointermove', p.move, options);
  frame.addEventListener('pointerup', p.up, options);
  frame.addEventListener('pointercancel', p.interrupt, options);
  frame.addEventListener(
    'lostpointercapture',
    (event) => {
      if (p.contacts.has(event.pointerId)) p.interrupt();
    },
    options
  );
  frame.addEventListener(
    'click',
    (event) => {
      if (p.camera.enlarged() || (event.detail > 0 && p.suppress())) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    },
    { ...options, capture: true }
  );
  bindRackNavigation(frame, p, options);
  const win = frame.ownerDocument.defaultView;
  win?.addEventListener('blur', p.interrupt, options);
  win?.addEventListener(
    'pointerdown',
    (event) => {
      if (
        p.contacts.size &&
        event.target instanceof Node &&
        !frame.contains(event.target)
      )
        p.interrupt();
    },
    { ...options, capture: true }
  );
  const stopResize = observeElementResize(frame, () => {
    if (p.camera.enlarged()) p.camera.move({ x: 0, y: 0 }, { x: 0, y: 0 }, 1);
  });

  return () => {
    abort.abort();
    stopResize();
  };
}

export function RackViewport(props: RackViewportProps): JSX.Element {
  const [frame, setFrame] = createSignal<HTMLDivElement>();
  createEffect(
    () => (props.enabled ? frame() : undefined),
    (element) => (element ? bindRack(element, props) : undefined)
  );
  return (
    <div
      ref={setFrame}
      data-gestures={props.enabled ? 'true' : undefined}
      class={styles['viewport']}
    >
      <div class={styles['plane']}>{props.children}</div>
    </div>
  );
}
