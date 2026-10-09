import { Trans, useLingui } from '@lingui/solid/macro';
import { MenuRow } from '@pkgs/ui-root-client/menu-row';
import { MenuSection } from '@pkgs/ui-root-client/menu-section';
import { For, type JSX } from 'solid-js';
import type { PopulationOverview } from './population-api';

export function PopulationWorkers(props: {
  overview: PopulationOverview;
}): JSX.Element {
  const { t } = useLingui();
  return (
    <MenuSection title={<Trans>Population Workers</Trans>}>
      <For each={props.overview.workers}>
        {(worker) => (
          <MenuRow
            title={worker.id}
            caption={`${worker.application_version} / ${worker.heartbeat_at}`}
            value={
              worker.draining
                ? t`Draining`
                : Date.parse(worker.heartbeat_at) +
                      props.overview.config.leaseMs >
                    props.overview.observedAtMs
                  ? t`Ready`
                  : t`Unreachable`
            }
          />
        )}
      </For>
      <MenuRow
        title={<Trans>Admission limit per worker</Trans>}
        value={String(props.overview.config.capacityPerWorker)}
      />
    </MenuSection>
  );
}
