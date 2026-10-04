#!/usr/bin/env bun
// @io-wall-ok — one process tree and filesystem snapshot per local Check.
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import {
  publishCheckArtifacts,
  restoreCheckArtifacts,
} from './check-artifact-store';
import { createCheckSnapshot } from './check-snapshot';
import { killProcessTree } from './kill-process-tree';

export async function runLocalCheck(
  source: string,
  args: string[]
): Promise<number> {
  const started = process.hrtime.bigint();
  const root = await createCheckSnapshot(source);
  const store = join(source, '.cache/check-artifacts');
  const cache = join(root, '.turbo/cache');
  restoreCheckArtifacts(store, cache);
  console.log(
    `check:local: prepared snapshot in ${(Number(process.hrtime.bigint() - started) / 1e9).toFixed(1)}s`
  );
  console.log(`check:local: private run directory ${root}`);
  // Keep evidence in this directory after exit; never restore outputs into the caller.
  const temporary = join(dirname(root), 'tmp');
  mkdirSync(temporary, { recursive: true });
  const env = {
    ...process.env,
    TMPDIR: temporary,
    TMP: temporary,
    TEMP: temporary,
    PWD: root,
    INIT_CWD: root,
    TURBO_CACHE_DIR: join(root, '.turbo/cache'),
    MISE_TRUSTED_CONFIG_PATHS: [root, process.env['MISE_TRUSTED_CONFIG_PATHS']]
      .filter(Boolean)
      .join(':'),
  };
  const child = spawn(process.execPath, ['run', 'generate'], {
    cwd: root,
    stdio: 'inherit',
    env,
  });
  const generated = await new Promise<number>((resolve) => {
    child.on('error', () => resolve(1));
    child.on('exit', (code) => resolve(code ?? 1));
  });
  if (generated !== 0) return generated;
  const runner = spawn(
    process.execPath,
    ['run', 'libs/tools/scripts/turbo-ci-run.ts', 'check', ...args],
    {
      cwd: root,
      stdio: 'inherit',
      env,
    }
  );
  const terminate = () => {
    if (runner.pid !== undefined) killProcessTree(runner.pid, 'SIGTERM');
  };
  process.once('SIGINT', terminate);
  process.once('SIGTERM', terminate);
  const verdict = await new Promise<number>((resolve) => {
    runner.on('error', () => resolve(1));
    runner.on('exit', (code) => {
      process.removeListener('SIGINT', terminate);
      process.removeListener('SIGTERM', terminate);
      resolve(code ?? 1);
    });
  });
  if (verdict === 0) publishCheckArtifacts(cache, store);
  return verdict;
}

if (import.meta.main)
  process.exitCode = await runLocalCheck(
    join(import.meta.dirname, '../../..'),
    process.argv.slice(2)
  );
