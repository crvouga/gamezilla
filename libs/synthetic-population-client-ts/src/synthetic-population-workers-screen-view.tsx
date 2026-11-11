import type { DenialView } from '@libs/permissions-client-ts/denial-surface-view';
import { Trans, useLingui } from '@lingui/solid/macro';
import { Badge } from '@pkgs/ui-root-client-ts/badge';
import { ContentScreen } from '@pkgs/ui-root-client-ts/content-screen';
import { DataTable } from '@pkgs/ui-root-client-ts/data-table';
import { StackHorizontal } from '@pkgs/ui-root-client-ts/stack';
import type { TableColumn } from '@pkgs/ui-root-client-ts/table';
import { Text } from '@pkgs/ui-root-client-ts/text';
import { type JSX, Show } from 'solid-js';
import type { SyntheticPopulationOverview } from './synthetic-population-api';
import { SyntheticPopulationDenial } from './synthetic-population-denial';
import { panelCrumbs, useRefreshAction } from './synthetic-population-frame';
import { useMomentLabel } from './synthetic-user-labels';

/** A worker's health as its last heartbeat and draining flag tell it. */
export type WorkerHealth = 'ready' | 'draining' | 'unreachable';

/** One Synthetic Population Worker as its table lists it. */
export type WorkerRow = {
  readonly id: string;
  readonly health: WorkerHealth;
  readonly version: string;
  readonly heartbeatAt: string;
  readonly active: number;
  readonly available: number;
  readonly memoryBytes: number | null;
  readonly cpuMilliseconds: number | null;
  readonly leaseFailures: number;
};

/** The workers in an overview, with what each runs and can still take. */
export function workerRows(
  overview: SyntheticPopulationOverview
): readonly WorkerRow[] {
  return overview.workers.map((worker) => {
    const active =
      overview.workerAssignments.find((row) => row.worker_id === worker.id)
        ?.count ?? 0;
    const capacity = Math.min(
      worker.capacity,
      overview.config.capacityPerWorker
    );
    const fresh =
      Date.parse(worker.heartbeat_at) + overview.config.leaseMs >
      overview.observedAtMs;
    return {
      id: worker.id,
      health: worker.draining ? 'draining' : fresh ? 'ready' : 'unreachable',
      version: worker.application_version,
      heartbeatAt: worker.heartbeat_at,
      active,
      available: Math.max(0, capacity - active),
      memoryBytes: worker.memory_bytes,
      cpuMilliseconds: worker.cpu_milliseconds,
      leaseFailures: worker.lease_failures,
    };
  });
}

export type SyntheticPopulationWorkersScreenViewProps = {
  /** Set when the person may not open the panel; replaces the screen. */
  readonly denial?: DenialView | undefined;
  /** The overview last read; kept in view while the next read runs. */
  readonly overview: SyntheticPopulationOverview | undefined;
  readonly loading: boolean;
  readonly failed: boolean;
  readonly onRefresh: () => void;
};

function HealthBadge(props: { health: WorkerHealth }): JSX.Element {
  const { t } = useLingui();
  const label = () =>
    ({ ready: t`Ready`, draining: t`Draining`, unreachable: t`Unreachable` })[
      props.health
    ];
  return (
    <StackHorizontal gap="xs">
      <Badge
        label={label()}
        intent={
          props.health === 'ready'
            ? 'success'
            : props.health === 'draining'
              ? 'warning'
              : 'destructive'
        }
        size="sm"
      />
    </StackHorizontal>
  );
}

