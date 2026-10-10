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
import { enterDevOwner } from '@pkgs/os-server/dev-owner-entry';
import { superviseDev } from '@pkgs/os-server/dev-owner-supervisor';
import { bootLocalhostStack } from './boot-stack';
import { devStackOptions } from './dev-options';
import { removeManifest } from './manifest';

const REPO_ROOT = join(import.meta.dir, '../../..');
await enterDevOwner(REPO_ROOT, import.meta.filename, process.argv.slice(2));
if (!process.env['DEV_OWNER_SERVICES']) {
  process.exit(
    await superviseDev(REPO_ROOT, process.execPath, [import.meta.filename], {
      DEV_OWNER_SERVICES: '1',
    })
  );
}
const options = devStackOptions();
const stack = await bootLocalhostStack(options);

process.stdout.write(`\n[stack] ready — ${stack.manifestPath}\n`);
process.stdout.write(
  `[stack] simulator: ${stack.manifest.webOrigin}/?simulator\n`
);
process.stdout.write('[stack] Ctrl-C to stop\n');

let stopping = false;
const stop = (): void => {
  if (stopping) return;
  stopping = true;
  void stack.stop().then(() => process.exit(0));
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
process.on('SIGHUP', stop);
// A crash or a bare `process.exit` must not leave a manifest pointing at
// processes that are gone; the child teardown above is best-effort.
process.on('exit', () => {
  removeManifest(REPO_ROOT, options.instanceId);
});

await new Promise<void>(() => {
  // hold the process open
});
