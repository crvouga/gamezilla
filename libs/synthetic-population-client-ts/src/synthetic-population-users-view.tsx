import { Trans, useLingui } from '@lingui/solid/macro';
import { Badge } from '@pkgs/ui-root-client-ts/badge';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { EmptyState } from '@pkgs/ui-root-client-ts/empty-state';
import { ErrorState } from '@pkgs/ui-root-client-ts/error-state';
import { IconButton } from '@pkgs/ui-root-client-ts/icon-button';
import { SlidersHorizontalIcon } from '@pkgs/ui-root-client-ts/icons';
import { LoadingState } from '@pkgs/ui-root-client-ts/loading-state';
import { MenuRow } from '@pkgs/ui-root-client-ts/menu-row';
import { MenuSection } from '@pkgs/ui-root-client-ts/menu-section';
import { StackHorizontal, StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { P } from '@pkgs/ui-root-client-ts/text';
import { TextInput } from '@pkgs/ui-root-client-ts/text-input';
import { For, type JSX, Show } from 'solid-js';
import type { SyntheticPopulationDirectoryPage } from './synthetic-population-api';
import { SyntheticUserAvatar } from './synthetic-user-identity';
import { useActivityLabel } from './synthetic-user-labels';
import { usePersonaCaption } from './synthetic-user-persona';

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
  /** Each row offers its Synthetic User's control panel. */
  readonly canControl: boolean;
  readonly onFilterChange: (value: string) => void;
  readonly onFirstPage: () => void;
  readonly onNextPage: (cursor: string) => void;
  readonly onInspect: (id: string) => void;
  readonly onRetry: () => void;
};

type DirectoryUser = SyntheticPopulationDirectoryPage['users'][number];

/**
 * One Synthetic User in the directory: its face and name, who it is as a
 * player, and a tag for what it is doing (or that it is paused). The row
 * opens it; its control panel is a compact button at the row's end.
 */
function DirectoryRow(
  props: Pick<
    SyntheticPopulationUsersViewProps,
    'canInspect' | 'canControl' | 'onInspect'
  > & { user: DirectoryUser }
): JSX.Element {
  const { t } = useLingui();
  const personaCaption = usePersonaCaption();
  const activity = useActivityLabel();
  return (
    <MenuRow
      leading={<SyntheticUserAvatar user={props.user} size={40} />}
      title={props.user.username}
      caption={
        <StackVertical gap="xs">
          <P variant="caption" lines={2}>
            {props.user.persona === null
              ? t`Persona not recorded`
              : personaCaption(props.user.persona)}
          </P>
          <StackHorizontal gap="xs" wrap>
            <Badge
              label={
                props.user.paused ? t`Paused` : activity(props.user.activity)
              }
              intent={props.user.paused ? 'warning' : 'neutral'}
              size="sm"
            />
          </StackHorizontal>
        </StackVertical>
      }
      onClick={
        props.canInspect ? () => props.onInspect(props.user.id) : undefined
      }
      accessory={
        <Show when={props.canControl}>
          <IconButton
            label={t`Control panel`}
            onClick={() => props.onInspect(props.user.id)}
            dataSet={{
              testid: `synthetic-population-control-panel-${props.user.username}`,
            }}
          >
            <SlidersHorizontalIcon size={20} color="icon" />
          </IconButton>
        </Show>
      }
      dataSet={{ testid: `synthetic-population-user-${props.user.id}` }}
    />
  );
}

/**
 * The Synthetic User directory, presentational: search, one row per user
 * with its face, home region, skill level, favorite games and what it is
 * doing (paused users say so), its loading / empty / failed states and
 * paging. `SyntheticPopulationUsers` reads the pages.
 */
export function SyntheticPopulationUsersView(
  props: SyntheticPopulationUsersViewProps
): JSX.Element {
  const { t } = useLingui();
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
            <DirectoryRow
              user={user}
              canInspect={props.canInspect}
              canControl={props.canControl}
              onInspect={props.onInspect}
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
      <Show when={props.paged || props.page?.nextCursor}>
        <StackHorizontal gap="sm" justify="end">
          <Show when={props.paged}>
            <Button
              title={t`First page`}
              intent="neutral"
              variant="outline"
              size="sm"
              onClick={() => props.onFirstPage()}
            />
          </Show>
          <Show when={props.page?.nextCursor}>
            {(next) => (
              <Button
                title={t`Next page`}
                intent="neutral"
                variant="outline"
                size="sm"
                disabled={props.loading}
                onClick={() => props.onNextPage(next())}
              />
            )}
          </Show>
        </StackHorizontal>
      </Show>
    </StackVertical>
  );
}
