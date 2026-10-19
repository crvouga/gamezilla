import type { PuzzleRecommendationEntry } from '@libs/game-puzzle-shared/recommendations';
import { UserUsername } from '@libs/profile-client/user-username';
import { Trans } from '@lingui/solid/macro';
import { XIcon } from '@pkgs/ui-root-client/icons';
import { type Accessor, For, type JSX, Show } from 'solid-js';

/** A suggestion's chip label: the cells it names, e.g. `e2→e4`. */
function suggestionLabel(entry: PuzzleRecommendationEntry): string {
  return `${entry.from}→${entry.to}`;
}

/**
 * Who suggested which move, in their arrow colour. The viewer's own chip can
 * be withdrawn; everyone else's clears when the host moves on.
 */
export function PuzzleRecommendationLegend(props: {
  entries: Accessor<readonly PuzzleRecommendationEntry[]>;
  colorFor: (memberId: string) => string;
  myId: string;
  onClearMine: () => void;
}): JSX.Element {
  return (
    <Show when={props.entries().length > 0}>
      <div
        class="box flex-row items-center gap-2 self-stretch px-3 py-1 overflow-hidden"
        data-testid="chess-puzzle-recommendation-legend"
      >
        <p class="text textCaption shrink-0 text-text-secondary">
          <Trans>Suggested</Trans>
        </p>
        <For each={props.entries()}>
          {(entry) => (
            <div class="box flex-row items-center gap-1 shrink-0">
              <div
                class="box w-2.5 h-2.5 rounded-full"
                style={{ 'background-color': props.colorFor(entry.by) }}
              />
              <UserUsername
                profileId={entry.by}
                withAt={false}
                variant="caption"
                numberOfLines={1}
              />
              <p class="text textCaption">{suggestionLabel(entry)}</p>
              <Show when={entry.by === props.myId}>
                <button
                  type="button"
                  class="clickable box items-center justify-center"
                  aria-label="Clear my suggestion"
                  data-testid="chess-puzzle-recommendation-clear"
                  onClick={props.onClearMine}
                >
                  <XIcon size={12} color="textSecondary" />
                </button>
              </Show>
            </div>
          )}
        </For>
      </div>
    </Show>
  );
}
