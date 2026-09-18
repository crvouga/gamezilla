/**
 * What the play screen shows while it owns no active puzzle:
 *
 *   - `ready`: a puzzle is placed; render the player.
 *   - `loading`: a pick is pending (identity, first hydrate, or query in flight).
 *   - `offline`: nothing local yet and the device is offline — the pool cannot
 *     hydrate until connectivity returns.
 *   - `limited`: the player's tier has used up its puzzle allowance — show the
 *     upgrade invitation instead of a puzzle.
 *   - `empty`: the local pool has hydrated but nothing matches the feed
 *     (filters exhausted, or a rating band with no synced rows).
 */
export type PuzzlePickState =
  | 'ready'
  | 'loading'
  | 'offline'
  | 'limited'
  | 'empty';

export function resolvePuzzlePickState(args: {
  readonly activePuzzleId: string | null;
  readonly nextPuzzleId: string | null;
  readonly loading: boolean;
  readonly localPuzzleTotal: number;
  readonly online: boolean;
  readonly limitReached: boolean;
}): PuzzlePickState {
  if (args.activePuzzleId !== null) return 'ready';
  if (args.nextPuzzleId !== null) return 'loading';
  if (args.limitReached) return 'limited';
  if (args.localPuzzleTotal === 0 && !args.online) return 'offline';
  if (args.loading) return 'loading';
  return 'empty';
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
