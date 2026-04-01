import type { InMemoryPubSub } from '@gamezilla/shared/pub-sub/impl-in-memory';
import type { Unsubscribe } from '@gamezilla/shared/pub-sub/interface';
import type {
  Patch,
  PatchesDbQuery,
  PatchesDbResult,
  PatchInput,
} from '../interface';
import type { PatchDbSyncHost } from '../transport/interface';

const PATCHES_DB_TOPIC = 'patches-db';

/**
 * Minimal server-side port for {@link SimulatedPatchDbClientTransport}: read/write + invalidation fan-out.
 */
export type SimServerPort = {
  read(queries: PatchesDbQuery[]): Promise<PatchesDbResult[]>;
  write(patches: PatchInput[]): Promise<Patch[]>;
  subscribeInvalidations(callback: () => void): Unsubscribe;
};

export function simServerPortFromSyncHost(
  host: PatchDbSyncHost
): SimServerPort {
  return {
    read: (q) => host.read(q),
    write: (p) => host.write(p),
    subscribeInvalidations: (cb) => host.subscribe(cb),
  };
}

export function simServerPortFromPubSub(
  read: SimServerPort['read'],
  write: SimServerPort['write'],
  pubSub: InMemoryPubSub
): SimServerPort {
  return {
    read,
    write,
    subscribeInvalidations: (cb) =>
      pubSub.subscribe(PATCHES_DB_TOPIC, () => {
        cb();
      }),
  };
}
