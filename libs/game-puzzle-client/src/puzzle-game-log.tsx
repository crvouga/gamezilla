import type { PuzzleGameLogEntry } from '@libs/game-puzzle-shared/stats';
import { Trans } from '@lingui/solid/macro';
import { EmptyState } from '@pkgs/ui-root-client/empty-state';
import { ListChecksIcon } from '@pkgs/ui-root-client/icons';
import { MenuSection } from '@pkgs/ui-root-client/menu-section';
import { For, type JSX, Show } from 'solid-js';
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
          icon={ListChecksIcon}
          title={<Trans>No puzzles played yet.</Trans>}
          dataSet={{ testid: 'chess-game-log-empty' }}
        />
      }
    >
      <MenuSection title={<Trans>Game log</Trans>}>
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
