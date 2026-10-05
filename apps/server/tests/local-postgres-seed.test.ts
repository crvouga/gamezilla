import { expect, test } from 'bun:test';
import { join } from 'node:path';

import { localChessPuzzleLoadFileRoot } from '@apps/server/scripts/run-local-postgres-seed';
import { resolveChessPuzzlesLoadFilePath } from '@libs/chess-puzzle-server/load-file';

// regression: bun-dev-chess-puzzle-load-file-root
test('the local stack seeds from the chess puzzle server load file', async () => {
  const expectedRoot = join(
    import.meta.dir,
    '../../../libs/chess-puzzle-server'
  );
  const root = localChessPuzzleLoadFileRoot();

  expect(root).toBe(expectedRoot);
  expect(await Bun.file(resolveChessPuzzlesLoadFilePath(root)).exists()).toBe(
    true
  );
});
