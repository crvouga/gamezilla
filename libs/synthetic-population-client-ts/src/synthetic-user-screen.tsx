import { DecisionGate } from '@libs/permissions-client-ts/decision-gate';
import { useCan, useDecision } from '@libs/permissions-client-ts/use-can';
import { PERMISSION } from '@libs/permissions-shared-ts/permission-catalog';
import { useParams } from '@solidjs/router';
import type { JSX } from 'solid-js';
import { resourceValue } from './resource-value';
import { SyntheticUserReplay } from './synthetic-user-replay';
import { SyntheticUserScreenView } from './synthetic-user-screen-view';
import { useSyntheticUser } from './use-synthetic-user';

function SyntheticUserContent(): JSX.Element {
  const params = useParams();
  const inspector = useSyntheticUser(() => params['id'] ?? '');
  const control = useCan(PERMISSION.syntheticPopulationControl);
  return (
    <SyntheticUserScreenView
      loading={inspector.record.loading}
      failed={Boolean(inspector.record.error)}
      record={resourceValue(inspector.record)}
      snapshot={inspector.snapshot()}
      canControl={control()}
      onRefresh={() => {
        void inspector.refetch();
      }}
      onCommand={inspector.command}
      onInspect={() => inspector.command('inspect')}
      replay={(userId) => <SyntheticUserReplay userId={userId} />}
    />
  );
}

/** `/admin/synthetic-population/users/:id`: wires `SyntheticUserScreenView`. */
export function SyntheticUserScreen(): JSX.Element {
  const decision = useDecision(PERMISSION.syntheticPopulationInspect);
  return (
    <DecisionGate
      decision={decision()}
      testId="synthetic-population-inspect-denied"
      denied={(denial) => (
        <SyntheticUserScreenView
          denial={denial}
          loading={false}
          failed={false}
          record={undefined}
          snapshot={null}
          canControl={false}
          onRefresh={() => undefined}
          onCommand={async () => undefined}
          onInspect={async () => undefined}
        />
      )}
    >
      <SyntheticUserContent />
    </DecisionGate>
  );
}
