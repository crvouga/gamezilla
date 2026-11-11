import type { OnlineNowFilter } from '@libs/observatory-shared-ts/live-session';
import { OBSERVATORY_PATH } from '@libs/observatory-shared-ts/observatory-routes';
import type { DenialView } from '@libs/permissions-client-ts/denial-surface-view';
import { AccountAutomationBadge } from '@libs/profile-client-ts/account-automation-badge';
import { DeviceAvatar } from '@libs/profile-client-ts/device-avatar';
import { parseAvatarConfig } from '@libs/profile-shared-ts/avatar-config';
import { Trans, useLingui } from '@lingui/solid/macro';
import { Badge } from '@pkgs/ui-root-client-ts/badge';
import { ContentScreen } from '@pkgs/ui-root-client-ts/content-screen';
import { DataTable } from '@pkgs/ui-root-client-ts/data-table';
import { StackHorizontal } from '@pkgs/ui-root-client-ts/stack';
import type { TableColumn } from '@pkgs/ui-root-client-ts/table';
import { P, Text } from '@pkgs/ui-root-client-ts/text';
import { type Accessor, createMemo, type JSX, Show } from 'solid-js';
import { useLiveLabels } from './live-labels';
import type { OnlineNowEntryView } from './observatory-api';
import { ObservatoryDenial } from './observatory-denial';

export type OnlineNowScreenViewProps = {
  /** Set when the person may not view the User Observatory; replaces the screen. */
  readonly denial?: DenialView | undefined;
  /** Which of those online now are shown. */
  readonly filter: OnlineNowFilter;
  /** The name typed into the search; narrows the rows as typed. */
  readonly search: string;
  /**
   * The latest list read; kept on screen while the next one loads and when
   * a later read fails, so what was known stays in view.
   */
  readonly entries: readonly OnlineNowEntryView[] | undefined;
  /** A read is under way: the loading state without a list, else refreshing. */
  readonly loading: boolean;
  /** The last read failed; offers a retry, above the last list if there is one. */
  readonly failed: boolean;
  /** Rows open a live view of that app's screen. */
  readonly canWatch: boolean;
  readonly onFilterChange: (filter: OnlineNowFilter) => void;
  readonly onSearchChange: (search: string) => void;
  readonly onWatch: (sessionId: string) => void;
  readonly onRetry: () => void;
};

/** Whether the entry's name holds what was typed. */
function matches(entry: OnlineNowEntryView, search: string): boolean {
  return entry.username.toLowerCase().includes(search.trim().toLowerCase());
}

/** The row's key and handle: its name, as a harness or a link names it. */
function rowKey(entry: OnlineNowEntryView): string {
  return entry.username || entry.sessionId;
}

function NameCell(props: { entry: OnlineNowEntryView }): JSX.Element {
  const { t } = useLingui();
  return (
    <StackHorizontal gap="sm" align="center">
      <DeviceAvatar
        avatarConfig={parseAvatarConfig(props.entry.avatarConfig)}
        seedFallback={props.entry.accountId}
        name={props.entry.username}
        size={32}
      />
      <P variant="rowTitle" lines={1}>
        <Text variant="inherit" wrap="break">
          {props.entry.username || t`Unnamed`}
        </Text>
      </P>
    </StackHorizontal>
  );
}

function KindCell(props: { entry: OnlineNowEntryView }): JSX.Element {
  const { t } = useLingui();
  const labels = useLiveLabels();
  return (
    <StackHorizontal gap="xs" wrap>
      <Badge label={labels.kind(props.entry.kind)} intent="neutral" size="sm" />
      <AccountAutomationBadge
        profileId={props.entry.accountId}
        isBot={props.entry.kind === 'synthetic'}
      />
      <Show when={props.entry.paused}>
        <Badge label={t`Paused`} intent="warning" size="sm" />
      </Show>
    </StackHorizontal>
  );
}

