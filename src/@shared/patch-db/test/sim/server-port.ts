import type { Unsubscribe } from '../../../pub-sub/interface';
import type { PatchDbSyncHost } from '../../transport/interface';
import type {
  Patch,
  PatchesDbQuery,
  PatchesDbResult,
  PatchInput,
} from '../../interface';
import type { InMemoryPubSub } from '../../../pub-sub/impl-in-memory';

const PATCHES_DB_TOPIC = 'patches-db';

/**
 * Minimal server-side port for {@link SimulatedPatchDbClientTransport}: read/write + invalidation fan-out.
 */
export type SimServerPort = {
  read(queries: PatchesDbQuery[]): Promise<PatchesDbResult[]>;
  write(patches: PatchInput[]): Promise<Patch[]>;
  subscribeInvalidations(callback: () => void): Unsubscribe;
};

export function simServerPortFromSyncHost(host: PatchDbSyncHost): SimServerPort {
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
