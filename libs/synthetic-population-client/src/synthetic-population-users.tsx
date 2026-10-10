import { Trans, useLingui } from '@lingui/solid/macro';
import { Button } from '@pkgs/ui-root-client/button';
import { EmptyState } from '@pkgs/ui-root-client/empty-state';
import { ErrorState } from '@pkgs/ui-root-client/error-state';
import { MenuRow } from '@pkgs/ui-root-client/menu-row';
import { MenuSection } from '@pkgs/ui-root-client/menu-section';
import { TextInput } from '@pkgs/ui-root-client/text-input';
import { createResource, createSignal, For, type JSX, Show } from 'solid-js';
import { useSyntheticPopulationApi } from './synthetic-population-api';

export function SyntheticPopulationUsers(props: {
  observedAtMs: number;
  canInspect: boolean;
  inspect: (id: string) => void;
}): JSX.Element {
  const { t } = useLingui();
  const [filter, setFilter] = createSignal('');
  const [cursor, setCursor] = createSignal<string | null>(null);
  const api = useSyntheticPopulationApi();
  const [page] = createResource(
    () => ({ q: filter(), cursor: cursor(), revision: props.observedAtMs }),
    (input) => api.directory(input.q, input.cursor)
  );
  return (
    <div class="box gap-3" data-testid="synthetic-population-users">
      <TextInput
        label={t`Find Synthetic Users`}
        value={filter()}
        onChangeText={(value) => {
          setCursor(null);
          setFilter(value);
        }}
        placeholder={t`Name, activity, region or worker`}
        dataSet={{ testid: 'synthetic-population-search' }}
      />
      <MenuSection title={<Trans>Synthetic Users</Trans>}>
        <For each={page()?.users ?? []}>
          {(user) => (
            <MenuRow
              title={user.username}
              caption={user.id}
              value={user.paused ? t`Paused` : user.activity}
              onClick={
                props.canInspect ? () => props.inspect(user.id) : undefined
              }
              dataSet={{ testid: `synthetic-population-user-${user.id}` }}
            />
          )}
        </For>
        <Show when={!page.loading && !page.error && page()?.users.length === 0}>
          <EmptyState
            variant="compact"
            title={t`No Synthetic Users found`}
            body={t`Change the search or increase the desired synthetic population.`}
          />
        </Show>
      </MenuSection>
      <Show when={page.error}>
        <ErrorState
          variant="compact"
          title={<Trans>Synthetic User directory could not be loaded.</Trans>}
        />
      </Show>
      <div class="box flex-row gap-3">
        <Show when={cursor() !== null}>
          <Button
            title={t`First page`}
            intent="neutral"
            variant="outline"
            onClick={() => setCursor(null)}
          />
        </Show>
        <Show when={page()?.nextCursor}>
          {(next) => (
            <Button
              title={t`Next page`}
              disabled={page.loading}
              onClick={() => setCursor(next())}
            />
          )}
        </Show>
      </div>
    </div>
  );
}
