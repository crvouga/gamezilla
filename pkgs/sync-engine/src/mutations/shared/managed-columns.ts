import type { CreateId } from '@pkgs/uuid';

/**
 * Managed columns for domain INSERTs that do not go through
 * {@link wrapMutationDb} / {@link injectManagedColumns}.
 */
export type ManagedInsertColumns = {
  readonly id: string;
  readonly created_at: string;
  readonly updated_at: string;
};

export function managedInsertColumns(
  createId: CreateId,
  now: () => number,
  /** When set, use this business identity as the PK instead of minting. */
  id?: string
): ManagedInsertColumns {
  const nowIso = new Date(now()).toISOString();
  return {
    id: id ?? createId(),
    created_at: nowIso,
    updated_at: nowIso,
  };
}

export function managedUpdatedAtIso(now: () => number): string {
  return new Date(now()).toISOString();
}
