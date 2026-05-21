import type { PubSub } from '@pkgs/pub-sub/interface';
import {
  PATCHES_DB_INVALIDATED_TYPE,
  PATCHES_DB_TOPIC,
} from '../impl-sync/active-query-registry';
import type {
  PatchDb,
  PatchDbContext,
  PatchDbQuery,
  PatchDbResult,
  PatchInput,
  WritePatchesResult,
} from '../interface';
import { OPEN_PATCHES_DB_CONTEXT } from '../interface';

/**
 * Wraps a {@link PatchDb} and publishes on `patch-db` after successful writes
 * so simulated transports can mirror "server pushed invalidation".
 */
export class NotifyingPatchDb implements PatchDb {
  get hooks() {
    return this.inner.hooks;
  }

  get compaction() {
    return this.inner.compaction;
  }

  constructor(
    private readonly inner: PatchDb,
    private readonly pubSub: PubSub
  ) {}

  read(
    queries: PatchDbQuery[],
    ctx: PatchDbContext = OPEN_PATCHES_DB_CONTEXT
  ): Promise<PatchDbResult[]> {
    return this.inner.read(queries, ctx);
  }

  async write(
    patches: PatchInput[],
    ctx: PatchDbContext = OPEN_PATCHES_DB_CONTEXT
  ): Promise<WritePatchesResult> {
    const out = await this.inner.write(patches, ctx);
    this.pubSub.publish(PATCHES_DB_TOPIC, {
      type: PATCHES_DB_INVALIDATED_TYPE,
    });
    return out;
  }

  update(
    updates: { patchId: string; attributes: Record<string, unknown> }[],
    ctx: PatchDbContext = OPEN_PATCHES_DB_CONTEXT
  ): Promise<void> {
    return this.inner.update(updates, ctx);
  }
}
