#!/usr/bin/env bun
// @io-wall-ok — one process tree and filesystem snapshot per local Verify.
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { killProcessTree } from './kill-process-tree';
import {
  localVerifyLeasePath,
  openLocalVerifyLease,
} from './local-verify-lease';
import {
  launchLocalVerify,
  watchLocalVerifyCancellation,
} from './local-verify-process';
import { localVerifyEnv, withLocalVerifySlot } from './local-verify-queue';
import {
  publishVerifyArtifacts,
  restoreVerifyArtifacts,
} from './verify-artifact-store';
import { readLatestRunSummary } from './verify-budget';
import { localVerifyArgs } from './verify-profile';
import { createVerifySnapshot } from './verify-snapshot';
import { archiveVerifySnapshot } from './verify-snapshot-archive';

export async function runLocalVerify(
  source: string,
  args: string[],
  signal: AbortSignal
): Promise<number> {
  return withLocalVerifySlot(() => runIsolatedVerify(source, args, signal), {
    openLease: () => openLocalVerifyLease(localVerifyLeasePath()),
    sleep: (signal) => sleep(1000, undefined, { signal }),
    signal,
    queued: () =>
      console.log('verify: queued behind another local verification'),
  });
}

async function runIsolatedVerify(
  source: string,
  args: string[],
  signal: AbortSignal
): Promise<number> {
  console.log('verify: acquired machine-wide slot');
  const started = process.hrtime.bigint();
  const root = await createVerifySnapshot(source);
  console.log(
    `verify: prepared snapshot in ${(Number(process.hrtime.bigint() - started) / 1e9).toFixed(1)}s`
  );
  console.log(`verify: private run directory ${root}`);
  try {
    return await runSnapshot(root, source, args, signal);
  } finally {
    const archive = await archiveVerifySnapshot(root);
    console.log(`verify: diagnostics archived at ${archive}`);
  }
}

async function runSnapshot(
  root: string,
  source: string,
  args: string[],
  signal: AbortSignal
): Promise<number> {
  const store = join(source, '.cache/verify-artifacts');
  const cache = join(root, '.turbo/cache');
  restoreVerifyArtifacts(store, cache);
  // Never restore outputs into the caller; archive evidence after the runner exits.
  const temporary = join(dirname(root), 'tmp');
  mkdirSync(temporary, { recursive: true });
  const env = {
    ...localVerifyEnv(process.env),
    TMPDIR: temporary,
    TMP: temporary,
    TEMP: temporary,
    PWD: root,
    INIT_CWD: root,
    TURBO_CACHE_DIR: join(root, '.turbo/cache'),
    // Started from a task (`bun fc`), this verification's own runs stream into its pane.
    ...(process.env['TURBO_HASH'] === undefined ? {} : { TURBO_UI: 'false' }),
    MISE_TRUSTED_CONFIG_PATHS: [root, process.env['MISE_TRUSTED_CONFIG_PATHS']]
      .filter(Boolean)
      .join(':'),
  };
  const generated = await runVerifyChild(
    root,
    ['run', 'generate'],
    env,
    signal
  );
  if (generated !== 0) return generated;
  const verdict = await runVerifyChild(
    root,
    ['run', 'libs/tools/scripts/turbo-ci-run.ts', ...localVerifyArgs(args)],
    env,
    signal
  );
  publishVerifyArtifacts(cache, store, readLatestRunSummary(root));
  return verdict;
}

async function runVerifyChild(
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
  const unwatch = watchLocalVerifyCancellation(controller, process);
  const cancel = () => controller.abort();
  for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP'] as const)
    process.on(signal, cancel);
  if (!process.connected) cancel();
  try {
    return await runLocalVerify(
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
      ? await launchLocalVerify(process.argv.slice(2))
      : await workerMain();
