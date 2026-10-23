import { describe, expect, test } from 'bun:test';
import { xyToSquare } from '@pkgs/chess-board-core-shared-ts/geometry';
import { cellAt, squareAt } from '@pkgs/chess-board-root-shared-ts/board-box';
import {
  avatarTransform,
  createHoverSquare,
  createPieceDrag,
  dragGeometry,
  handoverTransform,
  TOUCH_BASE_ANCHOR,
  TOUCH_ZOOM,
} from '@pkgs/chess-board-root-shared-ts/piece-drag';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import fc from 'fast-check';

/** Style writes on `el` while `run` executes. */
function styleWrites(el: HTMLElement, run: () => void): number {
  const observer = new MutationObserver(() => {});
  observer.observe(el, { attributes: true, attributeFilter: ['style'] });
  run();
  const n = observer.takeRecords().length;
  observer.disconnect();
  return n;
}

describe('board hit testing', () => {
  test('the square under a point agrees with the core geometry', () => {
    assertProperty(
      'square-at',
      fc.property(
        fc.integer({ min: 8, max: 2000 }),
        fc.double({ min: -0.5, max: 1.5, noNaN: true }),
        fc.double({ min: -0.5, max: 1.5, noNaN: true }),
        fc.constantFrom('white' as const, 'black' as const),
        (size, fx, fy, orientation) => {
          const box = { left: 11, top: 23, size };
          const point = { x: fx * size, y: fy * size };
          expect(squareAt(box, point, orientation)).toBe(
            xyToSquare(point.x, point.y, size, orientation)
          );
          const cell = cellAt(box, point);
          expect(cell === null).toBe(
            xyToSquare(point.x, point.y, size, orientation) === null
          );
        }
      )
    );
  });
});

const TRANSLATE =
  /^translate\((-?[\d.e-]+)px, (-?[\d.e-]+)px\)(?: scale\(([\d.]+)\))?$/;

/** Centre and side of a one-cell box painted with `transform`. */
function paintedBox(transform: string, boxPx: number) {
  const m = TRANSLATE.exec(transform);
  if (m === null) throw new Error(`unexpected transform ${transform}`);
  const scale = m[3] === undefined ? 1 : Number(m[3]);
  // transform-origin is the centre: scaling never moves it.
  return {
    cx: Number(m[1]) + boxPx / 2,
    cy: Number(m[2]) + boxPx / 2,
    side: boxPx * scale,
  };
}

const CLASSES = {
  piece: 'piece',
  avatar: 'avatar',
  avatarTouch: 'avatar-touch',
  lifted: 'lifted',
};

function avatarOf(): HTMLElement {
  const avatar = document.querySelector<HTMLElement>('[data-drag-avatar]');
  if (avatar === null) throw new Error('no drag avatar');
  return avatar;
}

function pieceEl(code: string): HTMLElement {
  const el = document.createElement('div');
  el.dataset['piece'] = code;
  document.body.append(el);
  return el;
}

describe('drag geometry', () => {
  test('the released piece is painted exactly where its avatar was', () => {
    assertProperty(
      'handover-matches-avatar',
      fc.property(
        fc.integer({ min: -500, max: 3000 }),
        fc.integer({ min: -500, max: 3000 }),
        fc.integer({ min: 8, max: 200 }),
        fc.boolean(),
        (x, y, cellPx, touch) => {
          const g = dragGeometry(cellPx, touch);
          const avatar = paintedBox(avatarTransform(x, y, g), cellPx * g.zoom);
          const piece = paintedBox(handoverTransform(x, y, g), cellPx);
          expect(piece.cx).toBeCloseTo(avatar.cx, 6);
          expect(piece.cy).toBeCloseTo(avatar.cy, 6);
          expect(piece.side).toBeCloseTo(avatar.side, 6);
        }
      )
    );
  });

  test('a mouse holds the piece by its centre at true size', () => {
    const g = dragGeometry(40, false);
    expect(avatarTransform(100, 100, g)).toBe('translate(80px, 80px)');
    expect(handoverTransform(100, 100, g)).toBe('translate(80px, 80px)');
  });

  test('a finger holds the grown piece by its base, the piece above it', () => {
    const g = dragGeometry(40, true);
    const side = 40 * TOUCH_ZOOM;
    const box = paintedBox(avatarTransform(100, 300, g), side);
    expect(box.side).toBeCloseTo(40 * TOUCH_ZOOM, 6);
    // The fingertip is at the piece's base: the art sits above it.
    expect(box.cy + side / 2 - 300).toBeCloseTo(
      side * (1 - TOUCH_BASE_ANCHOR),
      6
    );
    expect(box.cy).toBeLessThan(300);
    expect(box.cx).toBe(100);
  });
});

