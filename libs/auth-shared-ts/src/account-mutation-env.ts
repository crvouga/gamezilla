import type { Clock } from '@pkgs/clock-shared-ts/types';
import type { MutationEnv } from '@pkgs/sync-engine-shared-ts/mutations-types';
import type { CreateId } from '@pkgs/uuid-shared-ts/create-id';
/** An already authorized account operation performed by a server use case. */
export function accountMutationEnv(
  accountId: string,
  ports: { readonly clock: Clock; readonly createId: CreateId }
): MutationEnv {
  return {
    actorId: accountId,
    accountId,
    deviceId: '',
    isAnon: false,
    now: () => new Date(ports.clock.now()),
    createId: ports.createId,
  };
}
