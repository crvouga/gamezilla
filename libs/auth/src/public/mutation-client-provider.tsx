import { useClock } from '@pkgs/clock/solid';
import type { MutationRegistry } from '@pkgs/sync-engine/shared';
import {
  MutationClientProvider as SyncMutationClientProvider,
  useMutationClient,
} from '@pkgs/sync-engine/solid';
import { useCreateId } from '@pkgs/uuid/solid';
import { type JSX, type ParentProps, untrack } from 'solid-js';

import { useRulesAuth } from './use-rules-auth';

export { useMutationClient };

/** Product wrapper: injects rules auth into the sync-engine mutation client. */
export function MutationClientProvider(
  props: ParentProps<{ readonly registry: MutationRegistry }>
): JSX.Element {
  const auth = useRulesAuth();
  const clock = useClock();
  const createId = useCreateId();
  // Configuration for the sync provider: read once on mount by design.
  const env = untrack(() => ({
    actorId: auth.userId,
    deviceId: auth.deviceId,
    accountId: auth.accountId,
    isAnon: auth.isAnon,
    now: () => new Date(clock.now()),
    createId,
  }));
  const ids = untrack(() => ({ clientId: auth.deviceId }));
  return (
    <SyncMutationClientProvider
      registry={props.registry}
      env={env}
      ids={ids}
      createId={createId}
    >
      {props.children}
    </SyncMutationClientProvider>
  );
}