function useWorkerColumns(): () => readonly TableColumn<WorkerRow>[] {
  const { t } = useLingui();
  const moment = useMomentLabel();
  const unavailable = () => t`Unavailable`;
  return () => [
    {
      key: 'id',
      header: t`Worker`,
      primary: true,
      sortValue: (row) => row.id,
      render: (row) => <Text variant="mono">{row.id}</Text>,
    },
    {
      key: 'health',
      header: t`Health`,
      width: 'min',
      sortValue: (row) => row.health,
      render: (row) => <HealthBadge health={row.health} />,
    },
    {
      key: 'version',
      header: t`Version`,
      sortValue: (row) => row.version,
      render: (row) => row.version,
    },
    {
      key: 'heartbeat',
      header: t`Last heartbeat`,
      sortValue: (row) => Date.parse(row.heartbeatAt),
      render: (row) => moment(row.heartbeatAt),
    },
    {
      key: 'active',
      header: t`Active Synthetic Users`,
      align: 'end',
      sortValue: (row) => row.active,
      render: (row) => String(row.active),
    },
    {
      key: 'available',
      header: t`Available capacity`,
      align: 'end',
      sortValue: (row) => row.available,
      render: (row) => String(row.available),
    },
    {
      key: 'memory',
      header: t`Resident memory`,
      align: 'end',
      sortValue: (row) => row.memoryBytes ?? -1,
      render: (row) =>
        row.memoryBytes === null
          ? unavailable()
          : `${Math.ceil(row.memoryBytes / 1048576)} MiB`,
    },
    {
      key: 'cpu',
      header: t`Total CPU time`,
      align: 'end',
      sortValue: (row) => row.cpuMilliseconds ?? -1,
      render: (row) =>
        row.cpuMilliseconds === null
          ? unavailable()
          : `${Math.round(row.cpuMilliseconds)} ms`,
    },
    {
      key: 'lease-failures',
      header: t`Lease renewal failures`,
      align: 'end',
      sortValue: (row) => row.leaseFailures,
      render: (row) => String(row.leaseFailures),
    },
  ];
}

function WorkersTable(
  props: SyntheticPopulationWorkersScreenViewProps
): JSX.Element {
  const { t } = useLingui();
  const columns = useWorkerColumns();
  const refresh = useRefreshAction(props);
  const rows = () =>
    props.overview === undefined ? undefined : workerRows(props.overview);
  const count = () => {
    const total = String(rows()?.length ?? 0);
    return rows() === undefined ? undefined : t`${total} workers`;
  };
  return (
    <ContentScreen
      screenId="synthetic-population-workers"
      breadcrumbs={panelCrumbs([{ name: <Trans>Workers</Trans> }])}
      actions={refresh()}
      width="list"
    >
      <DataTable
        caption={t`Synthetic Population Workers`}
        count={count()}
        columns={columns()}
        rows={rows()}
        rowKey={(row) => row.id}
        defaultSort={{ key: 'id', direction: 'ascending' }}
        facts={
          props.overview === undefined
            ? []
            : [
                {
                  label: t`Admission limit per worker`,
                  value: String(props.overview.config.capacityPerWorker),
                },
              ]
        }
        loading={props.loading}
        loadingLabel={t`Reading Synthetic Population Workers…`}
        failure={
          props.failed
            ? {
                title: t`Synthetic Population Workers could not be loaded.`,
                body: t`Check your connection and try again.`,
                onRetry: () => props.onRefresh(),
              }
            : undefined
        }
        empty={{
          title: t`No Synthetic Population Workers`,
          body: t`Workers appear here once they report a heartbeat.`,
        }}
        testId="synthetic-population-worker"
      />
    </ContentScreen>
  );
}

/**
 * `/admin/observatory/synthetic-users/workers`, presentational: the
 * Synthetic Population Workers as a sortable table — health, version,
 * heartbeat, load, resources and lease failures — under the admission limit
 * each honors. Its loading, refreshing, failed, empty and denied states are
 * distinct. `SyntheticPopulationWorkersScreen` wires it.
 */
export function SyntheticPopulationWorkersScreenView(
  props: SyntheticPopulationWorkersScreenViewProps
): JSX.Element {
  return (
    <Show when={props.denial} fallback={<WorkersTable {...props} />}>
      {(denial) => <SyntheticPopulationDenial denial={denial()} />}
    </Show>
  );
}
