import { join } from 'node:path';

import { CHESS_PUZZLES_LOAD_FILE_RELATIVE } from './load-file-constants';

/** `@libs/chess-puzzle-server-ts` package root when resolved from this module. */
export function chessPackageRootFromLoadFileModule(): string {
  return join(import.meta.dirname, '..');
}

export function resolveChessPuzzlesLoadFilePath(
  packageRoot: string = chessPackageRootFromLoadFileModule()
): string {
  return join(packageRoot, CHESS_PUZZLES_LOAD_FILE_RELATIVE);
}
