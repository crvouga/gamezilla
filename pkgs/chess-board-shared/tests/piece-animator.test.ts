import { describe, expect, test } from 'bun:test';
import type { AnimateTransform } from '@pkgs/chess-board-shared/board-motion';
import { createPieceAnimator, translateOfMatrix } from '@pkgs/chess-board-shared/piece-animator';
import { assertProperty } from '@pkgs/property-shared/assert-property';
import fc from 'fast-check';

type Slide = {
  readonly from: string;
  readonly to: string;
  readonly durationMs: number;
  left: number;
  state: 'running' | 'finished' | 'cancelled';
  finish?: () => void;
};

/** Web Animations stand-in: slides finish when the test advances time. */
function createFakeAnimate() {
  const slides: Slide[] = [];
  const animate: AnimateTransform = (_element, from, to, durationMs) => {
    const slide: Slide = {
      from,
      to,
      durationMs,
      left: durationMs,
      state: 'running',
    };
    slides.push(slide);
    return {
      cancel: () => {
        if (slide.state === 'running') slide.state = 'cancelled';
      },
      onFinish: (callback) => {
        slide.finish = callback;
      },
    };
  };
  const advance = (ms: number): void => {
    for (const slide of slides) {
      if (slide.state !== 'running') continue;
      slide.left -= ms;
      if (slide.left > 0) continue;
      slide.state = 'finished';
      slide.finish?.();
    }
  };
  const running = () => slides.filter((s) => s.state === 'running');
  return { animate, advance, slides, running };
}

const cell = (i: number) =>
  `translate(${(i % 8) * 100}%, ${Math.floor(i / 8) * 100}%)`;

type Op =
  | { readonly kind: 'place'; readonly cell: number; readonly slide: boolean }
  | { readonly kind: 'grab' }
  | { readonly kind: 'drag'; readonly x: number; readonly y: number }
  | { readonly kind: 'release'; readonly slide: boolean }
  | { readonly kind: 'advance'; readonly ms: number };

const op: fc.Arbitrary<Op> = fc.oneof(
  fc.record({
    kind: fc.constant('place' as const),
    cell: fc.integer({ min: 0, max: 63 }),
    slide: fc.boolean(),
  }),
  fc.constant({ kind: 'grab' as const }),
  fc.record({
    kind: fc.constant('drag' as const),
    x: fc.integer({ min: -50, max: 400 }),
    y: fc.integer({ min: -50, max: 400 }),
  }),
  fc.record({ kind: fc.constant('release' as const), slide: fc.boolean() }),
  fc.record({
    kind: fc.constant('advance' as const),
    ms: fc.integer({ min: 1, max: 200 }),
  })
);

/**
 * Reference model: one piece, the place it should rest, and whether a drag
 * holds it. Each step drives the real animator and checks it against this.
 */
class AnimatorModel {
  private readonly fake = createFakeAnimate();
  private readonly el = document.createElement('div');
  private readonly animator = createPieceAnimator({
    animate: () => this.fake.animate,
    // Mid-flight the piece is painted somewhere on the way: a fixed marker.
    paintedTransform: () => 'translate(12.5%, 12.5%)',
  });
  private resting: string | undefined;
  private grabbed = false;

  step(o: Op): void {
    if (o.kind === 'place') this.place(o.cell, o.slide);
    else if (o.kind === 'grab') this.grab();
    else if (o.kind === 'drag') this.drag(o.x, o.y);
    else if (o.kind === 'release') this.release(o.slide);
    else this.fake.advance(o.ms);
    this.check();
  }

  private place(target: number, slide: boolean): void {
    const before = this.el.style.transform;
    const started = this.fake.slides.length;
    this.resting = cell(target);
    this.animator.place(this.el, this.resting, { slide, durationMs: 150 });
    // The pointer owns a grabbed piece: placement never moves it.
    if (this.grabbed) expect(this.el.style.transform).toBe(before);
    if (!slide) expect(this.fake.slides.length).toBe(started);
  }

  private grab(): void {
    if (this.resting === undefined) return;
    this.animator.grab(this.el);
    this.grabbed = true;
    expect(this.fake.running()).toHaveLength(0);
  }

  private drag(x: number, y: number): void {
    if (!this.grabbed) return;
    this.el.style.transform = `translate(${x}px, ${y}px)`;
  }

  private release(slide: boolean): void {
    this.animator.release(this.el, { slide, durationMs: 90 });
    this.grabbed = false;
  }

