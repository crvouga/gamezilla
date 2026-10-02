import { sql } from '@pkgs/sql';
import type { MatchmakingHarness } from './scenario/facade';

export type StoredSearch = {
  readonly owner_id: string;
  readonly current_id: string | null;
  readonly search_id: string | null;
  readonly partition_signature: string | null;
  readonly group_size: number | string | null;
  readonly ended: boolean | number;
  readonly match_id: string | null;
};

/** A single committed snapshot of the store the example lobby writes. */
export function storedSearches(s: MatchmakingHarness): Promise<StoredSearch[]> {
  return s.db.transaction((tx) =>
    tx.query(sql<StoredSearch>`
    SELECT o.id AS owner_id, o.current_id, w.id AS search_id,
      w.partition_signature, w.group_size, (w.deleted_at IS NOT NULL) AS ended, m.match_id
    FROM matchmaking_owners AS o
    LEFT JOIN matchmaking_waiting AS w ON w.owner_id = o.id
    LEFT JOIN matchmaking_matched AS m ON m.id = w.id AND m.deleted_at IS NULL
    ORDER BY o.id, w.id
  `)
  );
}
