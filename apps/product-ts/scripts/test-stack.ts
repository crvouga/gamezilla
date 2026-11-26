#!/usr/bin/env bun

// @io-wall-ok — boots a localhost stack, runs the harness suite against it, tears down.

/**
 * The highest-fidelity product run available locally: every package's spec
 * suite, against one stack.
 *
 * Nothing is stubbed at the process boundary: Mockingbird Postgres, real object
 * store, real broker, a real simulated Google on its own origin, N real API
 * instances behind a real round-robin balancer, and a real browser per actor.
 * Every port is OS-assigned, so several of these can run at once.
 */

import { join } from 'node:path';
import { bootLocalhostStack } from './boot-stack';
import { removeManifest } from './manifest';
import { runSpecSuites } from './spec-suites';
import { parseStackOptions } from './stack-options';
import {
  announcePartition,
  planPartition,
  runStackShard,
} from './stack-shard-run';
import { stackSuiteArgs } from './stack-suite-args';

const REPO_ROOT = join(import.meta.dir, '../../..');
const args = stackSuiteArgs(process.argv.slice(2));
// Verify Nightly runs one partition of the suite per runner
// (`stack-shards.ts`); named specs are a focused run of their own.
const planned = args.suite.length > 0 ? null : planPartition(process.env);
if (planned !== null) announcePartition(planned, process.env);
if (planned?.runs.length === 0) process.exit(0);

// Tests drive live browsers: the web app must not hot-reload under them, and
// the scenarios read the app's test-only probes.
const options = parseStackOptions([
  ...args.stack,
  '--frozen-web',
  '--test-hooks',
]);
const stack = await bootLocalhostStack(options, false, 'isolated');
process.stdout.write(`[stack] ${stack.manifestPath}\n`);

let code = 1;
try {
  const env = {
    ...process.env,
    HARNESS_MODE: 'stack',
    HARNESS_WITH_DOM: '0',
    LOCALHOST_STACK_MANIFEST: stack.manifestPath,
  };
  code =
    planned === null
      ? await runSpecSuites(env, args.suite)
      : await runStackShard(env, planned);
} finally {
  await stack.stop();
  removeManifest(REPO_ROOT, options.instanceId);
}

process.exit(code);
