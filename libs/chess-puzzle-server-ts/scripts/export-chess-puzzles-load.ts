import { exportChessPuzzlesLoadFile } from '@libs/chess-puzzle-server-ts/export-chess-puzzles-load';
import { assert } from '@pkgs/assert-root-shared-ts/singleton';

await exportChessPuzzlesLoadFile(process.argv.slice(2)).catch(
  (error: unknown) => {
    assert.fail('export:puzzles-load failed', { error });
  }
);
