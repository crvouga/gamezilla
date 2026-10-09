import { activitySchema } from '@libs/population-shared/config';
import type { Inspection } from '@libs/population-shared/inspection';
import { Trans, useLingui } from '@lingui/solid/macro';
import { MenuRow } from '@pkgs/ui-root-client/menu-row';
import { MenuSection } from '@pkgs/ui-root-client/menu-section';
import { For, type JSX, Show } from 'solid-js';

export function SyntheticUserStatechart(props: {
  activity: string;
  snapshot: Inspection | null;
}): JSX.Element {
  const { t } = useLingui();
  return (
    <MenuSection title={<Trans>Behavior Statechart</Trans>}>
      <For each={activitySchema.options}>
        {(state) => (
          <MenuRow
            title={state}
            value={state === props.activity ? t`Current` : ''}
            dataSet={{ testid: `population-state-${state}` }}
          />
        )}
      </For>
      <Show when={props.snapshot}>
        {(snapshot) => (
          <>
            <MenuRow
              title={<Trans>Active state</Trans>}
              value={snapshot().state}
            />
            <MenuRow
              title={<Trans>Available transitions</Trans>}
              value={snapshot().transitions.join(', ')}
            />
          </>
        )}
      </Show>
    </MenuSection>
  );
}
