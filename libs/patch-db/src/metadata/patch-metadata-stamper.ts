import { assert } from '@gamezilla/lib/assert';
import type {
  Patch,
  PatchesDbContext,
  PatchesDbQuery,
  PatchesDbResult,
  PatchInput,
} from '../interface';
import { OPEN_PATCHES_DB_CONTEXT } from '../interface';
import type { SubscribablePatchesDbLike } from '../subscribable';
import {
  PATCH_CREATED_BY,
  PATCH_LAST_MODIFIED_AT,
  PATCH_LAST_MODIFIED_BY_ACCOUNT,
  PATCH_LAST_MODIFIED_BY_PRINCIPAL,
} from './patch-metadata';

export type PatchMetadataStamperConfig = {
  getPrincipalId: () => string;
  getAccountId?: () => string | null;
  /** Optional validator for principalId (e.g. assertPrincipalId from domain). */
  assertPrincipalId?: (id: string) => void;
};

/**
 * Stamps every write with authorship metadata (`patch/createdBy`,
 * `patch/lastModifiedByPrincipalId`, etc.) and sets the top-level
 * `createdBy` field on each patch input.
 *
 * Delegates read, update, and subscribe to the inner sync DB.
 */
export class PatchMetadataStamper implements SubscribablePatchesDbLike {
  readonly subscribe: SubscribablePatchesDbLike['subscribe'];

  get hooks() {
    return this.inner.hooks;
  }

  get compaction() {
    return this.inner.compaction;
  }

  constructor(
    private readonly inner: SubscribablePatchesDbLike,
    private readonly config: PatchMetadataStamperConfig
  ) {
    config.assertPrincipalId?.(config.getPrincipalId());
    this.subscribe = inner.subscribe;
  }

  async write(
    patches: PatchInput[],
    ctx: PatchesDbContext = OPEN_PATCHES_DB_CONTEXT
  ): Promise<Patch[]> {
    const principalId = this.config.getPrincipalId();
    this.config.assertPrincipalId?.(principalId);
    const accountId = this.config.getAccountId?.() ?? null;
    const stamped: PatchInput[] = patches.map((p) => {
      const attrs: Record<string, unknown> = {
        ...p.attributes,
        [PATCH_CREATED_BY]: principalId,
        [PATCH_LAST_MODIFIED_BY_PRINCIPAL]: principalId,
        [PATCH_LAST_MODIFIED_AT]: Date.now(),
      };
      if (accountId !== null && accountId !== undefined && accountId !== '') {
        assert.ok(accountId.length > 0, 'accountId must be a non-empty string');
        attrs[PATCH_LAST_MODIFIED_BY_ACCOUNT] = accountId;
      }
      return {
        ...p,
        createdBy: principalId,
        attributes: attrs as PatchInput['attributes'],
      };
    });
    return this.inner.write(stamped, ctx);
  }

  read(
    queries: PatchesDbQuery[],
    ctx: PatchesDbContext = OPEN_PATCHES_DB_CONTEXT
  ): Promise<PatchesDbResult[]> {
    return this.inner.read(queries, ctx);
  }

  async update(
    updates: { patchId: string; attributes: Record<string, unknown> }[],
    ctx: PatchesDbContext = OPEN_PATCHES_DB_CONTEXT
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
    const principalId = this.config.getPrincipalId();
    this.config.assertPrincipalId?.(principalId);

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
        attributes: { [PATCH_CREATED_BY]: principalId },
      })),
      OPEN_PATCHES_DB_CONTEXT
    );
  }

  /**
   * When the wrapped inner sync DB exposes `clearRejectedPushes`, forwards to
   * it so the next push can retry after auth (e.g. session token is set).
   */
  async clearRejectedPushes(): Promise<void> {
    const maybe = this.inner as { clearRejectedPushes?: () => Promise<void> };
    await maybe.clearRejectedPushes?.();
  }
}
