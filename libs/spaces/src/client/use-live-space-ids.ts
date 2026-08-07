import { sql } from '@pkgs/sql';

import { useQuery } from '@pkgs/sync-engine/client';

type SpaceIdRow = { readonly id: string };

/**
 * Ids of every live (non-ended) space, ordered newest-first.
 */
export function useLiveSpaceIds(): {
  readonly spaceIds: readonly string[];
  readonly isLoading: boolean;
} {
  const { rows, isLoading } = useQuery(
    sql<SpaceIdRow>`
      SELECT id
      FROM spaces
      WHERE ended_at IS NULL
      ORDER BY created_at DESC
    `
  );
  return { spaceIds: rows.map((r) => r.id), isLoading };
}
