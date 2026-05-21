import { ChessPuzzleSeeder } from '@libs/chess/server/seed-chess-puzzle/chess-puzzle-seeder';
import { assert } from '@pkgs/assert';

await ChessPuzzleSeeder.fromArgv(process.argv.slice(2))
  .run()
  .catch((error: unknown) => assert.fail('seed:puzzles failed', { error }));
