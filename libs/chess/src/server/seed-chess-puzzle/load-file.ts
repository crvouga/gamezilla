import { join } from 'node:path';

import { CHESS_PUZZLES_LOAD_FILE_RELATIVE } from './load-file-constants';

export {
  CHESS_PUZZLES_LOAD_CSV_COLUMNS,
  CHESS_PUZZLES_LOAD_EXPORT_LIMIT,
  CHESS_PUZZLES_LOAD_EXPORT_SQL,
  CHESS_PUZZLES_LOAD_FILE_RELATIVE,
  type ChessPuzzlesLoadCsvColumn,
} from './load-file-constants';

/** `@libs/chess` package root when resolved from this module (Node only). */
export function chessPackageRootFromLoadFileModule(): string {
  return join(import.meta.dirname, '../../..');
}

export function resolveChessPuzzlesLoadFilePath(
  packageRoot: string = chessPackageRootFromLoadFileModule()
): string {
  return join(packageRoot, CHESS_PUZZLES_LOAD_FILE_RELATIVE);
}
