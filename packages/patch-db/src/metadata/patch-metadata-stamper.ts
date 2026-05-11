import { assert } from '@gamezilla/lib/assert';
import type {
  PatchDbQuery,
  PatchDbResult,
  PatchInput,
  WritePatchesResult,
} from '../interface';
import { OPEN_PATCHES_DB_CONTEXT } from '../interface';
import type { SubscribablePatchDbLike } from '../subscribable';
import { PATCH_CREATED_BY_ID } from './patch-metadata';

export type PatchMetadataStamperConfig = {
  /** Install / replication device id (for assertions only). */
  getDeviceId: () => string;
  /**
   * Author id on patches: account id when signed in, else install id.
   * Must match server ABAC `myId`.
   */
  getMyId: () => string;
  /** Optional validator for deviceId (e.g. assertDeviceId from domain). */
  assertDeviceId?: (id: string) => void;
};

/**
 * Stamps every write with `patch/created-by-id` and sets the top-level
 * `createdBy` field on each patch input.
 *
 * Delegates read, update, and subscribe to the inner sync DB.
 */
export class PatchMetadataStamper implements SubscribablePatchDbLike {
  readonly subscribe: SubscribablePatchDbLike['subscribe'];

  get hooks() {
    return this.inner.hooks;
  }

  get compaction() {
    return this.inner.compaction;
  }

  constructor(
    private readonly inner: SubscribablePatchDbLike,
    private readonly config: PatchMetadataStamperConfig
  ) {
    config.assertDeviceId?.(config.getDeviceId());
    this.subscribe = inner.subscribe;
  }

  async write(
    patches: PatchInput[],
    ctx: Readonly<Record<string, unknown>> = OPEN_PATCHES_DB_CONTEXT
  ): Promise<WritePatchesResult> {
    const deviceId = this.config.getDeviceId();
    this.config.assertDeviceId?.(deviceId);
    const myId = this.config.getMyId();
    assert.ok(myId.length > 0, 'myId must be non-empty');
    const stamped: PatchInput[] = patches.map((p) => {
      const attrs = {
        ...(p.attributes as Record<string, unknown>),
        [PATCH_CREATED_BY_ID]: myId,
      };
      return {
        ...p,
        createdBy: myId,
        attributes: attrs as PatchInput['attributes'],
      };
    });
    return this.inner.write(stamped, ctx);
  }

  read(
    queries: PatchDbQuery[],
    ctx: Readonly<Record<string, unknown>> = OPEN_PATCHES_DB_CONTEXT
  ): Promise<PatchDbResult[]> {
    return this.inner.read(queries, ctx);
  }

  async update(
    updates: { patchId: string; attributes: Record<string, unknown> }[],
    ctx: Readonly<Record<string, unknown>> = OPEN_PATCHES_DB_CONTEXT
  ): Promise<void> {
    return this.inner.update(updates, ctx);
  }

  /**
   * When the wrapped inner sync DB exposes `clearRejectedPushes`, forwards so
   * push-rejection markers can be cleared (e.g. after auth is fixed).
   */
  async clearRejectedPushes(): Promise<void> {
    const maybe = this.inner as { clearRejectedPushes?: () => Promise<void> };
    await maybe.clearRejectedPushes?.();
  }
}
