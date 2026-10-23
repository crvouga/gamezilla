import type { PuzzleRecommendationEntry } from '@libs/game-puzzle-shared-ts/recommendations';
import { UserUsername } from '@libs/profile-client-ts/user-username';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/solid/macro';
import { XIcon } from '@pkgs/ui-root-client-ts/icons';
import { Pressable } from '@pkgs/ui-root-client-ts/pressable';
import { StackHorizontal } from '@pkgs/ui-root-client-ts/stack';
import { StatusDot } from '@pkgs/ui-root-client-ts/status-dot';
import { P } from '@pkgs/ui-root-client-ts/text';
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
      <StackHorizontal
        align="center"
        gap="sm"
        self="stretch"
        paddingX="md"
        paddingY="xs"
        overflow="hidden"
        testId="chess-puzzle-recommendation-legend"
      >
        <P variant="caption" tone="secondary">
          <Trans>Suggested</Trans>
        </P>
        <For each={props.entries()}>
          {(entry) => (
            <StackHorizontal align="center" gap="xs">
              <StatusDot color={props.colorFor(entry.by)} />
              <UserUsername
                profileId={entry.by}
                withAt={false}
                variant="caption"
                numberOfLines={1}
              />
              <P variant="caption">{suggestionLabel(entry)}</P>
              <Show when={entry.by === props.myId}>
                <Pressable
                  align="center"
                  justify="center"
                  radius="full"
                  aria-label={t`Clear my suggestion`}
                  testId="chess-puzzle-recommendation-clear"
                  onPress={props.onClearMine}
                >
                  <XIcon size={12} color="textSecondary" />
                </Pressable>
              </Show>
            </StackHorizontal>
          )}
        </For>
      </StackHorizontal>
    </Show>
  );
}
