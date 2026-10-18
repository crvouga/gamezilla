import { describe, expect, test } from 'bun:test';

import {
  resolvePuzzlePickState,
  shouldDropExhaustedActivePuzzle,
} from '@libs/game-puzzle-shared/pick-state';

describe('resolvePuzzlePickState', () => {
  const base = {
    activePuzzleId: null,
    nextPuzzleId: null,
    loading: false,
    localPuzzleTotal: 40,
    online: true,
    limitReached: false,
  };

  test('ready whenever a puzzle is placed', () => {
    expect(
      resolvePuzzlePickState({ ...base, activePuzzleId: 'p1', loading: true })
    ).toBe('ready');
  });

  test('loading while a pick is pending or about to be placed', () => {
    expect(resolvePuzzlePickState({ ...base, loading: true })).toBe('loading');
    expect(resolvePuzzlePickState({ ...base, nextPuzzleId: 'p2' })).toBe(
      'loading'
    );
  });

  test('offline only when nothing is local and the device is offline', () => {
    expect(
      resolvePuzzlePickState({ ...base, localPuzzleTotal: 0, online: false })
    ).toBe('offline');
    // Offline with a local catalog is a normal exhausted feed, not a connectivity issue.
    expect(resolvePuzzlePickState({ ...base, online: false })).toBe('empty');
    // Offline but still hydrating (loading) stays loading unless the catalog is empty.
    expect(
      resolvePuzzlePickState({ ...base, loading: true, online: false })
    ).toBe('loading');
  });

  test('limited outranks offline and empty once the daily allowance is used', () => {
    expect(
      resolvePuzzlePickState({
        ...base,
        localPuzzleTotal: 0,
        online: false,
        limitReached: true,
      })
    ).toBe('limited');
    expect(resolvePuzzlePickState({ ...base, limitReached: true })).toBe(
      'limited'
    );
    // A puzzle already placed keeps playing even at the limit.
    expect(
      resolvePuzzlePickState({
        ...base,
        activePuzzleId: 'p1',
        limitReached: true,
      })
    ).toBe('ready');
  });

  test('empty once the pick settled with nothing to place', () => {
    expect(resolvePuzzlePickState(base)).toBe('empty');
  });
});

describe('shouldDropExhaustedActivePuzzle', () => {
  test('drops only when the pick settled empty and the room is cleared', () => {
    expect(
      shouldDropExhaustedActivePuzzle({
        nextPuzzleId: null,
        loading: false,
        roomPuzzleId: null,
      })
    ).toBe(true);
    expect(
      shouldDropExhaustedActivePuzzle({
        nextPuzzleId: null,
        loading: true,
        roomPuzzleId: null,
      })
    ).toBe(false);
    expect(
      shouldDropExhaustedActivePuzzle({
        nextPuzzleId: 'p9',
        loading: false,
        roomPuzzleId: null,
      })
    ).toBe(false);
    expect(
      shouldDropExhaustedActivePuzzle({
        nextPuzzleId: null,
        loading: false,
        roomPuzzleId: 'p1',
      })
    ).toBe(false);
  });
});
