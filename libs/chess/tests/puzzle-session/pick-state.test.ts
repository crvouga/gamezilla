import { describe, expect, test } from 'bun:test';

import {
  resolvePuzzlePickState,
  shouldDropExhaustedActivePuzzle,
} from '@libs/chess/public/puzzle-session';

describe('resolvePuzzlePickState', () => {
  const base = {
    activePuzzleId: null,
    nextPuzzleId: null,
    loading: false,
    localPuzzleTotal: 40,
    online: true,
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
