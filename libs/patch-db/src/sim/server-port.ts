import type { InMemoryPubSub } from '@gamezilla/lib/pub-sub/impl-in-memory';
import type {
  PatchDbContext,
  PatchDbQuery,
  PatchDbResult,
  PatchInput,
  WritePatchesResult,
} from '../interface';

/**
 * Server-side port for {@link SimulatedPatchDbClientTransport}: read/write only.
 */
export type SimServerPort = {
  read(queries: PatchDbQuery[], ctx?: PatchDbContext): Promise<PatchDbResult[]>;
  write(
    patches: PatchInput[],
    ctx?: PatchDbContext
  ): Promise<WritePatchesResult>;
};

export function simServerPortFromPubSub(
  read: SimServerPort['read'],
  write: SimServerPort['write'],
  _pubSub: InMemoryPubSub
): SimServerPort {
  void _pubSub;
  return { read, write };
}
