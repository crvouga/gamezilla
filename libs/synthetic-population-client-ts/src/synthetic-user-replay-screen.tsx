import { DecisionGate } from '@libs/permissions-client-ts/decision-gate';
import { useDecision } from '@libs/permissions-client-ts/use-can';
import { PERMISSION } from '@libs/permissions-shared-ts/permission-catalog';
import { useParams } from '@solidjs/router';
import { createSignal, type JSX } from 'solid-js';
import {
  type SyntheticUserReplayResult,
  useSyntheticPopulationApi,
} from './synthetic-population-api';
import { SyntheticUserReplayScreenView } from './synthetic-user-replay-screen-view';
import { useSyntheticUser } from './use-synthetic-user';

function ReplayContent(): JSX.Element {
  const params = useParams();
  const id = () => params['id'] ?? '';
  const api = useSyntheticPopulationApi();
  const user = useSyntheticUser(id);
  const [result, setResult] = createSignal<SyntheticUserReplayResult | null>(
    null
  );
  return (
    <SyntheticUserReplayScreenView
      user={user.shown()}
      result={result()}
      onReplay={async () => {
        setResult(await api.replay(id()));
      }}
    />
  );
}

/** `/admin/observatory/synthetic-users/:id/replay`: wires `SyntheticUserReplayScreenView`, gated on replay. */
export function SyntheticUserReplayScreen(): JSX.Element {
  const decision = useDecision(PERMISSION.syntheticPopulationReplay);
  return (
    <DecisionGate
      decision={decision()}
      testId="synthetic-population-replay-denied"
      denied={(denial) => (
        <SyntheticUserReplayScreenView
          denial={denial}
          user={undefined}
          result={null}
          onReplay={async () => undefined}
        />
      )}
    >
      <ReplayContent />
    </DecisionGate>
  );
}
