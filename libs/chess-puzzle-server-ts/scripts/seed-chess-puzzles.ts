// @io-wall-ok
import { ChessPuzzleSeeder } from '@libs/chess-puzzle-server-ts/chess-puzzle-seeder';
import {
  formatPostgresStorageLimitError,
  isPostgresStorageLimitError,
} from '@libs/chess-puzzle-server-ts/defer-indexes';
import { assert } from '@pkgs/assert-root-shared-ts/singleton';
import { wallClock, wallTimers } from '@pkgs/clock-shared-ts/wall';
import { createGlobalHttpClient } from '@pkgs/http-client-shared-ts/global';
import { createNodeFsObjectStore } from '@pkgs/object-store-node-fs-server-ts/impl-node-fs';
import { createRepoTreeObjectStore } from '@pkgs/object-store-node-fs-server-ts/repo-tree-store';
import { wallNodeFs } from '@pkgs/object-store-node-fs-server-ts/wall-node-fs';

const fs = wallNodeFs();
const repoRoot = new URL('../../..', import.meta.url).pathname;

await ChessPuzzleSeeder.fromArgv(
  process.argv.slice(2),
  {
    clock: wallClock,
    timers: wallTimers,
    createId: () => crypto.randomUUID(),
    http: createGlobalHttpClient(),
  },
  {
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
  }
)
  .run()
  .catch((error: unknown) => {
    if (isPostgresStorageLimitError(error)) {
      assert.fail(formatPostgresStorageLimitError(), { error });
    }
    assert.fail('seed:puzzles failed', { error });
  });
