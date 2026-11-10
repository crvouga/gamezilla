import { Trans, useLingui } from '@lingui/solid/macro';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { MenuRow } from '@pkgs/ui-root-client-ts/menu-row';
import { MenuSection } from '@pkgs/ui-root-client-ts/menu-section';
import { useMutationButton } from '@pkgs/ui-root-client-ts/use-mutation-button';
import { For, type JSX, Show } from 'solid-js';
import type { SyntheticUserReplayResult } from './synthetic-population-api';
import { useMomentLabel } from './synthetic-user-labels';

/**
 * Decision Policy replay, presentational: the replay button and, once a
 * replay finished, whether each recorded choice was reproduced.
 * `SyntheticUserReplay` runs the replay and keeps its result.
 */
export function SyntheticUserReplayView(props: {
  /** The last replay's outcome, or null before the first replay. */
  result: SyntheticUserReplayResult | null;
  /** Runs a replay; the button shows its progress and outcome. */
  onReplay: () => Promise<void>;
}): JSX.Element {
  const { t } = useLingui();
  const moment = useMomentLabel();
  const action = useMutationButton({
    labels: {
      idle: t`Replay decisions`,
      success: t`Replay completed`,
      error: t`Try again`,
    },
    operation: () => props.onReplay(),
  });
  return (
    <MenuSection
      title={<Trans>Decision Policy replay</Trans>}
      footer={
        <Trans>
          Replays recorded choices and random inputs. Application timing and
          external services are not replayed.
        </Trans>
      }
    >
      <MenuRow
        title={<Trans>Recorded decisions</Trans>}
        caption={
          props.result === null
            ? t`Not replayed yet`
            : t`Replayed with the current Decision Policy`
        }
        trailing={
          <Button
            {...action.buttonProps}
            intent="neutral"
            variant="outline"
            size="sm"
            dataSet={{ testid: 'synthetic-population-replay' }}
          />
        }
      />
      <Show when={props.result}>
        {(value) => (
          <For each={value().decisions}>
            {(item) => (
              <MenuRow
                title={moment(item.createdAt)}
                caption={item.eventId}
                value={
                  item.result === null
                    ? t`Inputs unavailable`
                    : item.result.matches
                      ? t`Choice reproduced`
                      : t`Policy changed`
                }
              />
            )}
          </For>
        )}
      </Show>
    </MenuSection>
  );
}
