import { describe, expect, test } from 'bun:test';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import fc from 'fast-check';
import {
  type HeldCentre,
  STAGE_CENTRE_TOLERANCE,
  stageCentreOffset,
} from '../src/game-board-stage/stage-centre';

const room = fc.record({
  width: fc.integer({ min: 240, max: 1200 }),
  height: fc.integer({ min: 200, max: 1400 }),
  boardWidth: fc.integer({ min: 100, max: 1200 }),
});

/** A game's stage heights as it is played: its first, then small changes. */
const played = fc
  .tuple(
    fc.integer({ min: 100, max: 1400 }),
    fc.array(
      fc.integer({
        min: -STAGE_CENTRE_TOLERANCE,
        max: STAGE_CENTRE_TOLERANCE,
      }),
      { maxLength: 40 }
    )
  )
  .map(([first, changes]) => ({
    first,
    later: changes.map((change) => Math.max(0, first + change)),
  }));

describe('stageCentreOffset', () => {
  test('a stage that fits its room is centred in it, never above its top', () => {
    assertProperty(
      'the first offset centres the stage',
      fc.property(room, fc.integer({ min: 0, max: 1400 }), (given, height) => {
        const offset = stageCentreOffset(
          new Map<string, HeldCentre>(),
          given,
          height
        );
        expect(offset).toBeGreaterThanOrEqual(0);
        if (height <= given.height) {
          expect(offset + height).toBeLessThanOrEqual(given.height);
          expect(
            Math.abs(given.height - height - 2 * offset)
          ).toBeLessThanOrEqual(1);
        } else expect(offset).toBe(0);
      })
    );
  });

  test('while a game is played in one room its board never moves', () => {
    assertProperty(
      'every later stage keeps the first offset',
      fc.property(room, played, (given, heights) => {
        const held = new Map<string, HeldCentre>();
        const first = stageCentreOffset(held, given, heights.first);
        for (const height of heights.later)
          expect(stageCentreOffset(held, given, height)).toBe(first);
      })
    );
  });

  test('another room, or a stage of another size, is centred anew', () => {
    const held = new Map<string, HeldCentre>();
    const phone = { width: 390, height: 600, boardWidth: 390 };
    expect(stageCentreOffset(held, phone, 500)).toBe(50);
    // The window turned: a new room.
    expect(
      stageCentreOffset(held, { ...phone, width: 844, height: 300 }, 280)
    ).toBe(10);
    // Back in the first room, the held place is still there.
    expect(stageCentreOffset(held, phone, 480)).toBe(50);
    // Another game's board, far shorter: centred again.
    expect(stageCentreOffset(held, phone, 300)).toBe(150);
  });

  // regression: stage-board-moves-on-result
  test('the result keeps the live board in place in the same room', () => {
    const held = new Map<string, HeldCentre>();
    const phone = { width: 390, height: 520, boardWidth: 390 };
    // The live board with its hint line, then the result's without it.
    const live = stageCentreOffset(held, phone, 471);
    expect(stageCentreOffset(held, phone, 446)).toBe(live);
  });
});
