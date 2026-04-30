import type { PubSub } from '@gamezilla/lib/pub-sub/interface';
import type {
  Patch,
  PatchesDb,
  PatchesDbContext,
  PatchesDbQuery,
  PatchesDbResult,
  PatchInput,
} from '../interface';
import { OPEN_PATCHES_DB_CONTEXT } from '../interface';

const PATCHES_DB_TOPIC = 'patches-db';

/**
 * Wraps a {@link PatchesDb} and publishes on `patches-db` after successful writes
 * so simulated transports can mirror "server pushed invalidation".
 */
export class NotifyingPatchesDb implements PatchesDb {
  get hooks() {
    return this.inner.hooks;
  }

  get compaction() {
    return this.inner.compaction;
  }

  constructor(
    private readonly inner: PatchesDb,
    private readonly pubSub: PubSub
  ) {}

  read(
    queries: PatchesDbQuery[],
    ctx: PatchesDbContext = OPEN_PATCHES_DB_CONTEXT
  ): Promise<PatchesDbResult[]> {
    return this.inner.read(queries, ctx);
  }

  async write(
    patches: PatchInput[],
    ctx: PatchesDbContext = OPEN_PATCHES_DB_CONTEXT
  ): Promise<Patch[]> {
    const out = await this.inner.write(patches, ctx);
    this.pubSub.publish(PATCHES_DB_TOPIC, { type: 'invalidated' });
    return out;
  }

  update(
    updates: { patchId: string; attributes: Record<string, unknown> }[],
    ctx: PatchesDbContext = OPEN_PATCHES_DB_CONTEXT
  ): Promise<void> {
    return this.inner.update(updates, ctx);
  }
}
