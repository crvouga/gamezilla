/** @jsxImportSource solid-js */
/**
 * Pointer input, one event at a time, and what each event costs in DOM
 * writes. The hot paths — hovering and dragging — must stay out of the
 * framework: hovering writes nothing, a drag writes one style per event.
 */

import { afterEach, describe, expect, test } from 'bun:test';
import {
  avatarTransform,
  dragGeometry,
  TOUCH_ZOOM,
} from '@pkgs/chess-board-root-shared-ts/piece-drag';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import fc from 'fast-check';
import type { MountedBoard } from './board-fixture';
import {
  BOARD_PX,
  centerOf,
  mountBoard,
  mutationsDuring,
} from './board-fixture';

let mounted: MountedBoard | undefined;

function open(...args: Parameters<typeof mountBoard>): MountedBoard {
  mounted = mountBoard(...args);
  return mounted;
}

afterEach(() => {
  mounted?.unmount();
  mounted = undefined;
});

/** A point inside `e4`, jittered but never crossing into a neighbour. */
const insideE4 = fc
  .record({
    dx: fc.integer({ min: -15, max: 15 }),
    dy: fc.integer({ min: -15, max: 15 }),
  })
  .map(({ dx, dy }) => {
    const c = centerOf('e4');
    return { x: c.x + dx, y: c.y + dy };
  });

describe('hot paths stay out of the framework', () => {
  test('moving the pointer over an idle board writes nothing', () => {
    const board = open();
    assertProperty(
      'idle-hover',
      fc.property(
        fc.array(
          fc.record({
            x: fc.integer({ min: -40, max: BOARD_PX + 40 }),
            y: fc.integer({ min: -40, max: BOARD_PX + 40 }),
          }),
          { maxLength: 20 }
        ),
        (path) => {
          const records = mutationsDuring(board.host, () => {
            for (const at of path) board.move({ at, buttons: 0 });
          });
          expect(records).toHaveLength(0);
        }
      )
    );
  });

  test('each pointer move of a drag is one style write, on the avatar', () => {
    const board = open();
    board.down({ square: 'e2' });
    board.move({ square: 'e4' });
    const avatar = board.avatar();
    assertProperty(
      'drag-move-writes',
      fc.property(insideE4, (at) => {
        // Observe the whole page: nothing but the avatar may change.
        const records = mutationsDuring(document.body, () =>
          board.move({ at })
        );
        expect(records).toHaveLength(1);
        expect(records[0]?.target).toBe(avatar);
        expect(records[0]?.attributeName).toBe('style');
      })
    );
    board.up({ square: 'e4' });
    expect(board.moves).toEqual(['e2e4']);
  });

  test('a move re-places only the piece that moved', () => {
    const board = open();
    board.down({ square: 'g1' });
    board.up({ square: 'g1' });
    const knight = board.piece('g1');
    const records = mutationsDuring(board.host, () => {
      board.down({ square: 'f3' });
      board.up({ square: 'f3' });
    });
    const restyledPieces = new Set(
      records
        .filter(
          (r) =>
            r.attributeName === 'style' &&
            r.target instanceof HTMLElement &&
            r.target.dataset['piece'] !== undefined &&
            r.target.dataset['pieceSquare'] !== undefined
        )
        .map((r) => r.target)
    );
    expect(restyledPieces.size).toBe(1);
    expect(restyledPieces.has(knight)).toBe(true);
    expect(board.piece('f3')).toBe(knight);
  });
});

