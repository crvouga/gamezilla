import {
  type TileBoardDirection,
  tileBoardSwipe,
} from '@pkgs/ui-root-client-ts/tile-board';
import { createEffect, onCleanup } from 'solid-js';
import { boardCamera, type Point, tileUnder } from './viewport';

type Play = {
  puzzle: () => object;
  columns: () => number;
  rows: () => number;
  step: (direction: TileBoardDirection) => void;
  tap: (index: number) => void;
};

type Contact = { origin: Point; point: Point; time: number; dragged: boolean };
const midpoint = (a: Point, b: Point) => ({
  x: (a.x + b.x) / 2,
  y: (a.y + b.y) / 2,
});
const distance = (a: Point, b: Point) => Math.hypot(b.x - a.x, b.y - a.y);
const center = { x: 0.5, y: 0.5 };

const pan: Record<string, Point> = {
  ArrowLeft: { x: 0.75, y: 0.5 },
  ArrowRight: { x: 0.25, y: 0.5 },
  ArrowUp: { x: 0.5, y: 0.75 },
  ArrowDown: { x: 0.5, y: 0.25 },
};

const factors: Record<string, number> = {
  '+': 1.5,
  '=': 1.5,
  '-': 1 / 1.5,
  '0': 0,
  Escape: 0,
};

