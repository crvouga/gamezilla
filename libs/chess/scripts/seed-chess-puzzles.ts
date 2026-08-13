// @io-wall-ok
import { ChessPuzzleSeeder } from '@libs/chess/server/seed-chess-puzzle/chess-puzzle-seeder';
import {
  formatPostgresStorageLimitError,
  isPostgresStorageLimitError,
} from '@libs/chess/server/seed-chess-puzzle/defer-indexes';
import { assert } from '@pkgs/assert';
import { wallIo } from '@pkgs/io';
import { createNodeFsObjectStore } from '@pkgs/object-store/impl-node-fs';
import { createRepoTreeObjectStore } from '@pkgs/object-store/repo-tree-store';
import { wallNodeFs } from '@pkgs/object-store/wall-node-fs';

const io = wallIo();
const fs = wallNodeFs();
const repoRoot = new URL('../../..', import.meta.url).pathname;

await ChessPuzzleSeeder.fromArgv(process.argv.slice(2), io, {
  configStore: createRepoTreeObjectStore({ rootDir: repoRoot }),
  sourceStore: createNodeFsObjectStore({
    rootDir: '/',
    fs,
    layout: 'tree',
  }),
  cacheStoreForDir: (cacheDir) =>
    createNodeFsObjectStore({
      rootDir: cacheDir,
      fs,
      layout: 'tree',
    }),
})
  .run()
  .catch((error: unknown) => {
    if (isPostgresStorageLimitError(error)) {
      assert.fail(formatPostgresStorageLimitError(), { error });
    }
    assert.fail('seed:puzzles failed', { error });
  });
