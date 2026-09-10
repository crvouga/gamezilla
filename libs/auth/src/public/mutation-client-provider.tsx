import { useClock } from '@pkgs/clock/solid';
import type { MutationEnv, MutationRegistry } from '@pkgs/sync-engine/shared';
import { MutationClientProvider as SyncMutationClientProvider } from '@pkgs/sync-engine/solid';
import { useCreateId } from '@pkgs/uuid/solid';
import { type JSX, type ParentProps, untrack } from 'solid-js';

import { useRulesAuth } from './use-rules-auth';

/** Product wrapper: injects rules auth into the sync-engine mutation client. */
export function MutationClientProvider(
  props: ParentProps<{ readonly registry: MutationRegistry }>
): JSX.Element {
  const auth = useRulesAuth();
  const clock = useClock();
  const createId = useCreateId();
  // Live env view: stable identity (bootstrap `ensure*` effects never re-fire)
  // while identity fields resolve at mutate time — signing in upgrades the
  // anon user in place, so a mount-time snapshot would pin `isAnon: true`
  // forever and fail every `accountId(env)` guard with SPACE_NOT_SIGNED_IN.
  const env: MutationEnv = {
    get actorId() {
      return auth.userId;
    },
    get deviceId() {
      return auth.deviceId;
    },
    get accountId() {
      return auth.accountId;
    },
    get isAnon() {
      return auth.isAnon;
    },
    now: () => new Date(clock.now()),
    createId,
  };
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
