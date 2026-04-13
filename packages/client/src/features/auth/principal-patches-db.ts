import type {
  Patch,
  PatchesDbQuery,
  PatchesDbResult,
  PatchInput,
} from '@gamezilla/patch-db/interface';
import type { SubscribablePatchesDbLike } from '@gamezilla/patch-db/subscribable';
import { assertPrincipalId } from '@gamezilla/shared/auth';

/**
 * Stamps every write with `createdBy: principalId` (→ `patch/createdBy`).
 * Delegates read, update, and subscribe to the inner sync DB.
 */
export class PrincipalPatchesDb implements SubscribablePatchesDbLike {
  readonly subscribe: SubscribablePatchesDbLike['subscribe'];

  constructor(
    private readonly inner: SubscribablePatchesDbLike,
    private readonly principalId: string
  ) {
    assertPrincipalId(principalId);
    this.subscribe = inner.subscribe;
  }

  async write(patches: PatchInput[]): Promise<Patch[]> {
    assertPrincipalId(this.principalId);
    const stamped: PatchInput[] = patches.map((p) => ({
      ...p,
      attributes: {
        ...p.attributes,
        'patch/createdBy': this.principalId,
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
