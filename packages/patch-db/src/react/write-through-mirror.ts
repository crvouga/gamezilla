import type {
  PatchDbQuery,
  PatchDbResult,
  PatchInput,
  WritePatchesResult,
} from '../interface';
import { OPEN_PATCHES_DB_CONTEXT } from '../interface';
import type { SubscribablePatchDbLike } from '../subscribable';
import type { InMemoryEntityStore } from './in-memory-entity-store';

/**
 * Decorator that keeps an {@link InMemoryEntityStore} in sync with writes.
 *
 * It applies patch inputs optimistically before persistence, then applies the
 * accepted patches after the underlying write resolves.
 */
export class PatchDbWriteThroughMirror implements SubscribablePatchDbLike {
  readonly subscribe: SubscribablePatchDbLike['subscribe'];

  get hooks() {
    return this.inner.hooks;
  }

  get compaction() {
    return this.inner.compaction;
  }

  constructor(
    private readonly inner: SubscribablePatchDbLike,
    private readonly store: InMemoryEntityStore
  ) {
    this.subscribe = inner.subscribe;
  }

  async write(
    patches: PatchInput[],
    ctx: Readonly<Record<string, unknown>> = OPEN_PATCHES_DB_CONTEXT
  ): Promise<WritePatchesResult> {
    // Optimistic: ensures navigate-first flows render synchronously from the store.
    this.store.applyPatchInputs(patches);
    const result = await this.inner.write(patches, ctx);
    this.store.applyAcceptedPatches(result.accepted);
    return result;
  }

  read(
    queries: PatchDbQuery[],
    ctx: Readonly<Record<string, unknown>> = OPEN_PATCHES_DB_CONTEXT
  ): Promise<PatchDbResult[]> {
    return this.inner.read(queries, ctx);
  }

  update(
    updates: { patchId: string; attributes: Record<string, unknown> }[],
    ctx: Readonly<Record<string, unknown>> = OPEN_PATCHES_DB_CONTEXT
  ): Promise<void> {
    return this.inner.update(updates, ctx);
  }
}
