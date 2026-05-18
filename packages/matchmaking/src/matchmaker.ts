/**
 * Thin wrapper around the Postgres-owned matchmaking schema.
 *
 * Every queue mutation is a single SQL statement; `runMatchPass` calls the
 * server-side `matchmaking_run_match_pass()` function which does the
 * locking, formula-driven distance computation, pairing, status flip, and
 * match-id minting inside one PL/pgSQL routine. The only state held in JS
 * is the radius config the constructor receives — no in-memory queue
 * mirror, no in-flight match buffer, no pairing algorithm.
 *
 * Per-player formulas: each `join()` carries a non-empty ORDERED list of
 * `DistanceFormula`s the player is willing to accept; the SQL function
 * picks the first mutually-satisfied pair. There is no global formula and
 * no `onMatch` callback — callers poll `status(playerId)` and read the
 * emitted `matchId` to bring the match online (e.g. as a Durable Object).
 *
 * Tiger-style asserts run at every boundary:
 *   - `join()` validates `data` is an `AttributeState`, `formulas` is
 *     non-empty, and every formula's numeric tags resolve to a finite
 *     number from `data`.
 *   - `status()` re-brands the JSONB rows coming back from the DB as
 *     `AttributeState` via `asKeywordRecord`.
 */

import { assert } from '@gamezilla/lib/assert';
import type { AttributeState } from '@gamezilla/lib/attribute';
import { asKeywordRecord, assertKeywordRecord } from '@gamezilla/lib/keyword';
import type { Pool } from 'pg';
import { createPgSqlClient } from './pg-adapter';
import type { SqlClient } from './sql-client';
import {
  DEFAULT_RADIUS_OPTIONS,
  type DistanceFormula,
  type JoinInput,
  type JoinResult,
  type LeaveResult,
  type MatchPassResult,
  type MatchedPlayer,
  type PlayerStatus,
  type RadiusOptions,
  type StatusResult,
} from './types';

export type MatchmakerOptions = {
  readonly pool?: Pool;
  readonly sqlClient?: SqlClient;
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
  readonly match_id: string | null;
};

type OpponentRow = {
  readonly id: string;
  readonly joined_at: Date;
  readonly data: Record<string, unknown>;
};

type MatchPassRow = {
  readonly match_id: string;
  readonly player_id: string;
  readonly joined_at: Date;
  readonly data: Record<string, unknown>;
};

export type NumericTermWire = {
  readonly path: string;
  readonly weight: number;
};
export type CategoricalTermWire = {
  readonly path: string;
  readonly penalty: number;
};
export type PartitionTermWire = { readonly path: string };

/**
 * JSON-serializable form of a {@link DistanceFormula}. The HTTP / RPC
 * boundary cannot carry `AttributeTag` (which holds parser functions), so
 * wire-shaped formulas reference attribute keys as plain strings. Tests
 * that drive the matchmaker via HTTP and the bundled Hono app both speak
 * this shape directly.
 */
export type FormulaWire = {
  readonly numeric: readonly NumericTermWire[];
  readonly categorical?: readonly CategoricalTermWire[];
  readonly partition?: readonly PartitionTermWire[];
};

export type JoinInputRaw = {
  readonly data: AttributeState;
  readonly formulas: readonly FormulaWire[];
};

function resolveSqlClient(opts: MatchmakerOptions): SqlClient {
  if (opts.sqlClient !== undefined) return opts.sqlClient;
  if (opts.pool !== undefined) return createPgSqlClient(opts.pool);
  throw new Error('Matchmaker requires either `pool` or `sqlClient`');
}

function assertFormula(formula: DistanceFormula, label: string): void {
  assert.defined(formula, `${label}: formula is required`);
  assert.array(formula.numeric, `${label}: formula.numeric must be an array`);
  const catTerms = formula.categorical ?? [];
  const partTerms = formula.partition ?? [];
  assert.ok(
    formula.numeric.length + catTerms.length + partTerms.length > 0,
    `${label}: formula must declare at least one numeric, categorical, or partition term`
  );
  for (const t of formula.numeric) {
    assert.ok(
      Number.isFinite(t.weight) && t.weight >= 0,
      `${label}: numeric weight must be a non-negative finite number`,
      { tag: t.tag.key, weight: t.weight }
    );
  }
  for (const t of catTerms) {
    assert.ok(
      Number.isFinite(t.penalty) && t.penalty >= 0,
      `${label}: categorical penalty must be a non-negative finite number`,
      { tag: t.tag.key, penalty: t.penalty }
    );
  }
}

