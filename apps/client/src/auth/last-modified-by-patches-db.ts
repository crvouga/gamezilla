import { assertPrincipalId } from '@gamezilla/domain/auth';
import { assert } from '@gamezilla/lib/assert';
import type {
  Patch,
  PatchesDbContext,
  PatchesDbQuery,
  PatchesDbResult,
  PatchInput,
} from '@gamezilla/patch-db/interface';
import { OPEN_PATCHES_DB_CONTEXT } from '@gamezilla/patch-db/interface';
import type { SubscribablePatchesDbLike } from '@gamezilla/patch-db/subscribable';

export const LAST_MODIFIED_BY_ACCOUNT_ID_KEY = 'patch/lastModifiedByAccountId';
export const LAST_MODIFIED_BY_PRINCIPAL_ID_KEY =
  'patch/lastModifiedByPrincipalId';
export const LAST_MODIFIED_AT_KEY = 'patch/lastModifiedAt';

/**
 * Stamps every write with `createdBy: principalId` (→ `patch/createdBy`).
 * Delegates read, update, and subscribe to the inner sync DB.
 */
export class LastModifiedByPatchesDb implements SubscribablePatchesDbLike {
  readonly subscribe: SubscribablePatchesDbLike['subscribe'];

  get hooks() {
    return this.inner.hooks;
  }

  get compaction() {
    return this.inner.compaction;
  }

  constructor(
    private readonly inner: SubscribablePatchesDbLike,
    private readonly config: {
      getPrincipalId: () => string;
      getAccountId: () => string | null;
    }
  ) {
    assertPrincipalId(config.getPrincipalId());
    this.subscribe = inner.subscribe;
  }

  async write(
    patches: PatchInput[],
    ctx: PatchesDbContext = OPEN_PATCHES_DB_CONTEXT
  ): Promise<Patch[]> {
    assertPrincipalId(this.config.getPrincipalId());
    const accountId = this.config.getAccountId();
    const stamped: PatchInput[] = patches.map((p) => {
      const attrs: Record<string, unknown> = {
        ...p.attributes,
        [LAST_MODIFIED_BY_PRINCIPAL_ID_KEY]: this.config.getPrincipalId(),
        [LAST_MODIFIED_AT_KEY]: Date.now(),
      };
      if (accountId !== null && accountId !== undefined && accountId !== '') {
        assert.ok(accountId.length > 0, 'accountId must be a non-empty string');
        attrs[LAST_MODIFIED_BY_ACCOUNT_ID_KEY] = accountId;
      }
      return { ...p, attributes: attrs as PatchInput['attributes'] };
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
}
