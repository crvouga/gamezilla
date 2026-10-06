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

  test('a finished room puzzle is not resumed on an empty board', () => {
    expect(
      decidePuzzlePlacement(
        args({
          active: null,
          seed: 0,
          placedSeed: 0,
          room: 'played',
          nextId: 'fresh',
          roomResumable: false,
        })
      )
    ).toEqual({ kind: 'none' });
  });

  test('an unfinished room puzzle is resumed', () => {
    expect(
      decidePuzzlePlacement(
        args({
          active: null,
          seed: 0,
          placedSeed: 0,
          room: 'live',
          nextId: 'fresh',
        })
      )
    ).toEqual({ kind: 'place', puzzleId: 'live', armStart: false });
  });

  test('after the finished room is cleared, the next puzzle is placed', () => {
    expect(
      decidePuzzlePlacement(
        args({
          active: null,
          seed: 1,
          placedSeed: 0,
          room: null,
          nextId: 'fresh',
          roomResumable: false,
        })
      )
    ).toEqual({ kind: 'place', puzzleId: 'fresh', armStart: true });
  });

  test('a watcher never places a linked puzzle', () => {
    expect(
      decidePuzzlePlacement(args({ linked: 'linked1', canPick: false }))
    ).toEqual({ kind: 'none' });
  });
});
