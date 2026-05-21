import { ChessPuzzleSeeder } from '@gamezilla/chess/server/seed-chess-puzzle/chess-puzzle-seeder';
import { assert } from '@gamezilla/assert';

await ChessPuzzleSeeder.fromArgv(process.argv.slice(2))
  .run()
  .catch((error: unknown) => assert.fail('seed:puzzles failed', { error }));
