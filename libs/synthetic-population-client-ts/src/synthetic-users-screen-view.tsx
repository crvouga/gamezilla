import type { DenialView } from '@libs/permissions-client-ts/denial-surface-view';
import { Trans, useLingui } from '@lingui/solid/macro';
import { ContentScreen } from '@pkgs/ui-root-client-ts/content-screen';
import {
  DataTable,
  type DataTableFact,
  type DataTablePaging,
} from '@pkgs/ui-root-client-ts/data-table';
import { PauseIcon, PlayIcon } from '@pkgs/ui-root-client-ts/icons';
import { createSignal, type JSX, Show } from 'solid-js';
import {
  type EveryCommand,
  EverySyntheticUserDialogs,
} from './every-synthetic-user-controls';
import type {
  SyntheticPopulationDirectoryPage,
  SyntheticPopulationOverview,
} from './synthetic-population-api';
import { SyntheticPopulationDenial } from './synthetic-population-denial';
import { panelCrumbs, useRefreshAction } from './synthetic-population-frame';
import { useSyntheticUserColumns } from './synthetic-user-columns';

export type SyntheticUsersScreenViewProps = {
  /** Set when the person may not open the panel; replaces the screen. */
  readonly denial?: DenialView | undefined;
  /** The search as typed. */
  readonly search: string;
  readonly onSearch: (value: string) => void;
  /** The page last read; kept in view while the next one loads or fails. */
  readonly page: SyntheticPopulationDirectoryPage | undefined;
  /** A page is being read. */
  readonly loading: boolean;
  /** The last read failed; its retry reads again. */
  readonly failed: boolean;
  readonly onRetry: () => void;
  /** Which page is on screen, counting from 1. */
  readonly pageNumber: number;
  /** Given when there is an earlier page. */
  readonly onPrevious?: (() => void) | undefined;
  /** Given when there is a later page. */
  readonly onNext?: (() => void) | undefined;
  /** The population's counts, for the facts above the rows. */
  readonly overview: SyntheticPopulationOverview | undefined;
  /** Rows open their Synthetic User's control panel. */
  readonly canInspect: boolean;
  readonly onOpenUser: (id: string) => void;
  /** Pausing or resuming every Synthetic User is confirmed first. */
  readonly canControl: boolean;
  /** Why a person who may not control is refused, when they try. */
  readonly controlDenial?: DenialView | undefined;
  readonly onCommandAll: (command: EveryCommand) => Promise<void>;
};

function useFacts(
  props: SyntheticUsersScreenViewProps
): () => readonly DataTableFact[] {
  const { t } = useLingui();
  return () => {
    const overview = props.overview;
    if (overview === undefined) return [];
    return [
      {
        label: t`Desired synthetic population`,
        value: String(overview.config.desired),
        testId: 'synthetic-population-desired-value',
      },
      { label: t`Online`, value: String(overview.online) },
      { label: t`Playing`, value: String(overview.playing) },
      { label: t`Matchmaking`, value: String(overview.matchmaking) },
      { label: t`Recovering`, value: String(overview.recovering) },
    ];
  };
}

function usePaging(
  props: SyntheticUsersScreenViewProps
): () => DataTablePaging | undefined {
  const { t } = useLingui();
  return () => {
    if (props.onPrevious === undefined && props.onNext === undefined)
      return undefined;
    const number = String(props.pageNumber);
    return {
      label: t`Page ${number}`,
      onPrevious: props.onPrevious,
      onNext: props.onNext,
    };
  };
}

function SyntheticUsersTable(
  props: SyntheticUsersScreenViewProps
): JSX.Element {
  const { t } = useLingui();
  const columns = useSyntheticUserColumns();
  const facts = useFacts(props);
  const paging = usePaging(props);
  const refresh = useRefreshAction({
    get loading() {
      return props.loading;
    },
    onRefresh: () => props.onRetry(),
  });
  const [asking, setAsking] = createSignal<EveryCommand | null>(null);
  const count = () => {
    const shown = String(props.page?.users.length ?? 0);
    return props.page === undefined ? undefined : t`${shown} on this page`;
  };
  return (
    <ContentScreen
      screenId="synthetic-users"
      breadcrumbs={panelCrumbs([{ name: <Trans>Synthetic Users</Trans> }])}
      actions={refresh()}
      width="list"
    >
      <DataTable
        caption={t`Synthetic Users`}
        count={count()}
        columns={columns()}
        rows={props.page?.users}
        rowKey={(user) => user.id}
        onRowPress={
          props.canInspect ? (user) => props.onOpenUser(user.id) : undefined
        }
        rowLabel={(user) => {
          const name = user.username;
          return t`Open ${name}'s control panel`;
        }}
        search={{
          value: props.search,
          onChange: (value) => props.onSearch(value),
          label: t`Find Synthetic Users`,
          placeholder: t`Name, activity, region or worker`,
          testId: 'synthetic-population-search',
        }}
        actions={[
          {
            label: t`Pause every Synthetic User`,
            icon: PauseIcon,
            onPress: () => setAsking('pause-all'),
            testId: 'synthetic-population-pause-all',
          },
          {
            label: t`Resume every Synthetic User`,
            icon: PlayIcon,
            onPress: () => setAsking('resume-all'),
            testId: 'synthetic-population-resume-all',
          },
        ]}
        facts={facts()}
        loading={props.loading}
        loadingLabel={t`Reading Synthetic Users…`}
        failure={
          props.failed
            ? {
                title: t`Synthetic Users could not be loaded.`,
                body: t`Check your connection and try again.`,
                onRetry: () => props.onRetry(),
              }
            : undefined
        }
        empty={{
          title: t`No Synthetic Users found`,
          body: t`Change the search or increase the desired synthetic population.`,
        }}
        paging={paging()}
        testId="synthetic-population-user"
      />
      <EverySyntheticUserDialogs
        asking={asking()}
        onClose={() => setAsking(null)}
        canControl={props.canControl}
        denial={props.controlDenial}
        command={props.onCommandAll}
      />
    </ContentScreen>
  );
}

/**
 * `/admin/observatory/synthetic-users/directory`, presentational: every
 * Synthetic User as a table. The population's counts sit above the rows;
 * search, paging, and pausing or resuming every Synthetic User (each a
 * confirmation, or the reason a person may not) belong to the table. A row
 * opens that Synthetic User's control panel. Its loading, refreshing,
 * failed, empty and denied states are distinct. `SyntheticUsersScreen`
 * wires it.
 */
export function SyntheticUsersScreenView(
  props: SyntheticUsersScreenViewProps
): JSX.Element {
  return (
    <Show when={props.denial} fallback={<SyntheticUsersTable {...props} />}>
      {(denial) => <SyntheticPopulationDenial denial={denial()} />}
    </Show>
  );
}
