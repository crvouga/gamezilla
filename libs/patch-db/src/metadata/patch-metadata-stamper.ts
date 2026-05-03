import { assert } from '@gamezilla/lib/assert';
import type {
  PatchDbContext,
  PatchDbQuery,
  PatchDbResult,
  PatchInput,
  WritePatchesResult,
} from '../interface';
import { OPEN_PATCHES_DB_CONTEXT } from '../interface';
import type { SubscribablePatchDbLike } from '../subscribable';
import {
  PATCH_CREATED_BY,
  PATCH_LAST_MODIFIED_AT,
  PATCH_LAST_MODIFIED_BY_ACCOUNT,
  PATCH_LAST_MODIFIED_BY_DEVICE,
} from './patch-metadata';

export type PatchMetadataStamperConfig = {
  getDeviceId: () => string;
  getAccountId?: () => string | null;
  /** Optional validator for deviceId (e.g. assertDeviceId from domain). */
  assertDeviceId?: (id: string) => void;
};

/**
 * Stamps every write with authorship metadata (`patch/createdBy`,
 * `patch/lastModifiedByDeviceId`, etc.) and sets the top-level
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
    ctx: PatchDbContext = OPEN_PATCHES_DB_CONTEXT
  ): Promise<WritePatchesResult> {
    const deviceId = this.config.getDeviceId();
    this.config.assertDeviceId?.(deviceId);
    const accountId = this.config.getAccountId?.() ?? null;
    const stamped: PatchInput[] = patches.map((p) => {
      const attrs: Record<string, unknown> = {
        ...p.attributes,
        [PATCH_CREATED_BY]: deviceId,
        [PATCH_LAST_MODIFIED_BY_DEVICE]: deviceId,
        [PATCH_LAST_MODIFIED_AT]: Date.now(),
      };
      if (accountId !== null && accountId !== undefined && accountId !== '') {
        assert.ok(accountId.length > 0, 'accountId must be a non-empty string');
        attrs[PATCH_LAST_MODIFIED_BY_ACCOUNT] = accountId;
      }
      return {
        ...p,
        createdBy: deviceId,
        attributes: attrs as PatchInput['attributes'],
      };
    });
    return this.inner.write(stamped, ctx);
  }

  read(
    queries: PatchDbQuery[],
    ctx: PatchDbContext = OPEN_PATCHES_DB_CONTEXT
  ): Promise<PatchDbResult[]> {
    return this.inner.read(queries, ctx);
  }

  async update(
    updates: { patchId: string; attributes: Record<string, unknown> }[],
    ctx: PatchDbContext = OPEN_PATCHES_DB_CONTEXT
  ): Promise<void> {
    return this.inner.update(updates, ctx);
  }

  /**
   * Backfills `patch/createdBy` on existing local patches that have an empty
   * or missing value. Fixes patches created before the metadata stamping was
   * added, which would otherwise be rejected by the server's ABAC write hook
   * on every push attempt.
   */
  async backfillCreatedBy(): Promise<void> {
    const deviceId = this.config.getDeviceId();
    this.config.assertDeviceId?.(deviceId);

    const [result] = await this.inner.read(
      [
        {
          on: 'patches',
          where: {
            type: 'or',
            clauses: [
              { type: 'not_exists', attribute: PATCH_CREATED_BY },
              { type: '=', attribute: PATCH_CREATED_BY, value: '' },
            ],
          },
        },
      ],
      OPEN_PATCHES_DB_CONTEXT
    );

    if (!result || result.patches.length === 0) return;

    await this.inner.update(
      result.patches.map((p) => ({
        patchId: p.patchId,
        attributes: { [PATCH_CREATED_BY]: deviceId },
      })),
      OPEN_PATCHES_DB_CONTEXT
    );
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
