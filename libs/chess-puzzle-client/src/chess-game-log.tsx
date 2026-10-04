import type { ChessPuzzleGameLogEntry } from '@libs/chess-puzzle-shared/chess-puzzle-stats';
import { Trans } from '@lingui/solid/macro';
import { For, type JSX, Show } from 'solid-js';
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
        <p class="text text-text-secondary" data-testid="chess-game-log-empty">
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
