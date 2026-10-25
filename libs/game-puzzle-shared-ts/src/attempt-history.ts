import { MutationError } from '@pkgs/sync-engine-shared-ts/mutations-types';
import type { PuzzleContent } from '@pkgs/turn-game-shared-ts/puzzle-content';
import {
  ATTEMPT_HISTORY_KEYFRAME,
  type AttemptCommand,
  type AttemptHistory,
} from './attempt-types';

export function currentAttemptState(history: AttemptHistory): string {
  const state = history.entries[history.cursor]?.state;
  if (state === undefined)
    throw new MutationError(
      'PUZZLE_POSITION_INVALID',
      'Open a kept puzzle continuation.'
    );
  return state;
}

/** Every state from the first entry to `through`, replayed through the game's rules. */
export function attemptHistoryStates(args: {
  readonly game: PuzzleContent;
  readonly definition: string;
  readonly history: AttemptHistory;
  readonly through?: number;
}): readonly string[] | null {
  const last = args.through ?? args.history.entries.length - 1;
  const states: string[] = [];
  for (let index = 0; index <= last; index += 1) {
    const entry = args.history.entries[index];
    if (entry === undefined) return null;
    if (entry.state !== undefined) {
      states.push(entry.state);
      continue;
    }
    const before = states[index - 1];
    if (before === undefined || entry.action === null) return null;
    const change = args.game.rules.apply(args.definition, before, entry.action);
    if (!change.accepted) return null;
    states.push(change.state);
  }
  return states;
}

/** Replays from the nearest kept state at or before `index`: at most one keyframe interval. */
function attemptStateAt(args: {
  readonly game: PuzzleContent;
  readonly definition: string;
  readonly history: AttemptHistory;
  readonly index: number;
}): string | null {
  let start = args.index;
  while (start > 0 && args.history.entries[start]?.state === undefined)
    start -= 1;
  let state = args.history.entries[start]?.state;
  for (let index = start + 1; index <= args.index; index += 1) {
    const action = args.history.entries[index]?.action;
    if (state === undefined || action == null) return null;
    const change = args.game.rules.apply(args.definition, state, action);
    state = change.accepted ? change.state : undefined;
  }
  return state ?? null;
}

/** Accepted actions from the starting position to the cursor: a playtest's record. */
export function attemptHistoryActions(
  history: AttemptHistory
): readonly string[] {
  return history.entries
    .slice(1, history.cursor + 1)
    .flatMap((entry) => (entry.action === null ? [] : [entry.action]));
}

/** Canonical: a state at the first entry, every keyframe, and the cursor. */
function compact(history: AttemptHistory, cursorState: string): AttemptHistory {
  return {
    cursor: history.cursor,
    entries: history.entries.map((entry, index) =>
      index === history.cursor
        ? { action: entry.action, state: cursorState }
        : index % ATTEMPT_HISTORY_KEYFRAME === 0 || entry.state === undefined
          ? entry
          : { action: entry.action }
    ),
  };
}

function navigate(args: {
  readonly game: PuzzleContent;
  readonly definition: string;
  readonly history: AttemptHistory;
  readonly kind: 'undo' | 'redo';
}): AttemptHistory {
  const { game, history, kind } = args;
  if (game.history !== 'snapshots')
    throw new MutationError(
      'PUZZLE_HISTORY_UNAVAILABLE',
      'This puzzle does not offer undo or redo. Continue playing or restart.'
    );
  const cursor = history.cursor + (kind === 'undo' ? -1 : 1);
  if (cursor < 0 || cursor >= history.entries.length)
    throw new MutationError(
      kind === 'undo' ? 'PUZZLE_NO_EARLIER_POSITION' : 'PUZZLE_NO_REDO',
      kind === 'undo'
        ? 'There is no earlier puzzle position. Continue playing.'
        : 'There is no later puzzle position. Continue playing.'
    );
  const state = attemptStateAt({ ...args, index: cursor });
  if (state === null)
    throw new MutationError(
      'PUZZLE_POSITION_INVALID',
      'Open another kept continuation. This one stays saved.'
    );
  return compact({ ...history, cursor }, state);
}

export function advanceAttemptHistory(args: {
  readonly game: PuzzleContent;
  readonly definition: string;
  readonly history: AttemptHistory;
  readonly command: AttemptCommand;
}): AttemptHistory {
  const { game, definition, history, command } = args;
  if (command.kind !== 'play')
    return navigate({ game, definition, history, kind: command.kind });
  const change = game.rules.apply(
    definition,
    currentAttemptState(history),
    command.action
  );
  if (!change.accepted)
    throw new MutationError(
      'PUZZLE_ACTION_INVALID',
      change.issues[0]?.message ?? 'Choose a valid puzzle action.',
      { issues: change.issues }
    );
  const entry = { action: command.action, state: change.state };
  if (game.history !== 'snapshots') return { entries: [entry], cursor: 0 };
  if (history.cursor >= 9_999)
    throw new MutationError(
      'PUZZLE_HISTORY_FULL',
      'This attempt has reached its history limit. Start another attempt; this one stays saved.'
    );
  return compact(
    {
      entries: [...history.entries.slice(0, history.cursor + 1), entry],
      cursor: history.cursor + 1,
    },
    change.state
  );
}
