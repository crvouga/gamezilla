import type {
  PatchDbContext,
  PatchDbQuery,
  PatchDbResult,
  PatchInput,
  WritePatchesResult,
} from '../interface';
import { OPEN_PATCHES_DB_CONTEXT } from '../interface';
import type { SubscribablePatchDbLike } from '../subscribable';

/**
 * Decorator that delays `write()` resolution until active subscriptions have
 * refreshed their snapshots from the local DB.
 *
 * This is intended to reduce UI flicker for write-then-navigate flows by
 * ensuring subscribed query caches have settled before the caller continues.
 */
export class PatchDbCacheWarmer implements SubscribablePatchDbLike {
  readonly subscribe: SubscribablePatchDbLike['subscribe'];

  get hooks() {
    return this.inner.hooks;
  }

  get compaction() {
    return this.inner.compaction;
  }

  constructor(
    private readonly inner: SubscribablePatchDbLike,
    private readonly flushPendingReads: () => Promise<void>
  ) {
    this.subscribe = inner.subscribe;
  }

  async write(
    patches: PatchInput[],
    ctx: PatchDbContext = OPEN_PATCHES_DB_CONTEXT
  ): Promise<WritePatchesResult> {
    const result = await this.inner.write(patches, ctx);
    try {
      await this.flushPendingReads();
    } catch {
      // Best-effort only: writes must not fail due to cache warm errors.
    }
    return result;
  }

  read(
    queries: PatchDbQuery[],
    ctx: PatchDbContext = OPEN_PATCHES_DB_CONTEXT
  ): Promise<PatchDbResult[]> {
    return this.inner.read(queries, ctx);
  }

  update(
    updates: { patchId: string; attributes: Record<string, unknown> }[],
    ctx: PatchDbContext = OPEN_PATCHES_DB_CONTEXT
  ): Promise<void> {
    return this.inner.update(updates, ctx);
  }
}