function useColumns(): Accessor<readonly TableColumn<OnlineNowEntryView>[]> {
  const { t, i18n } = useLingui();
  const labels = useLiveLabels();
  const time = (atMs: number) =>
    new Intl.DateTimeFormat(i18n().locale, { timeStyle: 'short' }).format(
      new Date(atMs)
    );
  return createMemo(() => [
    {
      key: 'name',
      header: t`Name`,
      primary: true,
      sortValue: (entry) => entry.username,
      render: (entry) => <NameCell entry={entry} />,
    },
    {
      key: 'kind',
      header: t`Kind`,
      sortValue: (entry) => labels.kind(entry.kind),
      render: (entry) => <KindCell entry={entry} />,
    },
    {
      key: 'doing',
      header: t`Doing`,
      sortValue: (entry) => labels.activity(entry),
      render: (entry) => labels.activity(entry),
    },
    {
      key: 'place',
      header: t`Place`,
      sortValue: (entry) => labels.place(entry.place),
      render: (entry) => labels.place(entry.place),
    },
    {
      key: 'seen',
      header: t`Last seen`,
      align: 'end',
      width: 'min',
      sortValue: (entry) => entry.heartbeatAtMs,
      render: (entry) => time(entry.heartbeatAtMs),
    },
  ]);
}

function OnlineNowTable(props: OnlineNowScreenViewProps): JSX.Element {
  const { t } = useLingui();
  const columns = useColumns();
  const rows = () =>
    props.entries?.filter((entry) => matches(entry, props.search));
  const count = () => {
    const shown = rows()?.length;
    return shown === undefined ? undefined : t`${shown} online now`;
  };
  return (
    <DataTable<OnlineNowEntryView, OnlineNowFilter>
      caption={t`Online now`}
      count={count()}
      columns={columns()}
      rows={rows()}
      rowKey={rowKey}
      defaultSort={{ key: 'name', direction: 'ascending' }}
      onRowPress={
        props.canWatch ? (entry) => props.onWatch(entry.sessionId) : undefined
      }
      rowLabel={(entry) => t`Watch ${entry.username} live`}
      search={{
        value: props.search,
        onChange: (value) => props.onSearchChange(value),
        label: t`Find someone online now`,
        placeholder: t`Name`,
        testId: 'online-now-search',
      }}
      filter={{
        label: t`Show who is online now`,
        options: [
          {
            key: 'everyone',
            label: t`Everyone`,
            testId: 'online-now-filter-everyone',
          },
          {
            key: 'people',
            label: t`People`,
            testId: 'online-now-filter-people',
          },
          {
            key: 'synthetic',
            label: t`Synthetic Users`,
            testId: 'online-now-filter-synthetic',
          },
        ],
        selected: props.filter,
        onSelect: (key) => props.onFilterChange(key),
        testId: 'online-now-filter',
      }}
      loading={props.loading}
      loadingLabel={t`Reading who is online now…`}
      failure={
        props.failed
          ? {
              title: t`Online now could not be loaded.`,
              body: t`Check your connection and try again.`,
              onRetry: () => props.onRetry(),
            }
          : undefined
      }
      empty={
        props.search.trim() === ''
          ? {
              title: t`Nobody is online now`,
              body: t`People and Synthetic Users appear here as soon as they open the app.`,
            }
          : {
              title: t`Nobody online now has that name`,
              body: t`Check the name or clear the search.`,
            }
      }
      testId="online-now-row"
    />
  );
}

/**
 * `/admin/observatory/online`, presentational: whoever is online now,
 * people and Synthetic Users, as one table — each one's face and name,
 * whether a person or a Synthetic User (with its Bot tag, and paused when
 * it is), what they are doing, their place in the app and when they were
 * last seen. A search by name and a filter for everyone, people or
 * Synthetic Users head it; rows open a live view for those who may watch.
 * Its loading, refreshing, empty, failed (keeping the last list) and denied
 * states. `OnlineNowScreen` reads the list.
 */
export function OnlineNowScreenView(
  props: OnlineNowScreenViewProps
): JSX.Element {
  return (
    <Show
      when={props.denial}
      fallback={
        <ContentScreen
          screenId="online-now"
          width="list"
          breadcrumbs={[
            { name: <Trans>Profile</Trans>, href: '/profile' },
            { name: <Trans>Settings</Trans>, href: '/more' },
            { name: <Trans>User Observatory</Trans>, href: OBSERVATORY_PATH },
            { name: <Trans>Online now</Trans> },
          ]}
        >
          <OnlineNowTable {...props} />
        </ContentScreen>
      }
    >
      {(denial) => <ObservatoryDenial denial={denial()} />}
    </Show>
  );
}
