import { shouldDeferPuzzleAttemptPlacement } from './session-start-policy';

/**
 * What the play screen shows while it owns no active puzzle:
 *
 *   - `ready`: a puzzle is placed; render the player.
 *   - `loading`: a pick is pending (identity, first hydrate, or query in flight).
 *   - `offline`: nothing local yet and the device is offline — the pool cannot
 *     hydrate until connectivity returns.
 *   - `limited`: the permission layer denied starting another puzzle — show
 *     the denial surface instead of a puzzle.
 *   - `empty`: the local pool has hydrated but nothing matches the feed
 *     (filters exhausted, or a rating band with no synced rows).
 */
export type PuzzlePickState =
  | 'ready'
  | 'loading'
  | 'offline'
  | 'limited'
  | 'empty'
  /** Spectator with nothing placed by the host yet. */
  | 'waiting';

export function resolvePuzzlePickState(args: {
  readonly activePuzzleId: string | null;
  readonly nextPuzzleId: string | null;
  readonly loading: boolean;
  readonly localPuzzleTotal: number;
  readonly online: boolean;
  readonly limitReached: boolean;
}): PuzzlePickState {
  if (args.activePuzzleId !== null) return 'ready';
  if (args.limitReached) return 'limited';
  if (args.nextPuzzleId !== null) return 'loading';
  if (args.localPuzzleTotal === 0 && !args.online) return 'offline';
  if (args.loading) return 'loading';
  return 'empty';
}

export type PuzzlePlacementArgs = {
  readonly active: string | null;
  readonly seed: number;
  readonly nextId: string | null;
  readonly room: string | null;
  readonly nextLoading: boolean;
  readonly placedSeed: number;
  /** False for spectators: they only ever follow the room's puzzle. */
  readonly canPick: boolean;
  /** A puzzle a puzzle link asked for, until it is placed. */
  readonly linked?: string | null | undefined;
  /**
   * False when the room's puzzle must not be resumed: it is finished, or its
   * status has not arrived. Omitted means the room puzzle can be resumed.
   */
  readonly roomResumable?: boolean;
};

/** The room puzzle, when this device should rejoin it instead of picking. */
function roomToResume(a: PuzzlePlacementArgs): string | null {
  if (a.roomResumable === false || a.room === null) return null;
  return a.room;
}

/**
 * Nothing is on the board yet. A finished room puzzle waits to be cleared;
 * an unfinished one is rejoined; otherwise the feed's next puzzle is placed.
 */
function placeOnEmptyBoard(a: PuzzlePlacementArgs): PuzzlePlacementDecision {
  if (a.seed !== a.placedSeed && a.room !== null) return { kind: 'none' };
  if (a.seed === 0 && a.room !== null) {
    const resume = roomToResume(a);
    if (resume === null) return { kind: 'none' };
    return { kind: 'place', puzzleId: resume, armStart: false };
  }
  if (a.nextId !== null) {
    return { kind: 'place', puzzleId: a.nextId, armStart: true };
  }
  return { kind: 'none' };
}

export type PuzzlePlacementDecision =
  | { readonly kind: 'none' }
  | {
      readonly kind: 'place';
      readonly puzzleId: string;
      readonly armStart: boolean;
    }
  | { readonly kind: 'drop' };

/** A watcher only ever follows the room's puzzle. */
function decideAsWatcher(a: PuzzlePlacementArgs): PuzzlePlacementDecision {
  if (a.room !== null && a.room !== a.active) {
    return { kind: 'place', puzzleId: a.room, armStart: false };
  }
  if (a.room === null && a.active !== null) {
    return { kind: 'drop' };
  }
  return { kind: 'none' };
}

/** Pure placement rule for one reactive tick (see the screen effect). */
export function decidePuzzlePlacement(
  a: PuzzlePlacementArgs
): PuzzlePlacementDecision {
  if (!a.canPick) return decideAsWatcher(a);
  const linked = a.linked ?? null;
  if (linked !== null && linked !== a.active) {
    return { kind: 'place', puzzleId: linked, armStart: true };
  }
  if (a.active === null) return placeOnEmptyBoard(a);
  const resume = roomToResume(a);
  if (resume !== null && resume !== a.active) {
    return { kind: 'place', puzzleId: resume, armStart: false };
  }
  if (a.seed === a.placedSeed) return { kind: 'none' };
  if (
    shouldDeferPuzzleAttemptPlacement({
      attemptSeed: a.seed,
      placedAttemptSeed: a.placedSeed,
      roomPuzzleId: a.room,
    })
  ) {
    return { kind: 'none' };
  }
  if (
    shouldDropExhaustedActivePuzzle({
      nextPuzzleId: a.nextId,
      loading: a.nextLoading,
      roomPuzzleId: a.room,
    })
  ) {
    return { kind: 'drop' };
  }
  if (a.nextId === null || a.nextId === a.active) return { kind: 'none' };
  return { kind: 'place', puzzleId: a.nextId, armStart: true };
}

/**
 * After "Next" the screen keeps the finished puzzle on screen until a
 * replacement is picked. When the pick settles with nothing, drop the active
 * puzzle so the empty state can take over instead of a dead Next button.
 */
export function shouldDropExhaustedActivePuzzle(args: {
  readonly nextPuzzleId: string | null;
  readonly loading: boolean;
  readonly roomPuzzleId: string | null;
}): boolean {
  return (
    args.nextPuzzleId === null && !args.loading && args.roomPuzzleId === null
  );
}
