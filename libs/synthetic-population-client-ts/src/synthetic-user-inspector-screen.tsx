import { DecisionGate } from '@libs/permissions-client-ts/decision-gate';
import { useDecision } from '@libs/permissions-client-ts/use-can';
import { PERMISSION } from '@libs/permissions-shared-ts/permission-catalog';
import { useParams } from '@solidjs/router';
import type { JSX } from 'solid-js';
import { SyntheticUserInspectorScreenView } from './synthetic-user-inspector-screen-view';
import { useSyntheticUser } from './use-synthetic-user';

function InspectorContent(): JSX.Element {
  const params = useParams();
  const user = useSyntheticUser(() => params['id'] ?? '');
  return (
    <SyntheticUserInspectorScreenView
      user={user.shown()}
      snapshot={user.snapshot()}
      loading={user.record.loading}
      failed={Boolean(user.record.error)}
      onRefresh={() => {
        void user.refetch();
      }}
      onInspect={() => user.command('inspect')}
    />
  );
}

/** `/admin/observatory/synthetic-users/:id/inspector`: wires `SyntheticUserInspectorScreenView`. */
export function SyntheticUserInspectorScreen(): JSX.Element {
  const decision = useDecision(PERMISSION.syntheticPopulationInspect);
  return (
    <DecisionGate
      decision={decision()}
      testId="synthetic-population-inspect-denied"
      denied={(denial) => (
        <SyntheticUserInspectorScreenView
          denial={denial}
          user={undefined}
          snapshot={null}
          loading={false}
          failed={false}
          onRefresh={() => undefined}
          onInspect={async () => undefined}
        />
      )}
    >
      <InspectorContent />
    </DecisionGate>
  );
}
