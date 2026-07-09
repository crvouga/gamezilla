import type {
  WritePolicy,
  WritePolicyRegistry,
} from '@pkgs/sync-engine/server/upload-handler';
import { createWritePolicyRegistry } from '@pkgs/sync-engine/server/upload-handler';

import {
  CHESS_PUZZLE_INTERACTIONS_TABLE,
  CHESS_PUZZLE_LOAD_TABLE,
  CHESS_PUZZLE_PROFILES_TABLE,
  CHESS_PUZZLES_TABLE,
} from '../shared/sync-tables';

function readRowString(
  row: { readonly values?: Readonly<Record<string, unknown>> },
  column: string
): string | undefined {
  const raw = row.values?.[column];
  return typeof raw === 'string' ? raw : undefined;
}

function deny(reason: string): { readonly allowed: false; readonly reason: string } {
  return { allowed: false, reason };
}

export const chessPuzzlesWritePolicy: WritePolicy = () =>
  deny('chess_puzzles is system-only');

export const chessPuzzleLoadWritePolicy: WritePolicy = () =>
  deny('chess_puzzle_load is system-only');

export const chessPuzzleProfilesWritePolicy: WritePolicy = (ctx, row) => {
  const ownerId = readRowString(row, 'owner_id');
  if (ownerId !== undefined && ownerId !== ctx.myId) {
    return deny('owner_id mismatch');
  }
  if (row.id !== ctx.myId) {
    return deny('chess_puzzle_profile id mismatch');
  }
  return { allowed: true };
};

export const chessPuzzleInteractionsWritePolicy: WritePolicy = (ctx, row) => {
  const ownerId = readRowString(row, 'owner_id');
  if (ownerId !== undefined && ownerId !== ctx.myId) {
    return deny('owner_id mismatch');
  }
  return { allowed: true };
};

export const CHESS_WRITE_POLICIES: Readonly<Record<string, WritePolicy>> = {
  [CHESS_PUZZLES_TABLE.tableName]: chessPuzzlesWritePolicy,
  [CHESS_PUZZLE_LOAD_TABLE.tableName]: chessPuzzleLoadWritePolicy,
  [CHESS_PUZZLE_PROFILES_TABLE.tableName]: chessPuzzleProfilesWritePolicy,
  [CHESS_PUZZLE_INTERACTIONS_TABLE.tableName]: chessPuzzleInteractionsWritePolicy,
};

export function createChessWritePolicyRegistry(): WritePolicyRegistry {
  return createWritePolicyRegistry(CHESS_WRITE_POLICIES);
}
