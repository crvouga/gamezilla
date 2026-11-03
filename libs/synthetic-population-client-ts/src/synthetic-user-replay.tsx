import { useCan } from '@libs/permissions-client-ts/use-can';
import { PERMISSION } from '@libs/permissions-shared-ts/permission-catalog';
import { createSignal, type JSX, Show } from 'solid-js';
import {
  type SyntheticUserReplayResult,
  useSyntheticPopulationApi,
} from './synthetic-population-api';
import { SyntheticUserReplayView } from './synthetic-user-replay-view';

/** Decision Policy replay, wired: only for people who may replay. */
export function SyntheticUserReplay(props: { userId: string }): JSX.Element {
  const canReplay = useCan(PERMISSION.syntheticPopulationReplay);
  const api = useSyntheticPopulationApi();
  const [result, setResult] = createSignal<SyntheticUserReplayResult | null>(
    null
  );
  return (
    <Show when={canReplay()}>
      <SyntheticUserReplayView
        result={result()}
        onReplay={async () => {
          setResult(await api.replay(props.userId));
        }}
      />
    </Show>
  );
}
