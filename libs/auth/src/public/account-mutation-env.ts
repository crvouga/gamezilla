import type { Clock } from '@pkgs/clock';
import type { MutationEnv } from '@pkgs/sync-engine/shared';
import type { CreateId } from '@pkgs/uuid';
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
