import type { SqlTx } from '@pkgs/sql-client-root-shared-ts/interface';
import sql from '@pkgs/sql-root-shared-ts/sql';
import { OPPONENT_RATING_KEY } from './search-config';

/**
 * The rating a search is made at. A Synthetic User meets a person at the
 * person's own level: its search takes the rating of the person who has
 * waited longest in the same pool, so no rating range keeps a person from
 * the Synthetic User sent to play them. Everyone else searches at their own.
 */
export async function searchRating(
  tx: SqlTx,
  args: {
    readonly ownerId: string;
    readonly ownRating: number;
    readonly poolSignature: string;
  }
): Promise<number> {
  const kind = await tx.query(
    sql<{
      account_kind: string | null;
    }>`SELECT account_kind FROM profile WHERE id = ${args.ownerId} AND deleted_at IS NULL`
  );
  if (kind[0]?.account_kind !== 'synthetic') return args.ownRating;
  const waiting = await tx.query(
    sql<{ data: unknown }>`SELECT w.data FROM matchmaking_waiting AS w
      JOIN matchmaking_owners AS o ON o.id = w.owner_id AND o.current_id = w.id
      LEFT JOIN profile AS p ON p.id = w.owner_id
      WHERE w.partition_signature = ${args.poolSignature} AND w.deleted_at IS NULL
        AND o.deleted_at IS NULL AND o.available = ${true} AND w.owner_id <> ${args.ownerId}
        AND (p.account_kind IS NULL OR p.account_kind <> ${'synthetic'})
      ORDER BY w.joined_at, w.id LIMIT 1`
  );
  const raw = waiting[0]?.data;
  const data = typeof raw === 'string' ? (JSON.parse(raw) as unknown) : raw;
  const rating =
    typeof data === 'object' && data !== null
      ? (data as Record<string, unknown>)[OPPONENT_RATING_KEY]
      : undefined;
  return typeof rating === 'number' ? rating : args.ownRating;
}
