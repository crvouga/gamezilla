import { MutationError } from '@pkgs/sync-engine-shared-ts/mutations-types';
import type { PuzzleContent } from '@pkgs/turn-game-shared-ts/puzzle-content';
import type { AttemptCommand, AttemptHistory } from './attempt-types';

export function currentAttemptState(history: AttemptHistory): string {
  const entry = history.entries[history.cursor];
  if (entry === undefined)
    throw new MutationError(
      'PUZZLE_POSITION_INVALID',
      'Open a kept puzzle continuation.'
    );
  return entry.state;
}

export function advanceAttemptHistory(args: {
  readonly game: PuzzleContent;
  readonly definition: string;
  readonly history: AttemptHistory;
  readonly command: AttemptCommand;
}): AttemptHistory {
  const { game, definition, history, command } = args;
  if (command.kind !== 'play') {
    if (game.history !== 'snapshots')
      throw new MutationError(
        'PUZZLE_HISTORY_UNAVAILABLE',
        'This puzzle does not offer undo or redo. Continue playing or restart.'
      );
    const cursor = history.cursor + (command.kind === 'undo' ? -1 : 1);
    if (cursor < 0 || cursor >= history.entries.length)
      throw new MutationError(
        command.kind === 'undo'
          ? 'PUZZLE_NO_EARLIER_POSITION'
          : 'PUZZLE_NO_REDO',
        command.kind === 'undo'
          ? 'There is no earlier puzzle position. Continue playing.'
          : 'There is no later puzzle position. Continue playing.'
      );
    return { ...history, cursor };
  }
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
  return {
    entries: [...history.entries.slice(0, history.cursor + 1), entry],
    cursor: history.cursor + 1,
  };
}
