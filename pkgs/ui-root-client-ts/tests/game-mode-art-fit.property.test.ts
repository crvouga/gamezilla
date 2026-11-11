import { describe, expect, test } from 'bun:test';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import fc from 'fast-check';
import { modeArtWidth } from '../src/game-lobby/mode-art';

const size = fc.record({
  width: fc.integer({ min: 1, max: 1200 }),
  height: fc.integer({ min: 1, max: 1400 }),
});

describe('modeArtWidth', () => {
  test('the board stands whole in its room', () => {
    assertProperty(
      'the fitted board is no wider and no taller than its room',
      fc.property(size, size, (room, board) => {
        const width = modeArtWidth(room, board) ?? 0;
        expect(width).toBeLessThanOrEqual(room.width);
        const tall = (width * board.height) / board.width;
        expect(tall).toBeLessThanOrEqual(room.height);
      })
    );
  });

  test('nothing is fitted before either has a size', () => {
    expect(
      modeArtWidth({ width: 0, height: 200 }, { width: 100, height: 100 })
    ).toBeUndefined();
    expect(
      modeArtWidth({ width: 300, height: 200 }, { width: 100, height: 0 })
    ).toBeUndefined();
  });
});
