import { ChessPuzzleSeeder } from '@libs/chess/server/seed-chess-puzzle/chess-puzzle-seeder';
import {
  formatPostgresStorageLimitError,
  isPostgresStorageLimitError,
} from '@libs/chess/server/seed-chess-puzzle/defer-indexes';
import { assert } from '@pkgs/assert';
import { wallIo } from '@pkgs/io';

const io = wallIo();

await ChessPuzzleSeeder.fromArgv(process.argv.slice(2), io)
  .run()
  .catch((error: unknown) => {
    if (isPostgresStorageLimitError(error)) {
      assert.fail(formatPostgresStorageLimitError(), { error });
    }
    assert.fail('seed:puzzles failed', { error });
  });
