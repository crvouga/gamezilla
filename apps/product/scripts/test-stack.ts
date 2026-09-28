#!/usr/bin/env bun

// @io-wall-ok — boots a localhost stack, runs the harness suite against it, tears down.

/**
 * The highest-fidelity product run available locally: every package's spec
 * suite, against one stack.
 *
 * Nothing is stubbed at the process boundary: real Postgres, real object
 * store, real broker, a real simulated Google on its own origin, N real API
 * instances behind a real round-robin balancer, and a real browser per actor.
 * Every port is OS-assigned, so several of these can run at once.
 */

import { join } from 'node:path';
import { runSpecSuites } from './spec-suites';
import { bootLocalhostStack } from './localhost-stack/boot-stack';
import { removeManifest } from './localhost-stack/manifest';
import { parseStackOptions } from './localhost-stack/stack-options';

const REPO_ROOT = join(import.meta.dir, '../../..');
const argv = process.argv.slice(2);
const testPaths = argv.filter((arg) => /\.test\.[cm]?[jt]sx?$/.test(arg));

// Tests drive live browsers: the web app must not hot-reload under them, and
// the scenarios read the app's test-only probes.
const options = parseStackOptions([...argv, '--frozen-web', '--test-hooks']);
const stack = await bootLocalhostStack(options);
process.stdout.write(`[stack] ${stack.manifestPath}\n`);

let code = 1;
try {
  code = runSpecSuites(
    {
      ...process.env,
      HARNESS_MODE: 'stack',
      HARNESS_WITH_DOM: '0',
      LOCALHOST_STACK_MANIFEST: stack.manifestPath,
    },
    testPaths
  );
} finally {
  await stack.stop();
  removeManifest(REPO_ROOT, options.instanceId);
}

process.exit(code);
