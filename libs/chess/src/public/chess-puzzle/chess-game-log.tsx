import { Trans } from '@lingui/solid/macro';
import { For, type JSX, Show } from 'solid-js';

import type { ChessPuzzleGameLogEntry } from '../chess-puzzle-stats';
import { ChessGameLogRow } from './chess-game-log-row';

export type ChessGameLogProps = {
  entries: readonly ChessPuzzleGameLogEntry[];
  onSelectEntry: (entry: ChessPuzzleGameLogEntry) => void;
};

export function ChessGameLog(props: ChessGameLogProps): JSX.Element {
  return (
    <Show
      when={props.entries.length > 0}
      fallback={
        <p class="text text-text-secondary">
          {<Trans>No puzzles played yet.</Trans>}
        </p>
      }
    >
      <div class="box gap-2 self-stretch">
        <For each={props.entries}>
          {(entry) => (
            <ChessGameLogRow
              entry={entry}
              onClick={() => props.onSelectEntry(entry)}
            />
          )}
        </For>
      </div>
    </Show>
  );
}
