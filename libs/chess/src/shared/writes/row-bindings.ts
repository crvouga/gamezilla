import {
  CHESS_PUZZLE_INTERACTIONS_TABLE,
  CHESS_PUZZLE_LOAD_TABLE,
  CHESS_PUZZLE_PROFILES_TABLE,
  CHESS_PUZZLES_TABLE,
} from '@libs/db/shared/chess-tables';
import { ok } from '@pkgs/write/shared/write-result';
import {
  createRowWriteBinding,
  defineDenyRowWrite,
  defineRowAuthorizeWrite,
  type RowWriteBinding,
} from '@pkgs/write/server/row-write-registry';
import {
  idMatches,
  ownerMatches,
  readRowString,
} from '@pkgs/write/shared/read-row-values';
import type { RowChange } from '@pkgs/write/shared/row-change';

const chessPuzzleProfilesRowWrite = defineRowAuthorizeWrite({
  name: 'chess.puzzle_profile.patch',
  authorize: async (ctx, row) => {
    const ownerId = readRowString(row, 'owner_id');
    const ownerError = ownerMatches(ownerId, ctx.myId, 'CHESS_OWNER_MISMATCH');
    if (ownerError !== null) return ownerError;
    return (
      idMatches(row.id, ctx.myId, 'CHESS_PROFILE_ID_MISMATCH') ?? ok(undefined)
    );
  },
});

const chessPuzzleInteractionsRowWrite = defineRowAuthorizeWrite({
  name: 'chess.puzzle_interaction.patch',
  authorize: async (ctx, row) => {
    const ownerId = readRowString(row, 'owner_id');
    return (
      ownerMatches(ownerId, ctx.myId, 'CHESS_OWNER_MISMATCH') ?? ok(undefined)
    );
  },
});

export const CHESS_ROW_BINDINGS: Readonly<
  Record<string, RowWriteBinding<RowChange>>
> = {
  [CHESS_PUZZLES_TABLE.tableName]: createRowWriteBinding(
    defineDenyRowWrite('CHESS_PUZZLES_SYSTEM_ONLY')
  ),
  [CHESS_PUZZLE_LOAD_TABLE.tableName]: createRowWriteBinding(
    defineDenyRowWrite('CHESS_PUZZLE_LOAD_SYSTEM_ONLY')
  ),
  [CHESS_PUZZLE_PROFILES_TABLE.tableName]: createRowWriteBinding(
    chessPuzzleProfilesRowWrite
  ),
  [CHESS_PUZZLE_INTERACTIONS_TABLE.tableName]: createRowWriteBinding(
    chessPuzzleInteractionsRowWrite
  ),
};
