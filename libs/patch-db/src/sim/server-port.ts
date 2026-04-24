import type { InMemoryPubSub } from '@gamezilla/lib/pub-sub/impl-in-memory';
import type {
  Patch,
  PatchesDbQuery,
  PatchesDbResult,
  PatchInput,
} from '../interface';

/**
 * Minimal server-side port for {@link SimulatedPatchDbClientTransport}: read/write only.
 */
export type SimServerPort = {
  read(queries: PatchesDbQuery[]): Promise<PatchesDbResult[]>;
  write(patches: PatchInput[]): Promise<Patch[]>;
};

export function simServerPortFromPubSub(
  read: SimServerPort['read'],
  write: SimServerPort['write'],
  _pubSub: InMemoryPubSub
): SimServerPort {
  return {
    read,
    write,
  };
}
