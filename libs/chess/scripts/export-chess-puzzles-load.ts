import { exportChessPuzzlesLoadFile } from '@libs/chess/server/seed-chess-puzzle/export-chess-puzzles-load';
import { assert } from '@pkgs/assert';

await exportChessPuzzlesLoadFile(process.argv.slice(2)).catch(
  (error: unknown) => {
    assert.fail('export:puzzles-load failed', { error });
  }
);
