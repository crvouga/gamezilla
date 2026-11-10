import { Trans, useLingui } from '@lingui/solid/macro';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { EmptyState } from '@pkgs/ui-root-client-ts/empty-state';
import { ErrorState } from '@pkgs/ui-root-client-ts/error-state';
import { LoadingState } from '@pkgs/ui-root-client-ts/loading-state';
import { MenuRow } from '@pkgs/ui-root-client-ts/menu-row';
import { MenuSection } from '@pkgs/ui-root-client-ts/menu-section';
import { StackHorizontal, StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { TextInput } from '@pkgs/ui-root-client-ts/text-input';
import { For, type JSX, Show } from 'solid-js';
import type { SyntheticPopulationDirectoryPage } from './synthetic-population-api';
import { useSkillLabel } from './synthetic-user-persona';

export type SyntheticPopulationUsersViewProps = {
  /** The search text as typed. */
  readonly filter: string;
  /** The latest page read; kept on screen while the next one loads. */
  readonly page: SyntheticPopulationDirectoryPage | undefined;
  /** A page is being read. Without a page this shows the loading state. */
  readonly loading: boolean;
  /** The last read failed; shows a retryable error under the list. */
  readonly failed: boolean;
  /** The directory is past its first page, so "First page" is offered. */
  readonly paged: boolean;
  /** Rows open their Synthetic User only when the person may inspect. */
  readonly canInspect: boolean;
  readonly onFilterChange: (value: string) => void;
  readonly onFirstPage: () => void;
  readonly onNextPage: (cursor: string) => void;
  readonly onInspect: (id: string) => void;
  readonly onRetry: () => void;
};

/**
 * The Synthetic User directory, presentational: search, one row per user
 * (paused users say so), its loading / empty / failed states and paging.
 * `SyntheticPopulationUsers` reads the pages.
 */
export function SyntheticPopulationUsersView(
  props: SyntheticPopulationUsersViewProps
): JSX.Element {
  const { t } = useLingui();
  const skill = useSkillLabel();
  return (
    <StackVertical gap="md" testId="synthetic-population-users">
      <TextInput
        label={t`Find Synthetic Users`}
        value={props.filter}
        onChangeText={(value) => props.onFilterChange(value)}
        placeholder={t`Name, activity, region or worker`}
        dataSet={{ testid: 'synthetic-population-search' }}
      />
      <MenuSection title={<Trans>Synthetic Users</Trans>}>
        <For each={props.page?.users ?? []}>
          {(user) => (
            <MenuRow
              title={user.username}
              caption={
                user.persona === null
                  ? user.id
                  : `${user.persona.homeRegion} · ${skill(user.persona.skillLevel)}`
              }
              value={user.paused ? t`Paused` : user.activity}
              onClick={
                props.canInspect ? () => props.onInspect(user.id) : undefined
              }
              dataSet={{ testid: `synthetic-population-user-${user.id}` }}
            />
          )}
        </For>
        <Show when={props.loading && props.page === undefined}>
          <LoadingState
            variant="compact"
            caption={<Trans>Reading Synthetic Users…</Trans>}
          />
        </Show>
        <Show
          when={
            !props.loading && !props.failed && props.page?.users.length === 0
          }
        >
          <EmptyState
            variant="compact"
            title={t`No Synthetic Users found`}
            body={t`Change the search or increase the desired synthetic population.`}
          />
        </Show>
      </MenuSection>
      <Show when={props.failed}>
        <ErrorState
          variant="compact"
          title={<Trans>Synthetic User directory could not be loaded.</Trans>}
          body={<Trans>Check your connection and try again.</Trans>}
          retry={{ onClick: () => props.onRetry() }}
        />
      </Show>
      <StackHorizontal gap="md">
        <Show when={props.paged}>
          <Button
            title={t`First page`}
            intent="neutral"
            variant="outline"
            onClick={() => props.onFirstPage()}
          />
        </Show>
        <Show when={props.page?.nextCursor}>
          {(next) => (
            <Button
              title={t`Next page`}
              disabled={props.loading}
              onClick={() => props.onNextPage(next())}
            />
          )}
        </Show>
      </StackHorizontal>
    </StackVertical>
  );
}