describe('render budgets', () => {
  const grid = (board: MountedBoard) =>
    board.host.querySelector('[data-square="a8"]')?.parentElement ?? null;

  test('releasing a tap on a piece changes nothing already painted (one reactive pass)', () => {
    const board = open();
    board.down({ square: 'e2' });
    const squares = board.host.querySelector('[data-testid$="-layer-squares"]');
    if (squares === null) throw new Error('no squares layer');
    const records = mutationsDuring(squares, () => board.up({ square: 'e2' }));
    // Picked up → selected: same wash, same hints, so nothing re-renders
    // (unbatched, the drag-cancel and the select would each rebuild them).
    // The only write is the hover ring going away with the drag.
    expect(records.map((r) => r.type)).toEqual(['attributes']);
    expect((records[0]?.target as HTMLElement).style.visibility).toBe('hidden');
    expect(board.layer('squares')).toEqual(['dot@e3', 'dot@e4', 'selected@e2']);
  });

  test('a move updates only changed square meanings and two focus stops', () => {
    const board = open();
    expect(board.host.dataset['grab']).toBe('w');
    board.down({ square: 'g1' });
    board.up({ square: 'g1' });
    const buttons = grid(board);
    if (buttons === null) throw new Error('no hit grid');
    const records = mutationsDuring(buttons, () => {
      board.down({ square: 'f3' });
      board.up({ square: 'f3' });
    });
    expect(board.moves).toEqual(['g1f3']);
    expect(
      records.every((r) =>
        ['tabindex', 'aria-label', 'aria-pressed'].includes(
          r.attributeName ?? ''
        )
      )
    ).toBe(true);
    const focus = records.filter((r) => r.attributeName === 'tabindex');
    expect(new Set(focus.map((r) => r.target)).size).toBeLessThanOrEqual(2);
    const meanings = records.filter((r) => r.attributeName !== 'tabindex');
    expect(
      new Set(meanings.map((r) => (r.target as HTMLElement).dataset['square']))
    ).toEqual(new Set(['g1', 'f3', 'h3']));
    // Whose pieces show the grab cursor: one host attribute.
    expect(board.host.dataset['grab']).toBe('b');
  });

  test('flipping the board keeps every hit-grid button where it is in the DOM', () => {
    const board = open();
    const buttons = grid(board);
    if (buttons === null) throw new Error('no hit grid');
    const records = mutationsDuring(buttons, () =>
      board.setOrientation('black')
    );
    expect(records.filter((r) => r.type === 'childList')).toHaveLength(0);
    expect(records).toHaveLength(64);
    expect(records.every((r) => r.attributeName === 'style')).toBe(true);
    expect(new Set(records.map((r) => r.target)).size).toBe(64);
    expect(
      [...buttons.children].every((button) =>
        records.some((r) => r.target === button)
      )
    ).toBe(true);
  });

  test('empty annotation layers are not rendered above the pieces', () => {
    const board = open({ enableUserArrows: true });
    const layers = () =>
      ['arrows', 'shapes', 'feedback'].filter(
        (l) => board.host.querySelector(`[data-testid$="-layer-${l}"]`) !== null
      );
    expect(layers()).toEqual([]);
    board.down({ square: 'e2', button: 2, buttons: 2 });
    board.move({ square: 'e4', buttons: 2 });
    board.up({ square: 'e4', button: 2 });
    expect(layers()).toEqual(['arrows']);
    board.down({ square: 'a1' });
    board.up({ square: 'a1' });
    expect(layers()).toEqual([]);
  });

  test('a view-only board offers no piece to grab', () => {
    const board = open({ interactive: false });
    expect(board.host.dataset['grab']).toBeUndefined();
  });
});

describe('pick-up', () => {
  test('a press picks the piece up at once, centred under the pointer', () => {
    const board = open();
    const at = { x: centerOf('e2').x + 12, y: centerOf('e2').y - 9 };
    board.down({ at });
    const avatar = board.avatar();
    expect(avatar.dataset['piece']).toBe('wp');
    expect(avatar.style.display).toBe('block');
    const half = BOARD_PX / 16;
    expect(avatar.style.transform).toBe(
      `translate(${at.x - half}px, ${at.y - half}px)`
    );
    // Its legal targets show on the press, too.
    expect(board.layer('squares')).toContain('dot@e4');
  });

  test('a finger picks the piece up on the press, grown and held by its base', () => {
    const board = open();
    board.down({ square: 'g1', pointerType: 'touch' });
    const c = centerOf('g1');
    const avatar = board.avatar();
    expect(avatar.style.transform).toBe(
      avatarTransform(c.x, c.y, dragGeometry(BOARD_PX / 8, true))
    );
    expect(avatar.style.width).toBe(`${(BOARD_PX / 8) * TOUCH_ZOOM}px`);
  });

  test('the next mouse press after a touch drag is true size again', () => {
    const board = open();
    board.down({ square: 'g1', pointerType: 'touch' });
    board.up({ square: 'g1', pointerType: 'touch' });
    board.down({ square: 'b1' });
    expect(board.avatar().style.width).toBe(`${BOARD_PX / 8}px`);
  });

  test('a press that wobbles across a square edge is a tap, not a drop', () => {
    const board = open();
    const edge = {
      x: centerOf('e2').x,
      y: centerOf('e2').y - BOARD_PX / 16 + 1,
    };
    board.down({ at: edge });
    board.move({ at: { x: edge.x, y: edge.y - 3 } });
    board.up({ at: { x: edge.x, y: edge.y - 3 } });
    expect(board.moves).toEqual([]);
    expect(board.layer('squares')).toContain('selected@e2');
    expect(board.avatar().style.display).toBe('none');
  });

  test('the dragged piece is drawn outside the board and follows off it', () => {
    const board = open();
    board.down({ square: 'd2' });
    const avatar = board.avatar();
    expect(board.host.contains(avatar)).toBe(false);
    expect(avatar.parentElement).toBe(document.body);
    board.move({ at: { x: -150, y: BOARD_PX + 200 } });
    const half = BOARD_PX / 16;
    expect(avatar.style.transform).toBe(
      `translate(${-150 - half}px, ${BOARD_PX + 200 - half}px)`
    );
    board.up({ at: { x: -150, y: BOARD_PX + 200 } });
    expect(board.moves).toEqual([]);
    expect(board.piece('d2').style.transform).toBe('translate(37.5cqw, 75cqw)');
  });

  test('the board owns its presses: defaults prevented, a mouse press focuses its square', () => {
    const board = open();
    expect(board.down({ square: 'b1' }).defaultPrevented).toBe(true);
    board.up({ square: 'b1' });
    expect(document.activeElement?.getAttribute('data-square')).toBe('b1');
    (document.activeElement as HTMLElement | null)?.blur();
    expect(
      board.down({ square: 'c1', pointerType: 'touch' }).defaultPrevented
    ).toBe(true);
    board.up({ square: 'c1', pointerType: 'touch' });
    // A finger has no keyboard to hand focus to.
    expect(document.activeElement?.getAttribute('data-square')).not.toBe('c1');
  });

  // regression: chess-board-touch-longpress-cancel — Android fires
  // `contextmenu` on a long-press; it was taken for a right button during a
  // drag and put the held piece back.
  test('a touch long-press keeps holding the piece', () => {
    const board = open();
    board.down({ square: 'e2', pointerType: 'touch' });
    board.move({ square: 'e4', pointerType: 'touch' });
    board.contextMenu('e4');
    board.up({ square: 'e4', pointerType: 'touch' });
    expect(board.moves).toEqual(['e2e4']);
  });
});

