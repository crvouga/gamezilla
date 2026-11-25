import type { Timers } from '@pkgs/clock-shared-ts/types';
import { type Camera, CENTER, FIT, type Point, reframe, span } from './camera';

type Options = {
  readonly cancelPlay: () => void;
  readonly mayInspect: () => boolean;
  readonly mayHold: () => boolean;
  readonly timers: Timers;
  readonly read: (point: Point) => void;
  readonly paint: (view: Camera) => void;
};

function consume(event: Event) {
  event.preventDefault();
  event.stopImmediatePropagation();
}

export class InspectionGesture {
  private view = FIT;
  private readonly pointers = new Map<number, Point>();
  private claimed = false;
  private hold: unknown;
  private tracking: AbortController | undefined;
  private readonly listeners = new AbortController();

  constructor(
    private readonly viewport: HTMLElement,
    private readonly opts: Options
  ) {
    const capture = { capture: true, signal: this.listeners.signal };
    viewport.addEventListener('pointerdown', this.down, capture);
    viewport.addEventListener('wheel', this.wheel, {
      ...capture,
      passive: false,
    });
    viewport.addEventListener('keydown', this.key, capture);
    const win = viewport.ownerDocument.defaultView;
    viewport.addEventListener('lostpointercapture', this.lost, capture);
    win?.addEventListener('blur', this.interrupt, capture);
    viewport.ownerDocument.addEventListener(
      'visibilitychange',
      this.interrupt,
      capture
    );
  }

  private track() {
    if (this.tracking) return;
    this.tracking = new AbortController();
    const capture = { capture: true, signal: this.tracking.signal };
    this.viewport.addEventListener('pointermove', this.move, capture);
    this.viewport.addEventListener('pointerup', this.end, capture);
    this.viewport.addEventListener('pointercancel', this.end, capture);
  }

  private untrack() {
    this.tracking?.abort();
    this.tracking = undefined;
  }

  private clearHold() {
    if (this.hold === undefined) return;
    this.opts.timers.clearTimeout(this.hold);
    this.hold = undefined;
  }

  private readonly interrupt = () => {
    this.clearHold();
    this.pointers.clear();
    this.untrack();
    this.claimed = false;
    this.opts.cancelPlay();
  };

  dispose() {
    this.listeners.abort();
    this.untrack();
    this.clearHold();
  }

  fit = () => {
    this.paint(FIT);
    this.viewport
      .querySelector<HTMLElement>('[role="application"]')
      ?.focus({ preventScroll: true });
  };

  private paint(view: Camera) {
    this.view = view;
    this.opts.paint(view);
  }

  private point(p: Point, rect = this.viewport.getBoundingClientRect()): Point {
    const width = rect.width || 1;
    return { x: (p.x - rect.left) / width, y: (p.y - rect.top) / width };
  }

  private claim() {
    this.clearHold();
    if (!this.claimed) this.opts.cancelPlay();
    this.claimed = true;
    for (const id of this.pointers.keys()) {
      try {
        this.viewport.setPointerCapture(id);
      } catch {
        /* Synthetic pointer. */
      }
    }
  }

  private readonly down = (e: PointerEvent) => {
    if (
      !this.opts.mayInspect() ||
      (e.target instanceof Element && e.target.closest('[data-chess-fit]'))
    )
      return;
    if (e.pointerType !== 'touch' && this.view.scale === 1 && e.button !== 1)
      return;
    const point = { x: e.clientX, y: e.clientY };
    this.clearHold();
    this.track();
    this.pointers.set(e.pointerId, point);
    if (
      this.pointers.size === 1 &&
      this.view.scale === 1 &&
      e.button === 0 &&
      !this.claimed
    ) {
      this.hold = this.opts.timers.setTimeout(() => {
        if (!this.opts.mayHold()) return;
        this.claim();
        const anchor = this.point(point);
        this.paint(reframe(this.view, anchor, anchor, 2));
      }, 550);
      return;
    }
    consume(e);
    this.claim();
    if (e.button === 1 && this.view.scale === 1) {
      const anchor = this.point(point);
      this.paint(reframe(this.view, anchor, anchor, 2));
    }
  };

  private readonly move = (e: PointerEvent) => {
    const old = this.pointers.get(e.pointerId);
    if (!old) return;
    if (!this.claimed) {
      if (Math.hypot(e.clientX - old.x, e.clientY - old.y) > 4)
        this.clearHold();
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      return;
    }
    consume(e);
    const before = span(this.pointers);
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const after = span(this.pointers);
    if (!before || !after) return;
    const rect = this.viewport.getBoundingClientRect();
    const zoom =
      before.distance && after.distance ? after.distance / before.distance : 1;
    this.paint(
      reframe(
        this.view,
        this.point(before.center, rect),
        this.point(after.center, rect),
        zoom
      )
    );
  };

  private readonly end = (e: PointerEvent) => {
    if (!this.pointers.delete(e.pointerId)) return;
    this.clearHold();
    if (this.claimed) {
      consume(e);
      if (this.view.scale > 1 && e.type === 'pointerup') {
        const at = this.point({ x: e.clientX, y: e.clientY });
        this.opts.read({
          x: (at.x - this.view.x) / this.view.scale,
          y: (at.y - this.view.y) / this.view.scale,
        });
      }
    }
    if (this.pointers.size === 0) {
      this.claimed = false;
      this.untrack();
    }
  };

  private readonly lost = (e: PointerEvent) => {
    // A pinch transfers capture from the playing board to its viewport.
    if (e.target === this.viewport || !this.claimed) this.end(e);
  };

  private readonly wheel = (e: WheelEvent) => {
    if (!this.opts.mayInspect() || (!e.ctrlKey && this.view.scale === 1))
      return;
    consume(e);
    this.opts.cancelPlay();
    const unit =
      e.deltaMode === 1
        ? 16
        : e.deltaMode === 2
          ? this.viewport.clientWidth
          : 1;
    const anchor = this.point({ x: e.clientX, y: e.clientY });
    const to = e.ctrlKey
      ? anchor
      : this.point({
          x: e.clientX - e.deltaX * unit,
          y: e.clientY - e.deltaY * unit,
        });
    this.paint(
      reframe(
        this.view,
        anchor,
        to,
        e.ctrlKey ? Math.exp((-e.deltaY * unit) / 320) : 1
      )
    );
  };

  private readonly key = (e: KeyboardEvent) => {
    if (!this.opts.mayInspect() || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === '+' || e.key === '=') {
      consume(e);
      this.opts.cancelPlay();
      this.paint(reframe(this.view, CENTER, CENTER, 1.5));
    } else if (this.view.scale > 1) {
      this.navigate(e);
    }
  };

  private navigate(e: KeyboardEvent) {
    if (e.key === 'Escape' || e.key === '0') {
      consume(e);
      this.fit();
    } else if (e.key === '-') {
      consume(e);
      this.paint(reframe(this.view, CENTER, CENTER, 1 / 1.5));
    } else if (e.key.startsWith('Arrow')) {
      consume(e);
      const x = Number(e.key === 'ArrowLeft') - Number(e.key === 'ArrowRight');
      const y = Number(e.key === 'ArrowUp') - Number(e.key === 'ArrowDown');
      this.paint(
        reframe(
          this.view,
          CENTER,
          { x: CENTER.x + x / 4, y: CENTER.y + y / 4 },
          1
        )
      );
    }
  }
}
