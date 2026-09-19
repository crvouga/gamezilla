import { UserUsername } from '@libs/profile/public/user-username';
import { Trans } from '@lingui/solid/macro';
import { XIcon } from '@pkgs/ui';
import { type Accessor, For, type JSX, Show } from 'solid-js';

import {
  type ChessPuzzleRecommendationEntry,
  formatRecommendedMove,
} from '../../shared/puzzle-session/recommendations';

/**
 * Who suggested which move, in their arrow colour. The viewer's own chip can
 * be withdrawn; everyone else's clears when the host moves on.
 */
export function ChessPuzzleRecommendationLegend(props: {
  entries: Accessor<readonly ChessPuzzleRecommendationEntry[]>;
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
                class="box w-[10px] h-[10px] rounded-[5px]"
                style={{ 'background-color': props.colorFor(entry.by) }}
              />
              <UserUsername
                profileId={entry.by}
                withAt={false}
                variant="caption"
                numberOfLines={1}
              />
              <p class="text textMono textCaption text-text">
                {formatRecommendedMove(entry.from, entry.to)}
              </p>
              <Show when={entry.by === props.myId}>
                <button
                  type="button"
                  class="box items-center justify-center"
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
