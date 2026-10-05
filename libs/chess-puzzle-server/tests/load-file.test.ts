import { expect, test } from 'bun:test';
import { join } from 'node:path';

import { resolveChessPuzzlesLoadFilePath } from '@libs/chess-puzzle-server/load-file';

// regression: deploy-chess-puzzle-load-file-missing
test('the deploy package contains its configured chess puzzle load file', async () => {
  const packageRoot = join(import.meta.dir, '..');
  const expectedPath = join(
    packageRoot,
    'scripts/fixtures/chess-puzzles.load.csv'
  );

  expect(resolveChessPuzzlesLoadFilePath()).toBe(expectedPath);
  expect(resolveChessPuzzlesLoadFilePath(packageRoot)).toBe(expectedPath);

  const csv = await Bun.file(expectedPath).text();
  expect(csv.startsWith('id,fen,moves,rating,rating_deviation,')).toBe(true);
  expect(csv.trimEnd().split('\n')).toHaveLength(2001);
});
