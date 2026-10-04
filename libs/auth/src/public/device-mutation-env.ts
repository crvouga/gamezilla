import type { Clock } from '@pkgs/clock';
import type { SecureStorageStore } from '@pkgs/secure-storage/secure-storage-store';
import type { MutationEnv } from '@pkgs/sync-engine/shared';
import type { CreateId } from '@pkgs/uuid';
import { DEVICE_ID_KEY, SESSION_TOKEN_KEY } from './auth-storage-keys';

/** The same install capability that the client mutation boundary uses. */
export function deviceMutationEnv(
  ownerId: string,
  ports: {
    readonly clock: Clock;
    readonly createId: CreateId;
    readonly secureStorage: SecureStorageStore;
  }
): MutationEnv {
  const token = ports.secureStorage.getValue(SESSION_TOKEN_KEY);
  return {
    actorId: ownerId,
    accountId: token ? ownerId : null,
    isAnon: !token,
    deviceId: String(ports.secureStorage.getValue(DEVICE_ID_KEY)),
    now: () => new Date(ports.clock.now()),
    createId: ports.createId,
  };
}
