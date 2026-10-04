import { asKeywordRecord } from '@pkgs/keyword-shared/keyword';
import type { FormulaWire } from '@pkgs/matchmaking-shared/formula-wire';
import type { CurrentSearch } from '@pkgs/matchmaking-shared/identity';
import type { StatusResult } from '@pkgs/matchmaking-shared/types';
import type { SqlTx } from '@pkgs/sql-client-shared/interface';
import type { Sql } from '@pkgs/sql-shared/sql';
import sql from '@pkgs/sql-shared/sql';
import {
  epochMs,
  parseJsonObject,
  parseJsonValue,
  rowToParticipant,
} from './matchmaker-internals';

type SearchViewRow = {
  readonly id: string;
  readonly status: 'waiting' | 'matched' | 'ended';
  readonly data: unknown;
  readonly metadata: unknown;
  readonly formulas: unknown;
  readonly joined_at: number | string;
  readonly ended_at: number | string | null;
  readonly match_id: string | null;
  readonly peer_id: string | null;
  readonly peer_joined_at: number | string | null;
  readonly peer_data: unknown;
  readonly peer_metadata: unknown;
};

/** Standing, range and every peer come from the same database snapshot. */
function viewQuery(ownerId: string, scope: Sql<unknown>): Sql<SearchViewRow> {
  return sql<SearchViewRow>`SELECT w.id, w.data, w.metadata, w.formulas, w.joined_at, w.ended_at, m.match_id,
    CASE WHEN m.id IS NOT NULL THEN 'matched' WHEN w.deleted_at IS NULL THEN 'waiting' ELSE 'ended' END AS status,
    p.id AS peer_id, p.joined_at AS peer_joined_at, p.data AS peer_data, p.metadata AS peer_metadata
    FROM matchmaking_waiting AS w JOIN matchmaking_owners AS o ON o.id = w.owner_id
    LEFT JOIN matchmaking_matched AS m ON m.id = w.id AND m.deleted_at IS NULL
    LEFT JOIN matchmaking_matched AS p ON p.match_id = m.match_id AND p.id <> m.id AND p.deleted_at IS NULL
    WHERE w.owner_id = ${ownerId} AND ${scope} ORDER BY p.joined_at, p.id`;
}

function standing(rows: readonly SearchViewRow[]): StatusResult | null {
  const row = rows[0];
  if (row === undefined || row.status === 'ended') return null;
  const data = asKeywordRecord(
    parseJsonObject(row.data, 'matchmaking status data'),
    'matchmaking status data'
  );
  const metadata = (parseJsonValue(row.metadata) ?? null) as Record<
    string,
    unknown
  > | null;
  if (row.status === 'waiting') return { status: 'waiting', data, metadata };
  if (row.match_id === null)
    throw new Error('matchmaking: matched search has no match');
  const peers = rows
    .filter((p) => p.peer_id !== null)
    .map((p) => {
      if (p.peer_id === null || p.peer_joined_at === null)
        throw new Error('matchmaking: incomplete peer');
      return rowToParticipant({
        id: p.peer_id,
        joined_at: p.peer_joined_at,
        data: p.peer_data,
        metadata: p.peer_metadata,
      });
    });
  return { status: 'matched', data, metadata, matchId: row.match_id, peers };
}

export async function readSearch(
  tx: SqlTx,
  ownerId: string,
  participantId: string
): Promise<StatusResult | null> {
  return standing(
    await tx.query(viewQuery(ownerId, sql`w.id = ${participantId}`))
  );
}

export async function readCurrent(
  tx: SqlTx,
  ownerId: string,
  nowMs: number
): Promise<CurrentSearch | null> {
  const rows = await tx.query(viewQuery(ownerId, sql`w.id = o.current_id`));
  const row = rows[0];
  if (row === undefined) return null;
  return {
    participantId: row.id,
    joinedAtMs: epochMs(row.joined_at),
    observedAtMs: row.ended_at === null ? nowMs : epochMs(row.ended_at),
    formulas: parseJsonValue(row.formulas) as readonly FormulaWire[],
    result: standing(rows),
  };
}
