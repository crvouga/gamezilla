import { useCan } from '@libs/permissions-client/use-can';
import { PERMISSION } from '@libs/permissions-shared/permission-catalog';
import { Trans, useLingui } from '@lingui/solid/macro';
import { Button } from '@pkgs/ui-root-client/button';
import { MenuRow } from '@pkgs/ui-root-client/menu-row';
import { MenuSection } from '@pkgs/ui-root-client/menu-section';
import { useMutationButton } from '@pkgs/ui-root-client/use-mutation-button';
import { createSignal, For, type JSX, Show } from 'solid-js';
import {
  type SyntheticPopulationApi,
  useSyntheticPopulationApi,
} from './synthetic-population-api';

export function SyntheticUserReplay(props: { userId: string }): JSX.Element {
  const canReplay = useCan(PERMISSION.syntheticPopulationReplay);
  const api = useSyntheticPopulationApi();
  const { t } = useLingui();
  const [result, setResult] = createSignal<Awaited<
    ReturnType<SyntheticPopulationApi['replay']>
  > | null>(null);
  const action = useMutationButton({
    labels: {
      idle: t`Replay decisions`,
      success: t`Replay completed`,
      error: t`Try again`,
    },
    operation: async () => {
      setResult(await api.replay(props.userId));
    },
  });
  return (
    <Show when={canReplay()}>
      <MenuSection
        title={<Trans>Decision Policy replay</Trans>}
        footer={
          <Trans>
            Replays recorded choices and random inputs. Application timing and
            external services are not replayed.
          </Trans>
        }
      >
        <Button
          {...action.buttonProps}
          dataSet={{ testid: 'synthetic-population-replay' }}
        />
        <Show when={result()}>
          {(value) => (
            <For each={value().decisions}>
              {(item) => (
                <MenuRow
                  title={item.eventId}
                  caption={item.createdAt}
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
    </Show>
  );
}