function assertDataMatchesFormula(
  data: AttributeState,
  formula: DistanceFormula,
  label: string
): void {
  for (const t of formula.numeric) {
    const v = t.tag.from(data);
    assert.ok(
      typeof v === 'number' && Number.isFinite(v),
      `${label}: numeric attr ${t.tag.key} must parse to a finite number`,
      { key: t.tag.key, value: v }
    );
  }
  for (const t of formula.categorical ?? []) {
    t.tag.parse(data[t.tag.key]);
  }
  for (const t of formula.partition ?? []) {
    t.tag.parse(data[t.tag.key]);
  }
}

function serializeFormula(formula: DistanceFormula): FormulaWire {
  return {
    numeric: formula.numeric.map((t) => ({
      path: t.tag.key,
      weight: t.weight,
    })),
    categorical: (formula.categorical ?? []).map((t) => ({
      path: t.tag.key,
      penalty: t.penalty,
    })),
    partition: (formula.partition ?? []).map((t) => ({
      path: t.tag.key,
    })),
  };
}

function assertWireFormula(wire: FormulaWire, label: string): void {
  assert.defined(wire, `${label}: formula required`);
  assert.array(wire.numeric, `${label}: numeric must be an array`);
  for (let i = 0; i < wire.numeric.length; i += 1) {
    const term: NumericTermWire | undefined = wire.numeric[i];
    assert.defined(term, `${label}: numeric[${String(i)}] required`);
    assert.nonEmptyString(
      term.path,
      `${label}: numeric[${String(i)}].path must be a non-empty string`
    );
    assert.ok(
      Number.isFinite(term.weight) && term.weight >= 0,
      `${label}: numeric[${String(i)}].weight must be a non-negative finite number`,
      { path: term.path, weight: term.weight }
    );
  }
  const cats = wire.categorical ?? [];
  for (let i = 0; i < cats.length; i += 1) {
    const term: CategoricalTermWire | undefined = cats[i];
    assert.defined(term, `${label}: categorical[${String(i)}] required`);
    assert.nonEmptyString(
      term.path,
      `${label}: categorical[${String(i)}].path must be a non-empty string`
    );
    assert.ok(
      Number.isFinite(term.penalty) && term.penalty >= 0,
      `${label}: categorical[${String(i)}].penalty must be a non-negative finite number`,
      { path: term.path, penalty: term.penalty }
    );
  }
  const parts = wire.partition ?? [];
  for (let i = 0; i < parts.length; i += 1) {
    const term: PartitionTermWire | undefined = parts[i];
    assert.defined(term, `${label}: partition[${String(i)}] required`);
    assert.nonEmptyString(
      term.path,
      `${label}: partition[${String(i)}].path must be a non-empty string`
    );
  }
  assert.ok(
    wire.numeric.length + cats.length + parts.length > 0,
    `${label}: formula must declare at least one numeric, categorical, or partition term`
  );
}

function rowToPlayer(row: OpponentRow): MatchedPlayer {
  const data = asKeywordRecord(row.data, 'matchmaking opponent data');
  return {
    playerId: row.id,
    joinedAt: row.joined_at,
    data,
  };
}

export class Matchmaker {
  private readonly sqlClient: SqlClient;
  private readonly radius: RadiusOptions;
  private readonly clock: (() => number) | undefined;

  constructor(opts: MatchmakerOptions) {
    this.sqlClient = resolveSqlClient(opts);
    this.radius = opts.radius ?? DEFAULT_RADIUS_OPTIONS;
    this.clock = opts.now;
  }

  async join(input: JoinInput): Promise<JoinResult> {
    assert.defined(input, 'Matchmaker.join: input required');
    assert.record(input.data, 'Matchmaker.join: data must be an object');
    assertKeywordRecord(assert, input.data, 'Matchmaker.join: data');
    assert.array(input.formulas, 'Matchmaker.join: formulas must be an array');
    assert.ok(
      input.formulas.length > 0,
      'Matchmaker.join: formulas must be non-empty'
    );
    for (let i = 0; i < input.formulas.length; i += 1) {
      const label = `Matchmaker.join: formulas[${String(i)}]`;
      const formula: DistanceFormula | undefined = input.formulas[i];
      assert.defined(formula, `${label}: formula required`);
      assertFormula(formula, label);
      assertDataMatchesFormula(input.data, formula, label);
    }

    const wire = input.formulas.map(serializeFormula);
    return this.insertJoin(input.data, wire);
  }

