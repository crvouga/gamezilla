import {
  syntheticUserEventsPath,
  syntheticUserInspectorPath,
  syntheticUserReplayPath,
} from '@libs/observatory-shared-ts/observatory-routes';
import { DecisionGate } from '@libs/permissions-client-ts/decision-gate';
import { useCan, useDecision } from '@libs/permissions-client-ts/use-can';
import { PERMISSION } from '@libs/permissions-shared-ts/permission-catalog';
import { useRouter } from '@pkgs/ui-root-client-ts/app-router';
import { useParams } from '@solidjs/router';
import type { JSX } from 'solid-js';
import {
  type SyntheticUserDestination,
  SyntheticUserScreenView,
} from './synthetic-user-screen-view';
import { useSyntheticUser } from './use-synthetic-user';

const DESTINATIONS: Readonly<
  Record<SyntheticUserDestination, (id: string) => string>
> = {
  events: syntheticUserEventsPath,
  replay: syntheticUserReplayPath,
  inspector: syntheticUserInspectorPath,
};

function SyntheticUserContent(): JSX.Element {
  const params = useParams();
  const router = useRouter();
  const id = () => params['id'] ?? '';
  const user = useSyntheticUser(id);
  const control = useCan(PERMISSION.syntheticPopulationControl);
  const replay = useCan(PERMISSION.syntheticPopulationReplay);
  return (
    <SyntheticUserScreenView
      loading={user.record.loading}
      failed={Boolean(user.record.error)}
      user={user.shown()}
      snapshot={user.snapshot()}
      canControl={control()}
      canReplay={replay()}
      onRefresh={() => {
        void user.refetch();
      }}
      onCommand={user.command}
      onOpen={(destination) => router.push(DESTINATIONS[destination](id()))}
    />
  );
}

/** `/admin/observatory/synthetic-users/:id`: wires `SyntheticUserScreenView`. */
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
          user={undefined}
          snapshot={null}
          canControl={false}
          canReplay={false}
          onRefresh={() => undefined}
          onCommand={async () => undefined}
          onOpen={() => undefined}
        />
      )}
    >
      <SyntheticUserContent />
    </DecisionGate>
  );
}