const pixel = (event: PointerEvent | WheelEvent) => ({
  x: event.clientX,
  y: event.clientY,
});
class WarehouseInput {
  readonly activePointers = new Set<number>();
  readonly contacts = new Map<number, Contact>();
  readonly camera: ReturnType<typeof boardCamera>;
  inspecting = false;
  constructor(
    readonly board: HTMLElement,
    readonly play: Play
  ) {
    this.camera = boardCamera(board);
  }
  down = (event: PointerEvent) => {
    if (
      event.button !== 0 ||
      (event.target instanceof Element && event.target.closest('button'))
    )
      return;
    this.camera.measure();
    const point = pixel(event);
    this.contacts.set(event.pointerId, {
      origin: point,
      point,
      time: event.timeStamp,
      dragged: false,
    });
    this.inspecting ||= this.activePointers.size > 1 || this.contacts.size > 1;
    this.board.setPointerCapture(event.pointerId);
  };
  move = (event: PointerEvent) => {
    const contact = this.contacts.get(event.pointerId);
    if (!contact) return;
    const previous = contact.point;
    contact.point = pixel(event);
    contact.dragged ||= distance(contact.point, contact.origin) >= 8;
    const [a, b] = this.contacts.values();
    if (a && b && (contact === a || contact === b)) {
      const other = contact === a ? b.point : a.point;
      const span = distance(previous, other);
      if (span > 0)
        this.camera.move(
          this.camera.point(midpoint(previous, other)),
          this.camera.point(midpoint(contact.point, other)),
          distance(contact.point, other) / span
        );
    } else if (
      this.contacts.size === 1 &&
      this.camera.read().scale > 1 &&
      (this.inspecting || contact.dragged)
    ) {
      const from = this.inspecting ? previous : contact.origin;
      this.inspecting = true;
      this.camera.move(
        this.camera.point(from),
        this.camera.point(contact.point),
        1
      );
    }
  };
  release = (event: PointerEvent) => {
    const contact = this.contacts.get(event.pointerId);
    if (!contact) return;
    const wasInspecting = this.inspecting;
    this.contacts.delete(event.pointerId);
    if (this.contacts.size === 0) this.inspecting = false;
    if (this.board.hasPointerCapture(event.pointerId))
      this.board.releasePointerCapture(event.pointerId);
    if (!wasInspecting) this.finishStep(contact, event);
  };
  finishStep(contact: Contact, event: PointerEvent) {
    const end = pixel(event);
    const travelled = distance(contact.origin, end);
    const held = event.timeStamp - contact.time >= 450;
    if (!contact.dragged && travelled < 8 && held) {
      const anchor = this.camera.point(end);
      this.camera.move(anchor, anchor, this.camera.read().scale > 1 ? 0 : 2);
      return;
    }
    const direction = tileBoardSwipe(
      end.x - contact.origin.x,
      end.y - contact.origin.y
    );
    if (direction && this.camera.read().scale === 1)
      return this.play.step(direction);
    if (contact.dragged || travelled >= 8) return;
    const index = tileUnder(
      this.camera.read(),
      this.camera.point(end),
      this.play.columns(),
      this.play.rows()
    );
    if (index !== null) this.play.tap(index);
  }
  cancel = (event: PointerEvent) => {
    if (this.contacts.delete(event.pointerId))
      this.inspecting = this.contacts.size > 0;
  };
  wheel = (event: WheelEvent) => {
    if (!event.ctrlKey && this.camera.read().scale === 1) return;
    event.preventDefault();
    this.inspecting ||= this.contacts.size > 0;
    const box = this.camera.measure();
    const unit =
      event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? box.height : 1;
    const anchor = this.camera.point(pixel(event));
    if (event.ctrlKey)
      this.camera.move(anchor, anchor, Math.exp((-event.deltaY * unit) / 240));
    else
      this.camera.move(
        center,
        {
          x: center.x - (event.deltaX * unit) / box.width,
          y: center.y - (event.deltaY * unit) / box.height,
        },
        1
      );
  };
  key = (event: KeyboardEvent) => {
    if (event.ctrlKey || event.altKey || event.metaKey) return;

    const target =
      event.shiftKey && this.camera.read().scale > 1 && pan[event.key];
    if (target) {
      event.preventDefault();
      event.stopImmediatePropagation();
      this.inspecting ||= this.contacts.size > 0;
      this.camera.move(center, target, 1);
      return;
    }

    const factor = factors[event.key];
    if (factor === undefined) return;
    event.preventDefault();
    this.inspecting ||= this.contacts.size > 0;
    this.camera.move(center, center, factor);
  };
  resetContacts = () => {
    this.activePointers.clear();
    this.contacts.clear();
    this.inspecting = false;
  };
  register = (event: PointerEvent) => {
    this.activePointers.add(event.pointerId);
    if (this.contacts.size && this.activePointers.size > 1)
      this.inspecting = true;
  };
  unregister = (event: PointerEvent) => {
    this.activePointers.delete(event.pointerId);
  };
  fit() {
    this.resetContacts();
    if (this.camera.read().scale !== 1) this.camera.move(center, center, 0);
  }
  bind() {
    const abort = new AbortController();
    const options = { signal: abort.signal };
    this.board.addEventListener(
      'contextmenu',
      (event) => {
        if (this.contacts.size > 0) event.preventDefault();
      },
      options
    );
    this.board.addEventListener('pointerdown', this.down, options);
    this.board.addEventListener('pointermove', this.move, options);
    this.board.addEventListener('pointerup', this.release, options);
    this.board.addEventListener('pointercancel', this.cancel, options);
    this.board.addEventListener('lostpointercapture', this.cancel, options);
    this.board.addEventListener('wheel', this.wheel, {
      ...options,
      passive: false,
    });
    this.board.addEventListener('keydown', this.key, {
      ...options,
      capture: true,
    });
    this.board.ownerDocument.defaultView?.addEventListener(
      'blur',
      this.resetContacts,
      options
    );
    this.board.ownerDocument.addEventListener(
      'visibilitychange',
      this.resetContacts,
      options
    );
    const capture = { ...options, capture: true };
    this.board.ownerDocument.addEventListener(
      'pointerdown',
      this.register,
      capture
    );
    this.board.ownerDocument.addEventListener(
      'pointerup',
      this.unregister,
      capture
    );
    this.board.ownerDocument.addEventListener(
      'pointercancel',
      this.unregister,
      capture
    );
    this.board.ownerDocument.defaultView?.addEventListener(
      'resize',
      this.resetContacts,
      options
    );
    return () => abort.abort();
  }
}

/** Installs one input owner on the playable board and releases its listeners at unmount. */
export function useWarehouseGestures(play: Play) {
  let dispose: (() => void) | undefined;
  let current: WarehouseInput | undefined;
  createEffect(play.puzzle, () => current?.fit());
  createEffect(
    () => `${play.columns()}x${play.rows()}`,
    () => current?.fit()
  );
  onCleanup(() => dispose?.());
  function bind(board: HTMLElement) {
    dispose?.();
    current = new WarehouseInput(board, play);
    dispose = current.bind();
  }
  return {
    bind,
    fit: () => {
      current?.fit();
      current?.board.focus();
    },
  };
}
