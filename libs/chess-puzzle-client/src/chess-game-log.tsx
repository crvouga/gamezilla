import type { ChessPuzzleGameLogEntry } from '@libs/chess-puzzle-shared/chess-puzzle-stats';
import { Trans } from '@lingui/solid/macro';
import { MenuSection } from '@pkgs/ui-root-client/menu-section';
import { For, type JSX, Show } from 'solid-js';
import { ChessGameLogRow } from './chess-game-log-row';

export type ChessGameLogProps = {
  entries: readonly ChessPuzzleGameLogEntry[];
  onSelectEntry: (entry: ChessPuzzleGameLogEntry) => void;
};

/** Every puzzle the player has played, newest first, as one panel of rows. */
export function ChessGameLog(props: ChessGameLogProps): JSX.Element {
  return (
    <Show
      when={props.entries.length > 0}
      fallback={
        <section class="box gap-2">
          <h3 class="text textNavigationTitle">
            <Trans>Game log</Trans>
          </h3>
          <p class="text textCaption" data-testid="chess-game-log-empty">
            <Trans>No puzzles played yet.</Trans>
          </p>
        </section>
      }
    >
      <MenuSection title={<Trans>Game log</Trans>}>
        <For each={props.entries}>
          {(entry) => (
            <ChessGameLogRow
              entry={entry}
              onClick={() => props.onSelectEntry(entry)}
            />
          )}
        </For>
      </MenuSection>
    </Show>
  );
}
