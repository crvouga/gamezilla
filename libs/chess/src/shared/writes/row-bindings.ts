import {
  CHESS_PUZZLE_INTERACTIONS_TABLE,
  CHESS_PUZZLE_LOAD_TABLE,
  CHESS_PUZZLE_PROFILES_TABLE,
  CHESS_PUZZLES_TABLE,
} from '@libs/db/shared/chess-tables';
import {
  createRowWriteBinding,
  defineDenyRowWrite,
  type RowWriteBinding,
} from '@pkgs/write/server/row-write-registry';
import type { RowChange } from '@pkgs/write/shared/row-change';

import {
  appendPuzzleInteractionWrite,
  rowToAppendPuzzleInteractionInput,
} from './append-puzzle-interaction-write';
import {
  rowToUpsertPuzzleProfileInput,
  upsertPuzzleProfileWrite,
} from './upsert-puzzle-profile-write';

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
    upsertPuzzleProfileWrite,
    rowToUpsertPuzzleProfileInput
  ) as unknown as RowWriteBinding<RowChange>,
  [CHESS_PUZZLE_INTERACTIONS_TABLE.tableName]: createRowWriteBinding(
    appendPuzzleInteractionWrite,
    rowToAppendPuzzleInteractionInput
  ) as unknown as RowWriteBinding<RowChange>,
};
