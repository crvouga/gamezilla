// @io-wall-ok — development process entry.

/**
 * `bun run dev` — one full localhost stack in the foreground. `bun run stack`
 * is the same command.
 *
 * The stack is a Turborepo run: `@apps/product-ts#dev` and, alongside it, one
 * persistent task per service (turbo.json), each with its own pane in the
 * terminal UI. This launcher only makes that run the checkout's one
 * supervised boot and hands every task the stack's options.
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { enterDevOwner } from '@pkgs/os-server-ts/dev-owner-entry';
import { superviseDev } from '@pkgs/os-server-ts/dev-owner-supervisor';
import { resolveDevRepoRoot } from './dev-repo-root';
import { parseStackOptions } from './stack-options';

/** Persistent tasks each hold a slot; this leaves room for all of them. */
const TASK_SLOTS = 32;

const args = process.argv.slice(2).filter((arg) => arg !== '--');
parseStackOptions(args);
const repoRoot = resolveDevRepoRoot(import.meta.dir, existsSync);
await enterDevOwner(repoRoot, import.meta.filename, args);
process.exit(
  await superviseDev(
    repoRoot,
    join(repoRoot, 'node_modules/.bin/turbo'),
    [
      'run',
      '@apps/product-ts#dev',
      // A failed service must release the boot; a partial stack is not reusable.
      '--continue=never',
      // Tasks see the developer's own environment, as the stack always has.
      '--env-mode=loose',
      `--concurrency=${String(TASK_SLOTS)}`,
    ],
    {
      DEV_OWNER_PORTS: '1',
      LOCALHOST_STACK_ARGS: JSON.stringify([...args, '--instance', 'dev']),
    }
  )
);
