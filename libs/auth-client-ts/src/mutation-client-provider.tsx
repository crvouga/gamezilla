import { useModeration } from '@libs/moderation-client-ts/moderation-context';
import { useClock } from '@pkgs/clock-client-ts/solid';
import { MutationClientProvider as SyncMutationClientProvider } from '@pkgs/sync-engine-client-ts/mutation-client-provider';
import type {
  MutationEnv,
  MutationRegistry,
} from '@pkgs/sync-engine-shared-ts/mutations-types';
import type { TurnGames } from '@pkgs/turn-game-shared-ts/game-rules';
import { useCreateId } from '@pkgs/uuid-client-ts/solid';
import { type JSX, type ParentProps, untrack } from 'solid-js';

import { useRulesAuth } from './use-rules-auth';

/** Product wrapper: injects rules auth into the sync-engine mutation client. */
export function MutationClientProvider(
  props: ParentProps<{
    readonly registry: MutationRegistry;
    readonly turnGames: TurnGames;
  }>
): JSX.Element {
  const auth = useRulesAuth();
  const clock = useClock();
  const createId = useCreateId();
  const moderation = useModeration();
  // Live env view: stable identity (bootstrap `ensure*` effects never re-fire)
  // while identity fields resolve at mutate time — signing in upgrades the
  // anon user in place, so a mount-time snapshot would pin `isAnon: true`
  // forever and misreport the actor's tier.
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
    get turnGames() {
      return props.turnGames;
    },
    // The device's rules as they stand when the write is made.
    get contentRules() {
      return moderation();
    },
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
