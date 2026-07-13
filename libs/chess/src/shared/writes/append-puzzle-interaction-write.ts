import {
  CHESS_PUZZLE_INTERACTIONS_TABLE,
  ChessPuzzleInteractionCol,
} from '@libs/db/shared/chess-tables';
import { fail, ok } from '@pkgs/write/shared/write-result';
import { defineWrite } from '@pkgs/write/shared/define-write';
import { ownerMatches } from '@pkgs/write/shared/read-row-values';
import type { RowChange } from '@pkgs/write/shared/row-change';

import {
  CHESS_PUZZLE_INTERACTION_KIND,
  type ChessPuzzleInteractionKind,
} from '../chess-puzzle-interaction-entities';

const ALL_KINDS: ReadonlySet<string> = new Set(
  Object.values(CHESS_PUZZLE_INTERACTION_KIND)
);

export type AppendPuzzleInteractionInput = {
  readonly ownerId: string;
  readonly puzzleId: string;
  readonly puzzleRating: number;
  readonly kind: ChessPuzzleInteractionKind;
  readonly solveIdx: number;
  readonly uci?: string | null;
  readonly correct?: boolean | null;
  readonly ratingBefore?: number;
  readonly ratingAfter?: number;
};

function readRequiredString(
  record: Record<string, unknown>,
  key: string
): string | null {
  const value = record[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function readNonNegativeNumber(
  record: Record<string, unknown>,
  key: string,
  fallback: number
): number {
  const value = record[key];
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
    return value;
  }
  return fallback;
}

function parseKind(value: unknown): ChessPuzzleInteractionKind | null {
  if (typeof value === 'string' && ALL_KINDS.has(value)) {
    return value as ChessPuzzleInteractionKind;
  }
  return null;
}

export function parseAppendPuzzleInteractionInput(
  raw: unknown
): ReturnType<typeof ok<AppendPuzzleInteractionInput>> | ReturnType<typeof fail> {
  if (raw === null || typeof raw !== 'object') {
    return fail('INVALID_INPUT', 'append puzzle interaction must be an object');
  }
  const record = raw as Record<string, unknown>;
  const ownerId = readRequiredString(record, 'ownerId');
  const puzzleId = readRequiredString(record, 'puzzleId');
  const kind = parseKind(record['kind']);
  if (ownerId === null || puzzleId === null || kind === null) {
    return fail('INVALID_INPUT', 'ownerId, puzzleId, and kind are required');
  }
  const correct = record['correct'];
  const input: AppendPuzzleInteractionInput = {
    ownerId,
    puzzleId,
    kind,
    puzzleRating: readNonNegativeNumber(record, 'puzzleRating', 0),
    solveIdx: readNonNegativeNumber(record, 'solveIdx', 0),
    ratingBefore: readNonNegativeNumber(record, 'ratingBefore', 0),
    ratingAfter: readNonNegativeNumber(record, 'ratingAfter', 0),
    ...(typeof record['uci'] === 'string' ? { uci: record['uci'] } : {}),
    ...(correct === true || correct === false || correct === null
      ? { correct }
      : {}),
  };
  return ok(input);
}

export function rowToAppendPuzzleInteractionInput(
  row: RowChange
): ReturnType<typeof ok<AppendPuzzleInteractionInput>> | ReturnType<typeof fail> {
  if (row.op === 'delete') {
    return fail(
      'CHESS_INTERACTION_DELETE_DENIED',
      'puzzle interactions cannot be deleted via sync'
    );
  }
  const values = row.values ?? {};
  return parseAppendPuzzleInteractionInput({
    ownerId: values[ChessPuzzleInteractionCol.ownerId],
    puzzleId: values[ChessPuzzleInteractionCol.puzzleId],
    puzzleRating: values[ChessPuzzleInteractionCol.puzzleRating],
    kind: values[ChessPuzzleInteractionCol.kind],
    solveIdx: values[ChessPuzzleInteractionCol.solveIdx],
    uci: values[ChessPuzzleInteractionCol.uci],
    correct:
      values[ChessPuzzleInteractionCol.correct] === 1
        ? true
        : values[ChessPuzzleInteractionCol.correct] === 0
          ? false
          : values[ChessPuzzleInteractionCol.correct],
    ratingBefore: values[ChessPuzzleInteractionCol.ratingBefore],
    ratingAfter: values[ChessPuzzleInteractionCol.ratingAfter],
  });
}

export async function authorizeAppendPuzzleInteraction(
  ctx: { readonly myId: string },
  input: AppendPuzzleInteractionInput
): Promise<ReturnType<typeof ok<void>> | ReturnType<typeof fail>> {
  return (
    ownerMatches(input.ownerId, ctx.myId, 'CHESS_OWNER_MISMATCH') ??
    ok(undefined)
  );
}

export const appendPuzzleInteractionWrite = defineWrite<
  AppendPuzzleInteractionInput,
  void
>({
  name: 'chess.puzzle_interaction.append',
  parseInput: parseAppendPuzzleInteractionInput,
  authorize: async (ctx, input) => authorizeAppendPuzzleInteraction(ctx, input),
  execute: async (_ctx, input, sql) => {
    const id = crypto.randomUUID();
    const at = new Date().toISOString();
    await sql.run(
      `INSERT INTO ${CHESS_PUZZLE_INTERACTIONS_TABLE.tableName}
       (${ChessPuzzleInteractionCol.id}, ${ChessPuzzleInteractionCol.ownerId},
        ${ChessPuzzleInteractionCol.puzzleId}, ${ChessPuzzleInteractionCol.puzzleRating},
        ${ChessPuzzleInteractionCol.kind}, ${ChessPuzzleInteractionCol.solveIdx},
        ${ChessPuzzleInteractionCol.uci}, ${ChessPuzzleInteractionCol.correct},
        ${ChessPuzzleInteractionCol.ratingBefore}, ${ChessPuzzleInteractionCol.ratingAfter},
        ${ChessPuzzleInteractionCol.at})
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        input.ownerId,
        input.puzzleId,
        input.puzzleRating,
        input.kind,
        input.solveIdx,
        input.uci ?? null,
        input.correct === null || input.correct === undefined
          ? null
          : input.correct
            ? 1
            : 0,
        input.ratingBefore ?? 0,
        input.ratingAfter ?? 0,
        at,
      ]
    );
    return ok(undefined);
  },
});
