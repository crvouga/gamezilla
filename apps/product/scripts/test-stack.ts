#!/usr/bin/env bun

// @io-wall-ok — boots a localhost stack, runs the sim suite against it, tears down.

/**
 * The highest-fidelity product run available locally.
 *
 * Nothing is stubbed at the process boundary: real Postgres, real object
 * store, real broker, a real simulated Google on its own origin, N real API
 * instances behind a real round-robin balancer, and a real browser per actor.
 * Every port is OS-assigned, so several of these can run at once.
 */

import { join } from 'node:path';
import { bootLocalhostStack } from '../../../tools/scripts/localhost-stack/boot-stack';
import { removeManifest } from '../../../tools/scripts/localhost-stack/manifest';
import { parseStackOptions } from '../../../tools/scripts/localhost-stack/stack-options';

const REPO_ROOT = join(import.meta.dir, '../../..');
const argv = process.argv.slice(2);
const testPaths = argv.filter((arg) => !arg.startsWith('--'));

const options = parseStackOptions(argv);
const stack = await bootLocalhostStack(options);
process.stdout.write(`[stack] ${stack.manifestPath}\n`);

let code = 1;
try {
  const test = Bun.spawn(
    [
      'bun',
      'test',
      '--preload',
      './bun-babel-plugin.ts',
      '--preload',
      './bun-preload.ts',
      '--timeout',
      '180000',
      ...(testPaths.length > 0 ? testPaths : ['tests']),
    ],
    {
      cwd: join(import.meta.dir, '..'),
      stdout: 'inherit',
      stderr: 'inherit',
      env: {
        ...process.env,
        SIM_MODE: 'stack',
        SIM_WITH_DOM: '0',
        LOCALHOST_STACK_MANIFEST: stack.manifestPath,
      },
    }
  );
  code = (await test.exited) ?? 1;
} finally {
  await stack.stop();
  removeManifest(REPO_ROOT, options.instanceId);
}

process.exit(code);
