import { describe, expect, test } from 'bun:test';
import type { PuzzleSessionStartInput } from '@libs/chess-puzzle-shared/session-start-policy';
import {
  decidePuzzleSessionStart,
  shouldDeferPuzzleAttemptPlacement,
  shouldReclaimPuzzleHost,
} from '@libs/chess-puzzle-shared/session-start-policy';

const READY: PuzzleSessionStartInput = {
  identityReady: true,
  startNonce: 1,
  lastStartedNonce: 0,
  playGeneration: 3,
  readyGeneration: 3,
  roomStatus: 'idle',
  roomPuzzleId: null,
  fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  moves: 'e2e4 e7e5',
};

describe('decidePuzzleSessionStart', () => {
  test('starts when armed, ready, idle and hydrated', () => {
    expect(decidePuzzleSessionStart(READY)).toEqual({ kind: 'start' });
  });

  test('skips before identity is ready', () => {
    expect(
      decidePuzzleSessionStart({ ...READY, identityReady: false })
    ).toEqual({ kind: 'skip' });
  });

  test('skips when the screen has not armed a placement', () => {
    expect(decidePuzzleSessionStart({ ...READY, startNonce: 0 })).toEqual({
      kind: 'skip',
    });
  });

  test('skips when this nonce already started', () => {
    expect(
      decidePuzzleSessionStart({ ...READY, startNonce: 4, lastStartedNonce: 4 })
    ).toEqual({ kind: 'skip' });
  });

  test('skips while the parent has not caught up with the puzzle swap', () => {
    expect(decidePuzzleSessionStart({ ...READY, readyGeneration: 2 })).toEqual({
      kind: 'skip',
    });
  });

  test('acknowledges when another client already started a puzzle', () => {
    expect(
      decidePuzzleSessionStart({
        ...READY,
        roomStatus: 'solving',
        roomPuzzleId: 'p1',
      })
    ).toEqual({ kind: 'acknowledge' });
  });

  test('skips when the room is busy but carries no puzzle yet', () => {
    expect(
      decidePuzzleSessionStart({ ...READY, roomStatus: 'solving' })
    ).toEqual({ kind: 'skip' });
  });

  test('skips until entity data is hydrated', () => {
    expect(decidePuzzleSessionStart({ ...READY, fen: '' })).toEqual({
      kind: 'skip',
    });
    expect(decidePuzzleSessionStart({ ...READY, moves: '' })).toEqual({
      kind: 'skip',
    });
  });

  test('acknowledges an idle room that still names a puzzle', () => {
    expect(
      decidePuzzleSessionStart({ ...READY, roomPuzzleId: 'p-prev' })
    ).toEqual({ kind: 'acknowledge' });
  });
});

describe('shouldDeferPuzzleAttemptPlacement', () => {
  test('keeps a pending next attempt until the old room puzzle clears', () => {
    const pendingAttempt = {
      attemptSeed: 2,
      placedAttemptSeed: 1,
    };

    expect(
      shouldDeferPuzzleAttemptPlacement({
        ...pendingAttempt,
        roomPuzzleId: 'old-puzzle',
      })
    ).toBe(true);
    expect(
      shouldDeferPuzzleAttemptPlacement({
        ...pendingAttempt,
        roomPuzzleId: null,
      })
    ).toBe(false);
  });

  test('does not defer an attempt that was already placed', () => {
    expect(
      shouldDeferPuzzleAttemptPlacement({
        attemptSeed: 2,
        placedAttemptSeed: 2,
        roomPuzzleId: 'active-puzzle',
      })
    ).toBe(false);
  });
});

describe('shouldReclaimPuzzleHost', () => {
  const base = {
    memberId: 'me',
    roomStatus: 'solving' as const,
    hostIdentity: 'them',
    roomSynced: true,
    hostPresent: false,
  };

  test('reclaims a stale host once the room is synced', () => {
    expect(shouldReclaimPuzzleHost(base)).toBe(true);
  });

  test('never steals from a connected host', () => {
    expect(shouldReclaimPuzzleHost({ ...base, hostPresent: true })).toBe(false);
  });

  test('no-op when I am already host or no host is recorded', () => {
    expect(shouldReclaimPuzzleHost({ ...base, hostIdentity: 'me' })).toBe(
      false
    );
    expect(shouldReclaimPuzzleHost({ ...base, hostIdentity: null })).toBe(
      false
    );
  });

  test('waits for identity, sync, and a live session', () => {
    expect(shouldReclaimPuzzleHost({ ...base, memberId: '' })).toBe(false);
    expect(shouldReclaimPuzzleHost({ ...base, roomSynced: false })).toBe(false);
    expect(shouldReclaimPuzzleHost({ ...base, roomStatus: 'idle' })).toBe(
      false
    );
  });
});
