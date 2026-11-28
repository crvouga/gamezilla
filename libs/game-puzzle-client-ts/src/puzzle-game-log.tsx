import type { PuzzleGameLogEntry } from '@libs/game-puzzle-shared-ts/stats';
import { Trans } from '@pkgs/lingui-solid-client-ts/macro';
import { EmptyState } from '@pkgs/ui-root-client-ts/empty-state';
import { HistoryArt } from '@pkgs/ui-root-client-ts/illustration';
import { MenuSection } from '@pkgs/ui-root-client-ts/menu-section';
import type { JSX } from '@solidjs/web';
import { For, Show } from 'solid-js';
import { PuzzleGameLogRow } from './puzzle-game-log-row';

export type PuzzleGameLogProps = {
  entries: readonly PuzzleGameLogEntry[];
  onSelectEntry: (entry: PuzzleGameLogEntry) => void;
};

/** Every puzzle the player has played, newest first, as one panel of rows. */
export function PuzzleGameLog(props: PuzzleGameLogProps): JSX.Element {
  return (
    <Show
      when={props.entries.length > 0}
      fallback={
        <EmptyState
          variant="compact"
          icon={HistoryArt}
          title={<Trans>No puzzles played yet.</Trans>}
          body={<Trans>Solve a puzzle and it shows up here.</Trans>}
          dataSet={{ testid: 'chess-game-log-empty' }}
        />
      }
    >
      <MenuSection>
        <For each={props.entries}>
          {(entry) => (
            <PuzzleGameLogRow
              entry={entry}
              onClick={() => props.onSelectEntry(entry)}
            />
          )}
        </For>
      </MenuSection>
    </Show>
  );
}
