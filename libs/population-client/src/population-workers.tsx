import { Trans, useLingui } from '@lingui/solid/macro';
import { MenuRow } from '@pkgs/ui-root-client/menu-row';
import { MenuSection } from '@pkgs/ui-root-client/menu-section';
import { For, type JSX } from 'solid-js';
import type { PopulationOverview } from './population-api';

export function PopulationWorkers(props: {
  overview: PopulationOverview;
}): JSX.Element {
  return (
    <div class="box gap-3">
      <For each={props.overview.workers}>
        {(worker) => (
          <PopulationWorkerDetails overview={props.overview} worker={worker} />
        )}
      </For>
      <MenuSection title={<Trans>Population Workers</Trans>}>
        <MenuRow
          title={<Trans>Admission limit per worker</Trans>}
          value={String(props.overview.config.capacityPerWorker)}
        />
      </MenuSection>
    </div>
  );
}

function PopulationWorkerDetails(props: {
  overview: PopulationOverview;
  worker: PopulationOverview['workers'][number];
}): JSX.Element {
  const { t } = useLingui();
  const active = () =>
    props.overview.users.filter(
      (user) =>
        user.worker_id === props.worker.id &&
        Date.parse(user.lease_until ?? '') > props.overview.observedAtMs
    ).length;
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
