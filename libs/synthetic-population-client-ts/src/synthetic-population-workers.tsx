import { Trans, useLingui } from '@lingui/solid/macro';
import { EmptyState } from '@pkgs/ui-root-client-ts/empty-state';
import { MenuRow } from '@pkgs/ui-root-client-ts/menu-row';
import { MenuSection } from '@pkgs/ui-root-client-ts/menu-section';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { For, type JSX, Show } from 'solid-js';
import type { SyntheticPopulationOverview } from './synthetic-population-api';

export function SyntheticPopulationWorkers(props: {
  overview: SyntheticPopulationOverview;
}): JSX.Element {
  return (
    <StackVertical gap="md">
      <For each={props.overview.workers}>
        {(worker) => (
          <SyntheticPopulationWorkerDetails
            overview={props.overview}
            worker={worker}
          />
        )}
      </For>
      <MenuSection title={<Trans>Synthetic Population Workers</Trans>}>
        <Show when={props.overview.workers.length === 0}>
          <EmptyState
            variant="compact"
            title={<Trans>No Synthetic Population Workers</Trans>}
            body={
              <Trans>Workers appear here once they report a heartbeat.</Trans>
            }
          />
        </Show>
        <MenuRow
          title={<Trans>Admission limit per worker</Trans>}
          value={String(props.overview.config.capacityPerWorker)}
        />
      </MenuSection>
    </StackVertical>
  );
}

function SyntheticPopulationWorkerDetails(props: {
  overview: SyntheticPopulationOverview;
  worker: SyntheticPopulationOverview['workers'][number];
}): JSX.Element {
  const { t } = useLingui();
  const active = () =>
    props.overview.workerAssignments.find(
      (row) => row.worker_id === props.worker.id
    )?.count ?? 0;
  const capacity = () =>
    Math.min(props.worker.capacity, props.overview.config.capacityPerWorker);
  return (
    <MenuSection title={props.worker.id}>
      <MenuRow
        title={<Trans>Health</Trans>}
        value={
          props.worker.draining
            ? t`Draining`
            : Date.parse(props.worker.heartbeat_at) +
                  props.overview.config.leaseMs >
                props.overview.observedAtMs
              ? t`Ready`
              : t`Unreachable`
        }
      />
      <MenuRow
        title={<Trans>Application version</Trans>}
        value={props.worker.application_version}
      />
      <MenuRow
        title={<Trans>Last heartbeat</Trans>}
        value={props.worker.heartbeat_at}
      />
      <MenuRow
        title={<Trans>Active Synthetic Users</Trans>}
        value={String(active())}
      />
      <MenuRow
        title={<Trans>Available capacity</Trans>}
        value={String(Math.max(0, capacity() - active()))}
      />
      <MenuRow
        title={<Trans>Resident memory</Trans>}
        value={
          props.worker.memory_bytes === null
            ? t`Unavailable`
            : `${Math.ceil(props.worker.memory_bytes / 1048576)} MiB`
        }
      />
      <MenuRow
        title={<Trans>Total CPU time</Trans>}
        value={
          props.worker.cpu_milliseconds === null
            ? t`Unavailable`
            : `${Math.round(props.worker.cpu_milliseconds)} ms`
        }
      />
      <MenuRow
        title={<Trans>Lease renewal failures</Trans>}
        value={String(props.worker.lease_failures)}
      />
    </MenuSection>
  );
}
