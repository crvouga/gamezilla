import { describe, expect, test } from 'bun:test';
import type { PuzzlePlacementArgs } from '@libs/chess-puzzle-shared/pick-state';
import { decidePuzzlePlacement } from '@libs/chess-puzzle-shared/pick-state';

function args(over: Partial<PuzzlePlacementArgs>): PuzzlePlacementArgs {
  return {
    active: 'p1',
    seed: 1,
    nextId: 'p2',
    room: 'p1',
    nextLoading: false,
    placedSeed: 1,
    canPick: true,
    ...over,
  };
}

describe('placing a linked puzzle', () => {
  test('a linked puzzle replaces the one on the board as a new start', () => {
    expect(decidePuzzlePlacement(args({ linked: 'linked1', seed: 2 }))).toEqual(
      { kind: 'place', puzzleId: 'linked1', armStart: true }
    );
  });

  test('the linked puzzle already on the board stays as it is', () => {
    expect(decidePuzzlePlacement(args({ linked: 'p1', active: 'p1' }))).toEqual(
      { kind: 'none' }
    );
  });

  test('a watcher never places a linked puzzle', () => {
    expect(
      decidePuzzlePlacement(args({ linked: 'linked1', canPick: false }))
    ).toEqual({ kind: 'none' });
  });
});
