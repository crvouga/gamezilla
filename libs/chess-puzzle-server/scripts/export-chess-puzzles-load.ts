import { exportChessPuzzlesLoadFile } from '@libs/chess-puzzle-server/export-chess-puzzles-load';
import { assert } from '@pkgs/assert-shared/singleton';

await exportChessPuzzlesLoadFile(process.argv.slice(2)).catch(
  (error: unknown) => {
    assert.fail('export:puzzles-load failed', { error });
  }
);
