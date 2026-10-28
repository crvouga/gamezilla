// @io-wall-ok
/**
 * §35 full-database validation job entry. See
 * `root/server/validate-chess-puzzles/chess-puzzle-validation-job.ts`.
 */
import { fileURLToPath } from 'node:url';
import {
  ChessPuzzleValidationJob,
  parsePuzzleValidationCli,
} from '@libs/chess-puzzle-server-ts/chess-puzzle-validation-job';
import { wallClock } from '@pkgs/clock-shared-ts/wall';
import { createGlobalHttpClient } from '@pkgs/http-client-shared-ts/global';
import { createLogger } from '@pkgs/logger-shared-ts/logger';
import { createNodeFsObjectStore } from '@pkgs/object-store-node-fs-server-ts/impl-node-fs';
import { createRepoTreeObjectStore } from '@pkgs/object-store-node-fs-server-ts/repo-tree-store';
import { wallNodeFs } from '@pkgs/object-store-node-fs-server-ts/wall-node-fs';

const fs = wallNodeFs();
const repoRoot = fileURLToPath(new URL('../../..', import.meta.url));

const summary = await new ChessPuzzleValidationJob(
  parsePuzzleValidationCli(process.argv.slice(2)),
  {
    clock: wallClock,
    http: createGlobalHttpClient(),
    log: createLogger({ name: 'chess:validate-puzzles', now: wallClock.now }),
  },
  {
    configStore: createRepoTreeObjectStore({ rootDir: repoRoot }),
    sourceStore: createNodeFsObjectStore({ rootDir: '/', fs, layout: 'tree' }),
    cacheStoreForDir: (cacheDir) =>
      createNodeFsObjectStore({ rootDir: cacheDir, fs, layout: 'tree' }),
  }
).run();

// Last stdout line: the machine-readable summary.
process.stdout.write(`${JSON.stringify(summary)}\n`);
if (summary.invalid > 0) process.exitCode = 1;
