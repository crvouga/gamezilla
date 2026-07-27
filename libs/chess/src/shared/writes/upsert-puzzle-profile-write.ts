import {
  CHESS_PUZZLE_PROFILES_TABLE,
  ChessPuzzleProfileCol,
} from '@libs/db/shared/chess-tables';
import { fail, ok } from '@pkgs/write/shared/write-result';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { defineWrite } from '@pkgs/write/shared/define-write';
import { idMatches, ownerMatches } from '@pkgs/write/shared/read-row-values';
import type { RowChange } from '@pkgs/write/shared/row-change';

export type UpsertPuzzleProfileInput = {
  readonly ownerId: string;
  readonly rating: number;
  readonly ratingDeviation: number;
  readonly lastInteractionAt: string;
};

function readRequiredString(
  record: Record<string, unknown>,
  key: string
): string | null {
  const value = record[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function readFiniteNumber(
  record: Record<string, unknown>,
  key: string
): number | null {
  const value = record[key];
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  // PowerSync CRUD / SQLite often wire numeric columns as strings.
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function parseUpsertPuzzleProfileInput(
  raw: unknown
): ReturnType<typeof ok<UpsertPuzzleProfileInput>> | ReturnType<typeof fail> {
  if (raw === null || typeof raw !== 'object') {
    return fail('INVALID_INPUT', 'upsert puzzle profile must be an object');
  }
  const record = raw as Record<string, unknown>;
  const ownerId = readRequiredString(record, 'ownerId');
  const lastInteractionAt = readRequiredString(record, 'lastInteractionAt');
  const rating = readFiniteNumber(record, 'rating');
  const ratingDeviation = readFiniteNumber(record, 'ratingDeviation');
  if (
    ownerId === null ||
    lastInteractionAt === null ||
    rating === null ||
    ratingDeviation === null
  ) {
    return fail('INVALID_INPUT', 'ownerId, ratings, and timestamp required');
  }
  return ok({ ownerId, rating, ratingDeviation, lastInteractionAt });
}

/**
 * Map a sync upload row onto upsert input. PowerSync PATCH `opData` only
 * includes changed columns — fill missing fields with authorize-safe
 * placeholders so partial patches are not rejected (upload only runs
 * `authorize`, then applies the sparse patch columns as-is).
 */
export function rowToUpsertPuzzleProfileInput(
  row: RowChange
): ReturnType<typeof ok<UpsertPuzzleProfileInput>> | ReturnType<typeof fail> {
  if (row.op === 'delete') {
    return fail(
      'CHESS_PROFILE_DELETE_DENIED',
      'puzzle profiles cannot be deleted via sync'
    );
  }
  const values = row.values ?? {};
  const ownerId =
    values[ChessPuzzleProfileCol.ownerId] ??
    values['ownerId'] ??
    row.id;
  const rating =
    values[ChessPuzzleProfileCol.rating] ?? values['rating'] ?? 0;
  const ratingDeviation =
    values[ChessPuzzleProfileCol.ratingDeviation] ??
    values['ratingDeviation'] ??
    0;
  const lastInteractionAt =
    values[ChessPuzzleProfileCol.lastInteractionAt] ??
    values['lastInteractionAt'] ??
    new Date(0).toISOString();
  return parseUpsertPuzzleProfileInput({
    ownerId,
    rating,
    ratingDeviation,
    lastInteractionAt,
  });
}

export async function authorizeUpsertPuzzleProfile(
  ctx: { readonly myId: string },
  input: UpsertPuzzleProfileInput
): Promise<ReturnType<typeof ok<void>> | ReturnType<typeof fail>> {
  const ownerError = ownerMatches(
    input.ownerId,
    ctx.myId,
    'CHESS_OWNER_MISMATCH'
  );
  if (ownerError !== null) return ownerError;
  return (
    idMatches(input.ownerId, ctx.myId, 'CHESS_PROFILE_ID_MISMATCH') ??
    ok(undefined)
  );
}

async function updateProfileRow(
  sql: SqlClient,
  input: UpsertPuzzleProfileInput
): Promise<void> {
  await sql.run(
    `UPDATE ${CHESS_PUZZLE_PROFILES_TABLE.tableName}
     SET ${ChessPuzzleProfileCol.rating} = ?,
         ${ChessPuzzleProfileCol.ratingDeviation} = ?,
         ${ChessPuzzleProfileCol.lastInteractionAt} = ?
     WHERE ${ChessPuzzleProfileCol.id} = ?`,
    [
      input.rating,
      input.ratingDeviation,
      input.lastInteractionAt,
      input.ownerId,
    ]
  );
}

async function insertProfileRow(
  sql: SqlClient,
  input: UpsertPuzzleProfileInput
): Promise<void> {
  await sql.run(
    `INSERT INTO ${CHESS_PUZZLE_PROFILES_TABLE.tableName}
     (${ChessPuzzleProfileCol.id}, ${ChessPuzzleProfileCol.ownerId},
      ${ChessPuzzleProfileCol.rating}, ${ChessPuzzleProfileCol.ratingDeviation},
      ${ChessPuzzleProfileCol.lastInteractionAt})
     VALUES (?, ?, ?, ?, ?)`,
    [
      input.ownerId,
      input.ownerId,
      input.rating,
      input.ratingDeviation,
      input.lastInteractionAt,
    ]
  );
}

export const upsertPuzzleProfileWrite = defineWrite<
  UpsertPuzzleProfileInput,
  void
>({
  name: 'chess.puzzle_profile.upsert',
  parseInput: parseUpsertPuzzleProfileInput,
  authorize: async (ctx, input) => authorizeUpsertPuzzleProfile(ctx, input),
  execute: async (_ctx, input, sql) => {
    const existing = await sql.query<{ readonly n: number }>(
      `SELECT 1 AS n FROM ${CHESS_PUZZLE_PROFILES_TABLE.tableName}
       WHERE ${ChessPuzzleProfileCol.id} = ? LIMIT 1`,
      [input.ownerId]
    );
    if (existing.length > 0) {
      await updateProfileRow(sql, input);
    } else {
      await insertProfileRow(sql, input);
    }
    return ok(undefined);
  },
});
