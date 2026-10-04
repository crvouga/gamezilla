import { join } from 'node:path';

import { CHESS_PUZZLES_LOAD_FILE_RELATIVE } from './load-file-constants';

/** `@libs/chess` package root when resolved from this module (Node only). */
export function chessPackageRootFromLoadFileModule(): string {
  return join(import.meta.dirname, '../../chess-puzzle-client/src');
}

export function resolveChessPuzzlesLoadFilePath(
  packageRoot: string = chessPackageRootFromLoadFileModule()
): string {
  return join(packageRoot, CHESS_PUZZLES_LOAD_FILE_RELATIVE);
}
