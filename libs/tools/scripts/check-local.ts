#!/usr/bin/env bun
// @io-wall-ok — one process tree and filesystem snapshot per local Check.
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import {
  publishCheckArtifacts,
  restoreCheckArtifacts,
} from './check-artifact-store';
import { readLatestRunSummary } from './check-budget';
import { localCheckArgs } from './check-profile';
import { createCheckSnapshot } from './check-snapshot';
import { archiveCheckSnapshot } from './check-snapshot-archive';
import { killProcessTree } from './kill-process-tree';
import { localCheckLeasePath, openLocalCheckLease } from './local-check-lease';
import {
  launchLocalCheck,
  watchLocalCheckCancellation,
} from './local-check-process';
import { localCheckEnv, withLocalCheckSlot } from './local-check-queue';

export async function runLocalCheck(
  source: string,
  args: string[],
  signal: AbortSignal
): Promise<number> {
  return withLocalCheckSlot(() => runIsolatedCheck(source, args, signal), {
    openLease: () => openLocalCheckLease(localCheckLeasePath()),
    sleep: (signal) => sleep(1000, undefined, { signal }),
    signal,
    queued: () => console.log('check: queued behind another local check'),
  });
}

async function runIsolatedCheck(
  source: string,
  args: string[],
  signal: AbortSignal
): Promise<number> {
  console.log('check: acquired machine-wide slot');
  const started = process.hrtime.bigint();
  const root = await createCheckSnapshot(source);
  console.log(
    `check: prepared snapshot in ${(Number(process.hrtime.bigint() - started) / 1e9).toFixed(1)}s`
  );
  console.log(`check: private run directory ${root}`);
  try {
    return await runSnapshot(root, source, args, signal);
  } finally {
    const archive = await archiveCheckSnapshot(root);
    console.log(`check: diagnostics archived at ${archive}`);
  }
}

async function runSnapshot(
  root: string,
  source: string,
  args: string[],
  signal: AbortSignal
): Promise<number> {
  const store = join(source, '.cache/check-artifacts');
  const cache = join(root, '.turbo/cache');
  restoreCheckArtifacts(store, cache);
  // Never restore outputs into the caller; archive evidence after the runner exits.
  const temporary = join(dirname(root), 'tmp');
  mkdirSync(temporary, { recursive: true });
  const env = {
    ...localCheckEnv(process.env),
    TMPDIR: temporary,
    TMP: temporary,
    TEMP: temporary,
    PWD: root,
    INIT_CWD: root,
    TURBO_CACHE_DIR: join(root, '.turbo/cache'),
    // Started from a task (`bun fc`), this check's own runs stream into its pane.
    ...(process.env['TURBO_HASH'] === undefined ? {} : { TURBO_UI: 'false' }),
    MISE_TRUSTED_CONFIG_PATHS: [root, process.env['MISE_TRUSTED_CONFIG_PATHS']]
      .filter(Boolean)
      .join(':'),
  };
  const generated = await runCheckChild(root, ['run', 'generate'], env, signal);
  if (generated !== 0) return generated;
  const verdict = await runCheckChild(
    root,
    ['run', 'libs/tools/scripts/turbo-ci-run.ts', ...localCheckArgs(args)],
    env,
    signal
  );
  publishCheckArtifacts(cache, store, readLatestRunSummary(root));
  return verdict;
}

async function runCheckChild(
  root: string,
  args: string[],
  env: NodeJS.ProcessEnv,
  signal: AbortSignal
): Promise<number> {
  signal.throwIfAborted();
  const child = spawn(process.execPath, args, {
    cwd: root,
    stdio: 'inherit',
    env,
  });
  const terminate = () => {
    if (child.pid !== undefined) killProcessTree(child.pid, 'SIGKILL');
  };
  signal.addEventListener('abort', terminate, { once: true });
  if (signal.aborted) terminate();
  return new Promise((resolve) => {
    const finish = (code: number) => {
      signal.removeEventListener('abort', terminate);
      resolve(signal.aborted ? 130 : code);
    };
    child.once('error', () => finish(1));
    child.once('close', (code) => finish(code ?? 1));
  });
}

async function workerMain(): Promise<number> {
  const controller = new AbortController();
  const unwatch = watchLocalCheckCancellation(controller, process);
  const cancel = () => controller.abort();
  for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP'] as const)
    process.on(signal, cancel);
  if (!process.connected) cancel();
  try {
    return await runLocalCheck(
      join(import.meta.dirname, '../../..'),
      process.argv.slice(2),
      controller.signal
    );
  } catch (error) {
    if (controller.signal.aborted) return 130;
    throw error;
  } finally {
    unwatch();
    for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP'] as const)
      process.off(signal, cancel);
    if (process.connected) process.disconnect();
  }
}

if (import.meta.main)
  process.exitCode =
    process.send === undefined
      ? await launchLocalCheck(process.argv.slice(2))
      : await workerMain();
