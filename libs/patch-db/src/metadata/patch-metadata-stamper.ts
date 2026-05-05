import { assert } from '@gamezilla/lib/assert';
import type {
  PatchDbContext,
  PatchDbQuery,
  PatchDbQueryWhereClause,
  PatchDbResult,
  PatchInput,
  WritePatchesResult,
} from '../interface';
import { OPEN_PATCHES_DB_CONTEXT } from '../interface';
import { PATCH_DB_SYSTEM_DEVICE_ID } from '../policy/system-device';
import type { SubscribablePatchDbLike } from '../subscribable';
import {
  PATCH_CREATED_BY_ID,
  PATCH_CREATED_BY_LEGACY,
  PATCH_LAST_MODIFIED_AT,
  PATCH_LAST_MODIFIED_BY_ID,
} from './patch-metadata';

function backfillWhereEmptyOrMissing(): PatchDbQueryWhereClause {
  return {
    type: 'or',
    clauses: [
      {
        type: 'and',
        clauses: [
          { type: 'not_exists', attribute: PATCH_CREATED_BY_ID },
          { type: 'not_exists', attribute: PATCH_CREATED_BY_LEGACY },
        ],
      },
      { type: '=', attribute: PATCH_CREATED_BY_ID, value: '' },
      { type: '=', attribute: PATCH_CREATED_BY_LEGACY, value: '' },
    ],
  };
}

function backfillWhereStaleNewKey(myId: string): PatchDbQueryWhereClause {
  return {
    type: 'and',
    clauses: [
      { type: 'exists', attribute: PATCH_CREATED_BY_ID },
      { type: '!=', attribute: PATCH_CREATED_BY_ID, value: myId },
      { type: '!=', attribute: PATCH_CREATED_BY_ID, value: '' },
      {
        type: '!=',
        attribute: PATCH_CREATED_BY_ID,
        value: PATCH_DB_SYSTEM_DEVICE_ID,
      },
    ],
  };
}

function backfillWhereStaleLegacyOnly(myId: string): PatchDbQueryWhereClause {
  return {
    type: 'and',
    clauses: [
      { type: 'not_exists', attribute: PATCH_CREATED_BY_ID },
      { type: 'exists', attribute: PATCH_CREATED_BY_LEGACY },
      { type: '!=', attribute: PATCH_CREATED_BY_LEGACY, value: myId },
      { type: '!=', attribute: PATCH_CREATED_BY_LEGACY, value: '' },
      {
        type: '!=',
        attribute: PATCH_CREATED_BY_LEGACY,
        value: PATCH_DB_SYSTEM_DEVICE_ID,
      },
    ],
  };
}

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
 * Stamps every write with authorship metadata (`patch/createdById`,
 * `patch/lastModifiedById`, etc.) and sets the top-level
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
    const myId = this.config.getMyId();
    assert.ok(myId.length > 0, 'myId must be non-empty');
    const stamped: PatchInput[] = patches.map((p) => {
      const attrs: Record<string, unknown> = {
        ...p.attributes,
        [PATCH_CREATED_BY_ID]: myId,
        [PATCH_LAST_MODIFIED_BY_ID]: myId,
        [PATCH_LAST_MODIFIED_AT]: Date.now(),
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

  private async backfillPatchesWhere(
    myId: string,
    where: PatchDbQueryWhereClause
  ): Promise<void> {
    const [row] = await this.inner.read(
      [{ on: 'patches', where }],
      OPEN_PATCHES_DB_CONTEXT
    );
    if (row === undefined || row.patches.length === 0) return;
    await this.inner.update(
      row.patches.map((p) => ({
        patchId: p.patchId,
        attributes: { [PATCH_CREATED_BY_ID]: myId },
      })),
      OPEN_PATCHES_DB_CONTEXT
    );
  }

  /**
   * Backfills `patch/createdById` on existing local patches that have an empty
   * or missing value, then rewrites values that still differ from the current
   * my id. Skips {@link PATCH_DB_SYSTEM_DEVICE_ID}. Without this, ABAC
   * rejects pushes with `patch/createdById must match author`.
   */
  async backfillCreatedBy(): Promise<void> {
    const myId = this.config.getMyId();
    this.config.assertDeviceId?.(this.config.getDeviceId());
    await this.backfillPatchesWhere(myId, backfillWhereEmptyOrMissing());
    await this.backfillPatchesWhere(myId, backfillWhereStaleNewKey(myId));
    await this.backfillPatchesWhere(myId, backfillWhereStaleLegacyOnly(myId));
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
