import { DecisionGate } from '@libs/permissions-client-ts/decision-gate';
import { useDecision } from '@libs/permissions-client-ts/use-can';
import { PERMISSION } from '@libs/permissions-shared-ts/permission-catalog';
import { useParams } from '@solidjs/router';
import type { JSX } from 'solid-js';
import { SyntheticUserEventsScreenView } from './synthetic-user-events-screen-view';
import { useSyntheticUser, useSyntheticUserEvents } from './use-synthetic-user';

function EventsContent(): JSX.Element {
  const params = useParams();
  const id = () => params['id'] ?? '';
  const user = useSyntheticUser(id);
  const events = useSyntheticUserEvents(id);
  return (
    <SyntheticUserEventsScreenView
      user={user.shown()}
      events={events.shown()}
      loading={events.events.loading}
      failed={Boolean(events.events.error)}
      onRefresh={() => {
        void events.refetch();
      }}
    />
  );
}

/** `/admin/observatory/synthetic-users/:id/events`: wires `SyntheticUserEventsScreenView`. */
export function SyntheticUserEventsScreen(): JSX.Element {
  const decision = useDecision(PERMISSION.syntheticPopulationInspect);
  return (
    <DecisionGate
      decision={decision()}
      testId="synthetic-population-inspect-denied"
      denied={(denial) => (
        <SyntheticUserEventsScreenView
          denial={denial}
          user={undefined}
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
