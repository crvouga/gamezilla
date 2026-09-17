#!/usr/bin/env bun

// @io-wall-ok — tools composition root.

/**
 * `bun run stack` — run one full localhost stack in the foreground.
 *
 * Prints the manifest path; every consumer (tests, a browser, another agent)
 * reads addresses from there rather than assuming a port.
 */

import { join } from 'node:path';
import { bootLocalhostStack } from './boot-stack';
import { removeManifest } from './manifest';
import { parseStackOptions } from './stack-options';

const options = parseStackOptions(process.argv.slice(2));
const stack = await bootLocalhostStack(options);

process.stdout.write(`\n[stack] ready — ${stack.manifestPath}\n`);
process.stdout.write(`${JSON.stringify(stack.manifest, null, 2)}\n`);
process.stdout.write('[stack] Ctrl-C to stop\n');

let stopping = false;
const stop = (): void => {
  if (stopping) return;
  stopping = true;
  void stack.stop().then(() => {
    removeManifest(join(import.meta.dir, '../../..'), options.instanceId);
    process.exit(0);
  });
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);

await new Promise<void>(() => {
  // hold the process open
});
