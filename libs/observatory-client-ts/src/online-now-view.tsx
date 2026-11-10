import type { OnlineNowFilter } from '@libs/observatory-shared-ts/live-session';
import { DeviceAvatar } from '@libs/profile-client-ts/device-avatar';
import { parseAvatarConfig } from '@libs/profile-shared-ts/avatar-config';
import { Trans, useLingui } from '@lingui/solid/macro';
import { Badge } from '@pkgs/ui-root-client-ts/badge';
import { ChipGroup } from '@pkgs/ui-root-client-ts/chip-group';
import { EmptyState } from '@pkgs/ui-root-client-ts/empty-state';
import { ErrorState } from '@pkgs/ui-root-client-ts/error-state';
import { IconButton } from '@pkgs/ui-root-client-ts/icon-button';
import { SlidersHorizontalIcon } from '@pkgs/ui-root-client-ts/icons';
import { LoadingState } from '@pkgs/ui-root-client-ts/loading-state';
import { MenuRow } from '@pkgs/ui-root-client-ts/menu-row';
import { MenuSection } from '@pkgs/ui-root-client-ts/menu-section';
import { StackHorizontal, StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { P } from '@pkgs/ui-root-client-ts/text';
import { For, type JSX, Show } from 'solid-js';
import { useLiveLabels } from './live-labels';
import type { OnlineNowEntryView } from './observatory-api';

export type OnlineNowViewProps = {
  /** Which of those online now are shown. */
  readonly filter: OnlineNowFilter;
  /**
   * The latest list read; kept on screen while the next one loads and when
   * a later read fails, so what was known stays in view.
   */
  readonly entries: readonly OnlineNowEntryView[] | undefined;
  /** A read is under way. Without a list this shows the loading state. */
  readonly loading: boolean;
  /** The last read failed; shows a retryable error under the list. */
  readonly failed: boolean;
  /** Rows open a live view of that app's screen. */
  readonly canWatch: boolean;
  /** Synthetic User rows offer their control panel. */
  readonly canControl: boolean;
  readonly onFilterChange: (filter: OnlineNowFilter) => void;
  readonly onWatch: (sessionId: string) => void;
  readonly onControlPanel: (syntheticUserId: string) => void;
  readonly onRetry: () => void;
};

/**
 * One app online now: its face and name, what it is doing in a line of its
 * own, then a tag each for a person or a Synthetic User, paused, and its
 * place in the app. The row opens a live view; a Synthetic User's control
 * panel is a compact button at the row's end, never a wide one that
 * crowds what it is doing.
 */
function OnlineNowRow(
  props: Pick<
    OnlineNowViewProps,
    'canWatch' | 'canControl' | 'onWatch' | 'onControlPanel'
  > & { entry: OnlineNowEntryView }
): JSX.Element {
  const { t } = useLingui();
  const labels = useLiveLabels();
  const controlPanel = () =>
    props.canControl ? props.entry.syntheticUserId : null;
  return (
    <MenuRow
      leading={
        <DeviceAvatar
          avatarConfig={parseAvatarConfig(props.entry.avatarConfig)}
          seedFallback={props.entry.accountId}
          name={props.entry.username}
          size={40}
        />
      }
      title={props.entry.username || t`Unnamed`}
      caption={
        <StackVertical gap="xs">
          <P variant="caption" lines={2}>
            {labels.activity(props.entry)}
          </P>
          <StackHorizontal gap="xs" wrap>
            <Badge
              label={labels.kind(props.entry.kind)}
              intent="neutral"
              size="sm"
            />
            <Show when={props.entry.paused}>
              <Badge label={t`Paused`} intent="warning" size="sm" />
            </Show>
            <Badge
              label={labels.place(props.entry.place)}
              intent="neutral"
              size="sm"
            />
          </StackHorizontal>
        </StackVertical>
      }
      hideChevron={!props.canWatch}
      onClick={
        props.canWatch ? () => props.onWatch(props.entry.sessionId) : undefined
      }
      accessory={
        <Show when={controlPanel()}>
          {(id) => (
            <IconButton
              label={t`Control panel`}
              onClick={() => props.onControlPanel(id())}
              dataSet={{
                testid: `online-now-control-panel-${props.entry.username}`,
              }}
            >
              <SlidersHorizontalIcon size={20} color="icon" />
            </IconButton>
          )}
        </Show>
      }
      dataSet={{ testid: `online-now-row-${props.entry.username}` }}
    />
  );
}

/**
 * Whoever is online now, presentational: a filter for everyone, people or
 * Synthetic Users (chips that size to their words, so they fit a phone),
 * then a person or a Synthetic User per row with what each is doing, and
 * its loading, empty and failed states. Only Synthetic User rows offer a
 * control panel. `OnlineNow` reads the list.
 */
export function OnlineNowView(props: OnlineNowViewProps): JSX.Element {
  const { t } = useLingui();
  return (
    <StackVertical gap="md" testId="online-now">
      <ChipGroup
        aria-label={t`Show who is online now`}
        options={[
          {
            key: 'everyone',
            label: t`Everyone`,
            testid: 'online-now-filter-everyone',
          },
          {
            key: 'people',
            label: t`People`,
            testid: 'online-now-filter-people',
          },
          {
            key: 'synthetic',
            label: t`Synthetic Users`,
            testid: 'online-now-filter-synthetic',
          },
        ]}
        selected={props.filter}
        onSelect={(key) => props.onFilterChange(key)}
        dataSet={{ testid: 'online-now-filter' }}
      />
      <MenuSection title={<Trans>Online now</Trans>}>
        <For each={props.entries ?? []}>
          {(entry) => (
            <OnlineNowRow
              entry={entry}
              canWatch={props.canWatch}
              canControl={props.canControl}
              onWatch={props.onWatch}
              onControlPanel={props.onControlPanel}
            />
          )}
        </For>
        <Show when={props.loading && props.entries === undefined}>
          <LoadingState
            variant="compact"
            caption={<Trans>Reading who is online now…</Trans>}
          />
        </Show>
        <Show
          when={!props.loading && !props.failed && props.entries?.length === 0}
        >
          <EmptyState
            variant="compact"
            title={t`Nobody is online now`}
            body={t`People and Synthetic Users appear here as soon as they open the app.`}
          />
        </Show>
      </MenuSection>
      <Show when={props.failed}>
        <ErrorState
          variant="compact"
          title={<Trans>Online now could not be loaded.</Trans>}
          body={<Trans>Check your connection and try again.</Trans>}
          retry={{ onClick: () => props.onRetry() }}
        />
      </Show>
    </StackVertical>
  );
}
