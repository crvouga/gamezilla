import { DecisionGate } from '@libs/permissions-client-ts/decision-gate';
import { useDecision } from '@libs/permissions-client-ts/use-can';
import { PERMISSION } from '@libs/permissions-shared-ts/permission-catalog';
import type { JSX } from 'solid-js';
import { SyntheticPopulationWorkersScreenView } from './synthetic-population-workers-screen-view';
import { useSyntheticPopulationOverview } from './use-synthetic-population-overview';

function WorkersContent(): JSX.Element {
  const population = useSyntheticPopulationOverview();
  return (
    <SyntheticPopulationWorkersScreenView
      overview={population.shown()}
      loading={population.overview.loading}
      failed={Boolean(population.overview.error)}
      onRefresh={() => {
        void population.refetch();
      }}
    />
  );
}

/** `/admin/observatory/synthetic-users/workers`: wires `SyntheticPopulationWorkersScreenView`. */
export function SyntheticPopulationWorkersScreen(): JSX.Element {
  const decision = useDecision(PERMISSION.syntheticPopulationView);
  return (
    <DecisionGate
      decision={decision()}
      testId="synthetic-population-denied"
      denied={(denial) => (
        <SyntheticPopulationWorkersScreenView
          denial={denial}
          overview={undefined}
          loading={false}
          failed={false}
          onRefresh={() => undefined}
        />
      )}
    >
      <WorkersContent />
    </DecisionGate>
  );
}
