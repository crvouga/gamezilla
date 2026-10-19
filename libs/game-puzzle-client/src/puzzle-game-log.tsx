import type { PuzzleGameLogEntry } from '@libs/game-puzzle-shared/stats';
import { Trans } from '@lingui/solid/macro';
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
