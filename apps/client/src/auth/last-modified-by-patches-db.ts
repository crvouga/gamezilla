import { assertPrincipalId } from '@gamezilla/domain/auth';
import type {
  Patch,
  PatchesDbQuery,
  PatchesDbResult,
  PatchInput,
} from '@gamezilla/patch-db/interface';
import type { SubscribablePatchesDbLike } from '@gamezilla/patch-db/subscribable';

const LAST_MODIFIED_BY_ACCOUNT_ID_KEY = 'patch/lastModifiedByAccountId';
const LAST_MODIFIED_BY_PRINCIPAL_ID_KEY = 'patch/lastModifiedByPrincipalId';

/**
 * Stamps every write with `createdBy: principalId` (→ `patch/createdBy`).
 * Delegates read, update, and subscribe to the inner sync DB.
 */
export class LastModifiedByPatchesDb implements SubscribablePatchesDbLike {
  readonly subscribe: SubscribablePatchesDbLike['subscribe'];

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

  async write(patches: PatchInput[]): Promise<Patch[]> {
    assertPrincipalId(this.config.getPrincipalId());
    const stamped: PatchInput[] = patches.map((p) => ({
      ...p,
      attributes: {
        ...p.attributes,
        [LAST_MODIFIED_BY_PRINCIPAL_ID_KEY]: this.config.getPrincipalId(),
        [LAST_MODIFIED_BY_ACCOUNT_ID_KEY]: this.config.getAccountId(),
      },
    }));
    return this.inner.write(stamped);
  }

  read(queries: PatchesDbQuery[]): Promise<PatchesDbResult[]> {
    return this.inner.read(queries);
  }

  async update(
    updates: { patchId: string; attributes: Record<string, unknown> }[]
  ): Promise<void> {
    return this.inner.update(updates);
  }
}
