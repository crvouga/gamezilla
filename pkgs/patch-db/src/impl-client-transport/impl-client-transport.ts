import { assert } from '@pkgs/assert';
import { PatchDbHookRegistry } from '../hook-registry';
import type {
  PatchDb,
  PatchDbContext,
  PatchDbQuery,
  PatchDbResult,
  PatchInput,
  WritePatchesResult,
} from '../interface';
import type { PatchDbClientTransport } from '../transport/interface';

const REMOTE_COMPACTION_ERROR =
  'PatchDbImplClientTransport: compaction runs on the authority database only, not over HTTP transport';

/**
 * PatchDb adapter over {@link PatchDbClientTransport} (remote / transport boundary).
 */
export class PatchDbImplClientTransport implements PatchDb {
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

  async read(
    queries: PatchDbQuery[],
    ctx?: PatchDbContext
  ): Promise<PatchDbResult[]> {
    return this.transport.read(queries, ctx);
  }

  async write(
    patches: PatchInput[],
    ctx?: PatchDbContext
  ): Promise<WritePatchesResult> {
    return this.transport.write(patches, ctx);
  }

  async update(
    _updates: { patchId: string; attributes: Record<string, unknown> }[],
    _ctx?: PatchDbContext
  ): Promise<void> {
    void _ctx;
    assert.fail(
      'attribute updates are local-only for sync; remote does not need'
    );
  }
}
