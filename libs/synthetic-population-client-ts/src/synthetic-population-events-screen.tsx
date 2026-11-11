import { DecisionGate } from '@libs/permissions-client-ts/decision-gate';
import { useDecision } from '@libs/permissions-client-ts/use-can';
import { PERMISSION } from '@libs/permissions-shared-ts/permission-catalog';
import type { JSX } from 'solid-js';
import { SyntheticPopulationEventsScreenView } from './synthetic-population-events-screen-view';
import { useSyntheticPopulationOverview } from './use-synthetic-population-overview';

function EventsContent(): JSX.Element {
  const population = useSyntheticPopulationOverview();
  return (
    <SyntheticPopulationEventsScreenView
      // UI driver actions are a Synthetic User's own record, not the population's.
      events={population
        .shown()
        ?.events.filter((event) => event.event !== 'UiDriverAction')}
      loading={population.overview.loading}
      failed={Boolean(population.overview.error)}
      onRefresh={() => {
        void population.refetch();
      }}
    />
  );
}

/** `/admin/observatory/synthetic-users/events`: wires `SyntheticPopulationEventsScreenView`. */
export function SyntheticPopulationEventsScreen(): JSX.Element {
  const decision = useDecision(PERMISSION.syntheticPopulationView);
  return (
    <DecisionGate
      decision={decision()}
      testId="synthetic-population-denied"
      denied={(denial) => (
        <SyntheticPopulationEventsScreenView
          denial={denial}
          events={undefined}
          loading={false}
          failed={false}
          onRefresh={() => undefined}
        />
      )}
    >
      <EventsContent />
    </DecisionGate>
  );
}