  private check(): void {
    // At most one slide per piece, and it heads for the resting place.
    const running = this.fake.running();
    expect(running.length).toBeLessThanOrEqual(1);
    for (const s of running) {
      expect(s.to).toBe(this.resting ?? '');
      expect(s.from).not.toBe(s.to);
    }
    if (this.grabbed || this.resting === undefined) return;
    expect(this.el.style.transform).toBe(this.resting);
    expect(this.animator.restingOf(this.el)).toBe(this.resting);
  }
}

describe('createPieceAnimator', () => {
  test('a cancelled completion cannot retarget a newer arrival or erase its handle', () => {
    const fake = createFakeAnimate();
    const animator = createPieceAnimator({
      animate: () => fake.animate,
      paintedTransform: () => 'translate(20px, 20px)',
    });
    const el = document.createElement('div');
    animator.place(el, cell(0), { slide: false, durationMs: 150 });
    animator.place(el, cell(8), { slide: true, durationMs: 150 });
    animator.place(el, cell(16), { slide: true, durationMs: 150 });
    fake.slides[0]?.finish?.();
    expect(el.style.transform).toBe(cell(16));
    expect(fake.running()).toHaveLength(1);
    animator.grab(el);
    expect(fake.running()).toHaveLength(0);
  });

  test('a piece always ends up resting where it was last placed', () => {
    assertProperty(
      'piece-animator-model',
      fc.property(fc.array(op, { maxLength: 40 }), (ops) => {
        const model = new AnimatorModel();
        for (const o of ops) model.step(o);
      })
    );
  });

  test('a move landing mid-slide retargets from the painted position', () => {
    const fake = createFakeAnimate();
    const animator = createPieceAnimator({
      animate: () => fake.animate,
      paintedTransform: () => 'matrix(1, 0, 0, 1, 37.5, 80)',
    });
    const el = document.createElement('div');
    animator.place(el, cell(0), { slide: false, durationMs: 150 });
    animator.place(el, cell(9), { slide: true, durationMs: 150 });
    animator.place(el, cell(18), { slide: true, durationMs: 150 });
    expect(fake.slides.map((s) => [s.from, s.to, s.state])).toEqual([
      [cell(0), cell(9), 'cancelled'],
      ['translate(37.5px, 80px)', cell(18), 'running'],
    ]);
  });

  test('without Web Animations every placement snaps', () => {
    const animator = createPieceAnimator({
      animate: () => null,
      paintedTransform: () => '',
    });
    const el = document.createElement('div');
    animator.place(el, cell(1), { slide: true, durationMs: 150 });
    animator.place(el, cell(2), { slide: true, durationMs: 150 });
    expect(el.style.transform).toBe(cell(2));
  });

  test('re-placing on the square a piece is already sliding to keeps that slide', () => {
    const fake = createFakeAnimate();
    const animator = createPieceAnimator({
      animate: () => fake.animate,
      paintedTransform: () => 'none',
    });
    const el = document.createElement('div');
    animator.place(el, cell(0), { slide: false, durationMs: 150 });
    animator.place(el, cell(8), { slide: true, durationMs: 150 });
    animator.place(el, cell(8), { slide: true, durationMs: 150 });
    expect(fake.slides).toHaveLength(1);
    expect(fake.running()).toHaveLength(1);
  });

  test('dispose stops every running slide', () => {
    const fake = createFakeAnimate();
    const animator = createPieceAnimator({
      animate: () => fake.animate,
      paintedTransform: () => 'none',
    });
    const a = document.createElement('div');
    const b = document.createElement('div');
    for (const el of [a, b]) {
      animator.place(el, cell(0), { slide: false, durationMs: 150 });
      animator.place(el, cell(1), { slide: true, durationMs: 150 });
    }
    animator.dispose();
    expect(fake.running()).toHaveLength(0);
  });
});

describe('translateOfMatrix', () => {
  test('a pure translation matrix becomes a pixel translate', () => {
    assertProperty(
      'matrix-translate',
      fc.property(
        fc.integer({ min: -2000, max: 2000 }),
        fc.integer({ min: -2000, max: 2000 }),
        (e, f) => {
          expect(translateOfMatrix(`matrix(1, 0, 0, 1, ${e}, ${f})`)).toBe(
            `translate(${e}px, ${f}px)`
          );
        }
      )
    );
  });

  test('anything else passes through; `none` is no transform', () => {
    expect(translateOfMatrix('none')).toBe('');
    expect(translateOfMatrix('matrix(1.5, 0, 0, 1.5, 3, 4)')).toBe(
      'matrix(1.5, 0, 0, 1.5, 3, 4)'
    );
    expect(translateOfMatrix('translate(50%, 50%)')).toBe(
      'translate(50%, 50%)'
    );
  });
});