describe('createPieceDrag', () => {
  test('a pointer move is exactly one style write, on the avatar only', () => {
    const drag = createPieceDrag(CLASSES);
    const el = pieceEl('wn');
    drag.begin({
      element: el,
      clientX: 120,
      clientY: 220,
      cellPx: 40,
      touch: false,
    });
    const avatar = avatarOf();
    // The avatar lives on <body>, outside every board ancestor.
    expect(avatar.parentElement).toBe(document.body);
    expect(avatar.dataset['piece']).toBe('wn');
    expect(avatar.style.display).toBe('block');
    expect(avatar.classList.contains('avatar-touch')).toBe(false);
    expect(el.classList.contains('lifted')).toBe(true);
    const g = dragGeometry(40, false);
    assertProperty(
      'drag-move-cost',
      fc.property(
        fc.integer({ min: -500, max: 3000 }),
        fc.integer({ min: -500, max: 3000 }),
        (x, y) => {
          expect(styleWrites(avatar, () => drag.move(x, y))).toBe(1);
          expect(styleWrites(el, () => drag.move(x, y))).toBe(0);
          expect(avatar.style.transform).toBe(avatarTransform(x, y, g));
        }
      )
    );
    drag.move(300, 260);
    expect(drag.end({ left: 100, top: 200 })).toBe(el);
    // The piece takes over exactly where the avatar was, in board pixels.
    expect(el.style.transform).toBe(handoverTransform(200, 60, g));
    expect(el.classList.contains('lifted')).toBe(false);
    expect(avatar.style.display).toBe('none');
    expect(drag.element()).toBeNull();
    drag.dispose();
    expect(document.querySelector('[data-drag-avatar]')).toBeNull();
  });

  test('under a finger the avatar is grown, see-through and held by its base', () => {
    const drag = createPieceDrag(CLASSES);
    const el = pieceEl('wp');
    drag.begin({
      element: el,
      clientX: 100,
      clientY: 100,
      cellPx: 40,
      touch: true,
    });
    const avatar = avatarOf();
    const g = dragGeometry(40, true);
    expect(avatar.style.width).toBe(`${40 * TOUCH_ZOOM}px`);
    expect(avatar.classList.contains('avatar-touch')).toBe(true);
    expect(avatar.style.transform).toBe(avatarTransform(100, 100, g));
    drag.move(120, 100);
    expect(drag.end({ left: 0, top: 0 })?.style.transform).toBe(
      handoverTransform(120, 100, g)
    );
    // A later mouse drag is opaque and true size again.
    drag.begin({
      element: el,
      clientX: 100,
      clientY: 100,
      cellPx: 40,
      touch: false,
    });
    expect(avatar.classList.contains('avatar-touch')).toBe(false);
    expect(avatar.style.width).toBe('40px');
    drag.dispose();
  });
});

describe('createHoverSquare', () => {
  test('the ring moves only when the pointer crosses into another square', () => {
    const el = document.createElement('div');
    const hover = createHoverSquare(() => el, 'touch');
    assertProperty(
      'hover-writes',
      fc.property(
        fc.array(
          fc.option(
            fc.record({
              col: fc.integer({ min: 0, max: 7 }),
              row: fc.integer({ min: 0, max: 7 }),
            }),
            { nil: null }
          ),
          { maxLength: 30 }
        ),
        (path) => {
          hover.hide();
          let shown: string | null = null;
          for (const step of path) {
            const key = step === null ? null : `${step.col},${step.row}`;
            const writes = styleWrites(el, () => {
              if (step === null) hover.hide();
              else hover.show(step.col, step.row);
            });
            if (key === shown) expect(writes).toBe(0);
            else expect(writes).toBeGreaterThan(0);
            shown = key;
            if (step !== null) {
              expect(el.style.transform).toBe(
                `translate(${step.col * 100}%, ${step.row * 100}%)`
              );
              expect(el.style.visibility).toBe('visible');
            } else {
              expect(el.style.visibility).not.toBe('visible');
            }
          }
        }
      )
    );
  });
});
