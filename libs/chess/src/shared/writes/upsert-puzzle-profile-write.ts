import {
  CHESS_PUZZLE_PROFILES_TABLE,
  ChessPuzzleProfileCol,
} from '@libs/db/shared/chess-tables';
import { sqlMap } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { defineWrite } from '@pkgs/write/shared/define-write';
import { idMatches, ownerMatches } from '@pkgs/write/shared/read-row-values';
import type { RowChange } from '@pkgs/write/shared/row-change';
import { fail, ok } from '@pkgs/write/shared/write-result';

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

function readRowField(
  values: Record<string, unknown>,
  column: string,
  camelKey: string
): unknown {
  return values[column] ?? values[camelKey];
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
  return parseUpsertPuzzleProfileInput({
    ownerId:
      readRowField(values, ChessPuzzleProfileCol.ownerId, 'ownerId') ?? row.id,
    rating: readRowField(values, ChessPuzzleProfileCol.rating, 'rating') ?? 0,
    ratingDeviation:
      readRowField(
        values,
        ChessPuzzleProfileCol.ratingDeviation,
        'ratingDeviation'
      ) ?? 0,
    lastInteractionAt:
      readRowField(
        values,
        ChessPuzzleProfileCol.lastInteractionAt,
        'lastInteractionAt'
      ) ?? new Date(0).toISOString(),
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
  db: SqlClient,
  input: UpsertPuzzleProfileInput
): Promise<void> {
  await db.run(
    sqlMap({
      update: CHESS_PUZZLE_PROFILES_TABLE.tableName,
      set: {
        [ChessPuzzleProfileCol.rating]: input.rating,
        [ChessPuzzleProfileCol.ratingDeviation]: input.ratingDeviation,
        [ChessPuzzleProfileCol.lastInteractionAt]: input.lastInteractionAt,
      },
      where: ['=', ChessPuzzleProfileCol.id, input.ownerId],
    })
  );
}

async function insertProfileRow(
  db: SqlClient,
  input: UpsertPuzzleProfileInput
): Promise<void> {
  await db.run(
    sqlMap({
      insertInto: CHESS_PUZZLE_PROFILES_TABLE.tableName,
      values: {
        [ChessPuzzleProfileCol.id]: input.ownerId,
        [ChessPuzzleProfileCol.ownerId]: input.ownerId,
        [ChessPuzzleProfileCol.rating]: input.rating,
        [ChessPuzzleProfileCol.ratingDeviation]: input.ratingDeviation,
        [ChessPuzzleProfileCol.lastInteractionAt]: input.lastInteractionAt,
      },
    })
  );
}

export const upsertPuzzleProfileWrite = defineWrite<
  UpsertPuzzleProfileInput,
  void
>({
  name: 'chess.puzzle_profile.upsert',
  parseInput: parseUpsertPuzzleProfileInput,
  authorize: async (ctx, input) => authorizeUpsertPuzzleProfile(ctx, input),
  execute: async (_ctx, input, db) => {
    const existing = await db.query(
      sqlMap({
        select: [ChessPuzzleProfileCol.id],
        from: CHESS_PUZZLE_PROFILES_TABLE.tableName,
        where: ['=', ChessPuzzleProfileCol.id, input.ownerId],
        limit: 1,
      })
    );
    if (existing.length > 0) {
      await updateProfileRow(db, input);
    } else {
      await insertProfileRow(db, input);
    }
    return ok(undefined);
  },
});
