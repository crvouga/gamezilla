import { Trans, useLingui } from '@lingui/solid/macro';
import { EmptyState } from '@pkgs/ui-root-client/empty-state';
import { MenuRow } from '@pkgs/ui-root-client/menu-row';
import { MenuSection } from '@pkgs/ui-root-client/menu-section';
import { TextInput } from '@pkgs/ui-root-client/text-input';
import { createMemo, createSignal, For, type JSX, Show } from 'solid-js';
import type { SyntheticUserView } from './population-api';

export function PopulationUsers(props: {
  users: readonly SyntheticUserView[];
  canInspect: boolean;
  inspect: (id: string) => void;
}): JSX.Element {
  const { t } = useLingui();
  const [filter, setFilter] = createSignal('');
  const shown = createMemo(() =>
    props.users.filter((user) =>
      `${user.username} ${user.id} ${user.activity} ${user.region} ${user.worker_id ?? ''}`
        .toLowerCase()
        .includes(filter().toLowerCase())
    )
  );
  return (
    <div class="box gap-3" data-testid="population-users">
      <TextInput
        label={t`Find Synthetic Users`}
        value={filter()}
        onChangeText={setFilter}
        placeholder={t`Name, activity, region or worker`}
        dataSet={{ testid: 'population-search' }}
      />
      <MenuSection title={<Trans>Synthetic Users</Trans>}>
        <For each={shown()}>
          {(user) => (
            <MenuRow
              title={user.username}
              caption={user.id}
              value={user.paused ? t`Paused` : user.activity}
              onClick={
                props.canInspect ? () => props.inspect(user.id) : undefined
              }
              dataSet={{ testid: `population-user-${user.id}` }}
            />
          )}
        </For>
        <Show when={shown().length === 0}>
          <EmptyState
            variant="compact"
            title={t`No Synthetic Users found`}
            body={t`Change the search or increase the desired population.`}
          />
        </Show>
      </MenuSection>
    </div>
  );
}
