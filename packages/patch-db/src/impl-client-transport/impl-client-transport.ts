import { assert } from '@gamezilla/lib/assert';
import { PatchDbHookRegistry } from '../hook-registry';
import type {
  PatchDb,
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
    ctx?: Readonly<Record<string, unknown>>
  ): Promise<PatchDbResult[]> {
    return this.transport.read(queries, ctx);
  }

  async write(
    patches: PatchInput[],
    ctx?: Readonly<Record<string, unknown>>
  ): Promise<WritePatchesResult> {
    return this.transport.write(patches, ctx);
  }

  async update(
    _updates: { patchId: string; attributes: Record<string, unknown> }[],
    _ctx?: Readonly<Record<string, unknown>>
  ): Promise<void> {
    void _ctx;
    assert.fail(
      'attribute updates are local-only for sync; remote does not need'
    );
  }
}
