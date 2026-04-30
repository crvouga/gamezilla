import { assert } from '@gamezilla/lib/assert';
import type {
  Patch,
  PatchesDb,
  PatchesDbContext,
  PatchesDbQuery,
  PatchesDbResult,
  PatchInput,
} from '../interface';
import { PatchDbHookRegistry } from '../hook-registry';
import type { PatchDbClientTransport } from '../transport/interface';

const REMOTE_COMPACTION_ERROR =
  'PatchDbImplClientTransport: compaction runs on the authority database only, not over HTTP transport';

/**
 * PatchesDb adapter over {@link PatchDbClientTransport} (remote / transport boundary).
 */
export class PatchDbImplClientTransport implements PatchesDb {
  readonly hooks = new PatchDbHookRegistry();

  readonly compaction = {
    compactEntity: async () => {
      throw new Error(REMOTE_COMPACTION_ERROR);
    },
    compactAll: async () => {
      throw new Error(REMOTE_COMPACTION_ERROR);
    },
  };

  constructor(private transport: PatchDbClientTransport) {}

  read(
    queries: PatchesDbQuery[],
    ctx?: PatchesDbContext
  ): Promise<PatchesDbResult[]> {
    return this.transport.read(queries, ctx);
  }

  write(patches: PatchInput[], ctx?: PatchesDbContext): Promise<Patch[]> {
    return this.transport.write(patches, ctx);
  }

  async update(
    _updates: { patchId: string; attributes: Record<string, unknown> }[],
    _ctx?: PatchesDbContext
  ): Promise<void> {
    void _ctx;
    assert.fail(
      'attribute updates are local-only for sync; remote does not need'
    );
  }
}
