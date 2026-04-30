import type { InMemoryPubSub } from '@gamezilla/lib/pub-sub/impl-in-memory';
import type {
  Patch,
  PatchesDbContext,
  PatchesDbQuery,
  PatchesDbResult,
  PatchInput,
} from '../interface';

/**
 * Minimal server-side port for {@link SimulatedPatchDbClientTransport}: read/write only.
 */
export type SimServerPort = {
  read(
    queries: PatchesDbQuery[],
    ctx?: PatchesDbContext
  ): Promise<PatchesDbResult[]>;
  write(patches: PatchInput[], ctx?: PatchesDbContext): Promise<Patch[]>;
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
