import type { AttributeState } from '@pkgs/attribute';
import {
  OPEN_PATCHES_DB_CONTEXT,
  type PatchDb,
  type PatchDbContext,
  type PatchDbQuery,
  type PatchDbResult,
  type PatchInput,
  type WritePatchesResult,
} from '../interface';

type PendingSlice = {
  readonly queryCount: number;
  readonly resolve: (slice: PatchDbResult[]) => void;
  readonly reject: (err: unknown) => void;
};

type PendingBucket = {
  readonly ctx: PatchDbContext;
  queries: PatchDbQuery[];
  slices: PendingSlice[];
};

/**
 * Wraps a {@link PatchDb} so concurrent `read` calls in the same macrotask tick
 * (same JS microtask flush) coalesce into a single `inner.read([...all queries])`.
 *
 * - Partitions by `ctx` reference identity (same context batches together).
 * - Preserves per-caller result ordering via slice indices.
 * - `write` / `update` / `hooks` / `compaction` delegate unchanged.
 */
export function createPatchDbReadBatcher(inner: PatchDb): PatchDb {
  return new PatchDbReadBatcher(inner);
}

class PatchDbReadBatcher implements PatchDb {
  readonly hooks;
  readonly compaction;

  private readonly buckets = new Map<PatchDbContext, PendingBucket>();
  private flushScheduled = false;

  constructor(private readonly inner: PatchDb) {
    this.hooks = inner.hooks;
    this.compaction = inner.compaction;
  }

  read(
    queries: PatchDbQuery[],
    ctx: PatchDbContext = OPEN_PATCHES_DB_CONTEXT
  ): Promise<PatchDbResult[]> {
    if (queries.length === 0) {
      return Promise.resolve([]);
    }
    return new Promise<PatchDbResult[]>((resolve, reject) => {
      let bucket = this.buckets.get(ctx);
      if (bucket === undefined) {
        bucket = { ctx, queries: [], slices: [] };
        this.buckets.set(ctx, bucket);
      }
      bucket.queries.push(...queries);
      bucket.slices.push({
        queryCount: queries.length,
        resolve,
        reject,
      });
      this.scheduleFlush();
    });
  }

  write(
    patches: PatchInput[],
    ctx?: PatchDbContext
  ): Promise<WritePatchesResult> {
    return this.inner.write(patches, ctx);
  }

  update(
    updates: { patchId: string; attributes: AttributeState }[],
    ctx?: PatchDbContext
  ): Promise<void> {
    return this.inner.update(updates, ctx);
  }

  private scheduleFlush(): void {
    if (this.flushScheduled) return;
    this.flushScheduled = true;
    queueMicrotask(() => {
      this.flushScheduled = false;
      void this.flush();
    });
  }

  private async flush(): Promise<void> {
    if (this.buckets.size === 0) return;
    const snapshot = [...this.buckets.entries()];
    this.buckets.clear();

    for (const [, bucket] of snapshot) {
      const { ctx, queries, slices } = bucket;
      try {
        const results = await this.inner.read(queries, ctx);
        if (results.length !== queries.length) {
          const err = new Error(
            `PatchDbReadBatcher: inner.read returned ${results.length} results, expected ${queries.length}`
          );
          for (const s of slices) s.reject(err);
          continue;
        }
        let offset = 0;
        for (const s of slices) {
          const slice = results.slice(offset, offset + s.queryCount);
          offset += s.queryCount;
          s.resolve(slice);
        }
      } catch (err) {
        for (const s of slices) s.reject(err);
      }
    }
  }
}
