#!/usr/bin/env bun

// @io-wall-ok — tools composition root.

/**
 * `bun run dev` — run one full localhost stack in the foreground.
 * `bun run stack` is the same command.
 *
 * Prints the manifest path; every consumer (tests, a browser, another agent)
 * reads addresses from there rather than assuming a port.
 */

import { join } from 'node:path';
import { bootLocalhostStack } from './boot-stack';
import { removeManifest } from './manifest';
import { parseStackOptions } from './stack-options';

const REPO_ROOT = join(import.meta.dir, '../../../..');
const options = parseStackOptions(process.argv.slice(2));
const stack = await bootLocalhostStack(options);

process.stdout.write(`\n[stack] ready — ${stack.manifestPath}\n`);
process.stdout.write(`${JSON.stringify(stack.manifest, null, 2)}\n`);
process.stdout.write('[stack] Ctrl-C to stop\n');

let stopping = false;
const stop = (): void => {
  if (stopping) return;
  stopping = true;
  void stack.stop().then(() => process.exit(0));
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
// A crash or a bare `process.exit` must not leave a manifest pointing at
// processes that are gone; the child teardown above is best-effort.
process.on('exit', () => {
  removeManifest(REPO_ROOT, options.instanceId);
});

await new Promise<void>(() => {
  // hold the process open
});
