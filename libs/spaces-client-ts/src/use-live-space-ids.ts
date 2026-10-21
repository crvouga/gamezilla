import sql from '@pkgs/sql-root-shared-ts/sql';
import { createQuery } from '@pkgs/sync-engine-client-ts/sync-engine-context';
import { type Accessor, createMemo } from 'solid-js';

type SpaceIdRow = { readonly id: string };

/**
 * Ids of every live (non-ended) space, ordered newest-first.
 */
export function useLiveSpaceIds(): {
  readonly spaceIds: Accessor<readonly string[]>;
  readonly isLoading: Accessor<boolean>;
} {
  const query = createQuery(
    () =>
      sql<SpaceIdRow>`
        SELECT id
        FROM spaces
        WHERE ended_at IS NULL
        ORDER BY created_at DESC
      `
  );
  const spaceIds = createMemo(() => query.rows().map((r) => r.id));
  return {
    spaceIds,
    isLoading: query.isLoading,
  };
}
