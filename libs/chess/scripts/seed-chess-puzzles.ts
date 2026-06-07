import { ChessPuzzleSeeder } from '@libs/chess/server/seed-chess-puzzle/chess-puzzle-seeder';
import {
  formatPostgresStorageLimitError,
  isPostgresStorageLimitError,
} from '@libs/chess/server/seed-chess-puzzle/defer-indexes';
import { assert } from '@pkgs/assert';

await ChessPuzzleSeeder.fromArgv(process.argv.slice(2))
  .run()
  .catch((error: unknown) => {
    if (isPostgresStorageLimitError(error)) {
      assert.fail(formatPostgresStorageLimitError(), { error });
    }
    assert.fail('seed:puzzles failed', { error });
  });
