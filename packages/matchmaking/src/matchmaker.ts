/**
 * Thin wrapper around the Postgres-owned matchmaking schema.
 *
 * Every queue mutation is a single SQL statement; `runMatchPass` calls the
 * server-side `matchmaking_run_match_pass()` function which does the locking,
 * pairing, status flip, and row return inside one PL/pgSQL routine. The only
 * state held in JS is the configuration the constructor receives — no
 * in-memory queue mirror, no in-flight match buffer, no pairing algorithm.
 *
 * `onMatch` runs **outside** the function call. The DB has already committed
 * `status='matched'` for every player in every returned group, so the app is
 * expected to be idempotent: a callback failure does not roll back the queue
 * (holding row locks across user code would let one slow consumer block the
 * whole queue, and the spec leaves match-record creation entirely to the
 * caller).
 */

import type { Pool } from 'pg';
import { createPgSqlClient } from './pg-adapter';
import type { SqlClient } from './sql-client';
import {
  DEFAULT_MATCH_SIZE,
  DEFAULT_RADIUS_OPTIONS,
  type JoinInput,
  type JoinResult,
  type LeaveResult,
  type MatchPassResult,
  type MatchedPlayer,
  type OnMatch,
  type PlayerStatus,
  type RadiusOptions,
  type StatusResult,
} from './types';

export type MatchmakerOptions = {
  readonly pool?: Pool;
  readonly sqlClient?: SqlClient;
  readonly matchSize?: number;
  readonly onMatch: OnMatch;
  readonly radius?: RadiusOptions;
  /**
   * Optional clock override (epoch ms). When omitted, the SQL function uses
   * the database's `now()` — recommended in production so wait times stay
   * consistent with `joined_at`. Tests inject this to simulate time
   * advancing without sleeping.
   */
  readonly now?: () => number;
};

type StatusRow = {
  readonly status: PlayerStatus;
  readonly data: Record<string, unknown>;
};

type MatchPassRow = {
  readonly group_seq: number;
  readonly player_id: string;
  readonly rating: number;
  readonly joined_at: Date;
  readonly data: Record<string, unknown>;
};

function resolveSqlClient(opts: MatchmakerOptions): SqlClient {
  if (opts.sqlClient !== undefined) return opts.sqlClient;
  if (opts.pool !== undefined) return createPgSqlClient(opts.pool);
  throw new Error('Matchmaker requires either `pool` or `sqlClient`');
}

function rowToPlayer(row: MatchPassRow): MatchedPlayer {
  return {
    playerId: row.player_id,
    rating: row.rating,
    joinedAt: row.joined_at,
    data: row.data,
  };
}

function groupRows(
  rows: readonly MatchPassRow[]
): readonly (readonly MatchedPlayer[])[] {
  const grouped = new Map<number, MatchedPlayer[]>();
  for (const row of rows) {
    const existing = grouped.get(row.group_seq);
    if (existing !== undefined) {
      existing.push(rowToPlayer(row));
    } else {
      grouped.set(row.group_seq, [rowToPlayer(row)]);
    }
  }
  return [...grouped.values()];
}

export class Matchmaker {
  private readonly sqlClient: SqlClient;
  private readonly matchSize: number;
  private readonly radius: RadiusOptions;
  private readonly onMatch: OnMatch;
  private readonly clock: (() => number) | undefined;

  constructor(opts: MatchmakerOptions) {
    this.sqlClient = resolveSqlClient(opts);
    this.matchSize = opts.matchSize ?? DEFAULT_MATCH_SIZE;
    if (this.matchSize < 2) {
      throw new Error('matchSize must be >= 2');
    }
    this.radius = opts.radius ?? DEFAULT_RADIUS_OPTIONS;
    this.onMatch = opts.onMatch;
    this.clock = opts.now;
  }

  async join(input: JoinInput): Promise<JoinResult> {
    const result = await this.sqlClient.query<{ id: string }>(
      `INSERT INTO matchmaking_queue (rating, data)
       VALUES ($1, $2::jsonb)
       RETURNING id`,
      [input.rating, JSON.stringify(input.data)]
    );
    const row = result.rows[0];
    if (row === undefined) {
      throw new Error('matchmaking insert returned no rows');
    }
    return { playerId: row.id };
  }

  async leave(playerId: string): Promise<LeaveResult> {
    const result = await this.sqlClient.query<{ id: string }>(
      `DELETE FROM matchmaking_queue WHERE id = $1 RETURNING id`,
      [playerId]
    );
    return { removed: result.rows.length > 0 };
  }

  async status(playerId: string): Promise<StatusResult | null> {
    const result = await this.sqlClient.query<StatusRow>(
      `SELECT status, data FROM matchmaking_queue WHERE id = $1`,
      [playerId]
    );
    const row = result.rows[0];
    if (row === undefined) return null;
    return { status: row.status, data: row.data };
  }

  async runMatchPass(): Promise<MatchPassResult> {
    const nowParam =
      this.clock === undefined ? null : new Date(this.clock()).toISOString();
    const result = await this.sqlClient.query<MatchPassRow>(
      `SELECT group_seq, player_id, rating, joined_at, data
       FROM matchmaking_run_match_pass($1, $2, $3, $4, $5)`,
      [
        this.matchSize,
        this.radius.baseRadius,
        this.radius.radiusGrowthPerSecond,
        this.radius.maxRadius,
        nowParam,
      ]
    );
    if (result.rows.length === 0) return { matches: 0 };

    const groups = groupRows(result.rows);
    for (const group of groups) {
      await this.onMatch(group);
    }
    return { matches: groups.length };
  }
}