  /**
   * Wire-shaped escape hatch for HTTP / RPC boundaries that can't carry
   * `AttributeTag` objects (parsers, etc.). Performs shape-level validation
   * on the formulas; per-formula numeric/data alignment is enforced by the
   * SQL `matchmaking_pair_distance` helper at match-pass time (a missing
   * numeric attr raises there).
   */
  async joinRaw(input: JoinInputRaw): Promise<JoinResult> {
    assert.defined(input, 'Matchmaker.joinRaw: input required');
    assert.record(input.data, 'Matchmaker.joinRaw: data must be an object');
    assertKeywordRecord(assert, input.data, 'Matchmaker.joinRaw: data');
    assert.array(
      input.formulas,
      'Matchmaker.joinRaw: formulas must be an array'
    );
    assert.ok(
      input.formulas.length > 0,
      'Matchmaker.joinRaw: formulas must be non-empty'
    );
    for (let i = 0; i < input.formulas.length; i += 1) {
      const label = `Matchmaker.joinRaw: formulas[${String(i)}]`;
      const wire: FormulaWire | undefined = input.formulas[i];
      assert.defined(wire, `${label}: formula required`);
      assertWireFormula(wire, label);
    }
    return this.insertJoin(input.data, input.formulas);
  }

  private async insertJoin(
    data: AttributeState,
    formulas: readonly FormulaWire[]
  ): Promise<JoinResult> {
    const result = await this.sqlClient.query<{ id: string }>(
      `INSERT INTO matchmaking_queue (data, formulas)
       VALUES ($1::jsonb, $2::jsonb)
       RETURNING id`,
      [JSON.stringify(data), JSON.stringify(formulas)]
    );
    const row = result.rows[0];
    if (row === undefined) {
      throw new Error('matchmaking insert returned no rows');
    }
    return { playerId: row.id };
  }

  async leave(playerId: string): Promise<LeaveResult> {
    assert.nonEmptyString(
      playerId,
      'Matchmaker.leave: playerId must be a non-empty string'
    );
    const result = await this.sqlClient.query<{ id: string }>(
      `DELETE FROM matchmaking_queue WHERE id = $1 RETURNING id`,
      [playerId]
    );
    return { removed: result.rows.length > 0 };
  }

  async status(playerId: string): Promise<StatusResult | null> {
    assert.nonEmptyString(
      playerId,
      'Matchmaker.status: playerId must be a non-empty string'
    );
    const result = await this.sqlClient.query<StatusRow>(
      `SELECT status, data, match_id
       FROM matchmaking_queue
       WHERE id = $1`,
      [playerId]
    );
    const row = result.rows[0];
    if (row === undefined) return null;
    const data = asKeywordRecord(row.data, 'matchmaking status data');
    if (row.status === 'waiting') {
      return { status: 'waiting', data };
    }
    if (row.match_id === null) {
      throw new Error(
        `matchmaking row ${playerId} is matched but has no match_id`
      );
    }
    const opponents = await this.sqlClient.query<OpponentRow>(
      `SELECT id, joined_at, data
       FROM matchmaking_queue
       WHERE match_id = $1 AND id <> $2
       ORDER BY joined_at`,
      [row.match_id, playerId]
    );
    return {
      status: 'matched',
      data,
      matchId: row.match_id,
      opponents: opponents.rows.map(rowToPlayer),
    };
  }

  async runMatchPass(): Promise<MatchPassResult> {
    const nowParam =
      this.clock === undefined ? null : new Date(this.clock()).toISOString();
    const result = await this.sqlClient.query<MatchPassRow>(
      `SELECT match_id, player_id, joined_at, data
       FROM matchmaking_run_match_pass($1, $2, $3, $4)`,
      [
        this.radius.baseRadius,
        this.radius.radiusGrowthPerSecond,
        this.radius.maxRadius,
        nowParam,
      ]
    );
    const matchIds = new Set<string>();
    for (const r of result.rows) matchIds.add(r.match_id);
    return { matches: matchIds.size };
  }
}