describe('gestures', () => {
  test('the right-drag arrow is previewed square by square until released', () => {
    const board = open({ enableUserArrows: true });
    board.down({ square: 'e2', button: 2, buttons: 2 });
    board.contextMenu('e2');
    board.move({ square: 'e3', buttons: 2 });
    expect(board.layer('arrows')).toEqual(['arrow-preview:primary@e2-e3']);
    board.move({ square: 'e4', buttons: 2 });
    expect(board.layer('arrows')).toEqual(['arrow-preview:primary@e2-e4']);
    board.up({ square: 'e4', button: 2 });
    expect(board.layer('arrows')).toEqual(['arrow:primary@e2-e4']);
  });

  test('a right button pressed during a drag puts the piece back', () => {
    const board = open();
    const bishop = board.piece('f1');
    board.down({ square: 'f1' });
    board.down({ square: 'e2' }); // no-op: already pressed
    board.move({ square: 'c4' });
    board.move({ square: 'c4', buttons: 3 });
    expect(bishop.style.transform).toBe('translate(62.5cqw, 87.5cqw)');
    board.up({ square: 'c4' });
    expect(board.moves).toEqual([]);
  });

  test('a right-click during a drag (context menu) puts the piece back', () => {
    const board = open();
    board.down({ square: 'g1' });
    board.move({ square: 'f3' });
    board.contextMenu('f3');
    board.up({ square: 'f3' });
    expect(board.moves).toEqual([]);
    expect(board.piece('g1').style.transform).toBe('translate(75cqw, 87.5cqw)');
  });

  // regression: chess-board-windows-right-drag — Windows fires
  // `contextmenu` after `pointerup`; strokes that began on `contextmenu`
  // never ended, so right-drags drew nothing there.
  test('a right-drag draws its arrow when the context menu fires after release', () => {
    const board = open({ enableUserArrows: true });
    board.down({ square: 'e2', button: 2, buttons: 2 });
    board.move({ square: 'e4', buttons: 2 });
    board.up({ square: 'e4', button: 2 });
    board.contextMenu('e4');
    expect(board.layer('arrows')).toEqual(['arrow:primary@e2-e4']);
    board.down({ square: 'd5', button: 2, buttons: 2 });
    board.up({ square: 'd5', button: 2 });
    board.contextMenu('d5');
    expect(board.layer('arrows')).toEqual(['arrow:primary@e2-e4']);
    expect(board.layer('shapes')).toEqual(['circle:primary@d5']);
  });

  // regression: chess-board-second-pointer-drag — move / up handlers ignored
  // `pointerId`, so a second finger steered the dragged piece and its
  // release dropped the piece on the second finger's square.
  test('a second finger neither steers nor drops the dragged piece', () => {
    const board = open();
    const pawn = board.piece('e2');
    board.down({ square: 'e2', pointerType: 'touch' });
    board.move({ square: 'e3', pointerType: 'touch' });
    const held = pawn.style.transform;
    board.down({ square: 'a6', pointerId: 2, pointerType: 'touch' });
    board.move({ square: 'a6', pointerId: 2, pointerType: 'touch' });
    expect(pawn.style.transform).toBe(held);
    board.up({ square: 'a6', pointerId: 2, pointerType: 'touch' });
    expect(board.moves).toEqual([]);
    board.move({ square: 'e4', pointerType: 'touch' });
    board.up({ square: 'e4', pointerType: 'touch' });
    expect(board.moves).toEqual(['e2e4']);
  });

  // regression: chess-board-arrows-ignore-flip — arrow geometry was computed
  // once per arrow, so parent arrows kept pointing the old way after a flip.
  test('parent arrows redraw when the board flips', () => {
    const board = open({ arrows: [{ from: 'e2', to: 'e4' }] });
    const shaft = () =>
      board.host
        .querySelector('[data-testid$="-layer-arrows"] path')
        ?.getAttribute('d');
    const white = shaft();
    board.setOrientation('black');
    expect(shaft()).not.toBe(white);
    board.setOrientation('white');
    expect(shaft()).toBe(white);
  });
});
