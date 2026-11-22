// @io-wall-ok — development process entry.

/**
 * `bun run dev` — one full localhost stack in the foreground. `bun run stack`
 * is the same command.
 *
 * The stack is a Turborepo run: `@apps/product-ts#dev` and, alongside it, one
 * persistent task per service (turbo.json). This launcher makes that run the
 * checkout's one supervised boot, hands every task the stack's options, sends
 * every task's output to one log file, and prints only where to look: the
 * app, Storybook and that log.
 */

import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { enterDevOwner } from '@pkgs/dev-owner-server-ts/dev-owner-entry';
import { superviseDev } from '@pkgs/dev-owner-server-ts/dev-owner-supervisor';
import { appLink, devLine, devLogPath, storybookLink } from './dev-links';
import { resolveDevRepoRoot } from './dev-repo-root';
import { manifestPath } from './manifest';
import { parseStackOptions } from './stack-options';
import { stackRootDir } from './stack-plan-file';

/** Persistent tasks each hold a slot; this leaves room for all of them. */
const TASK_SLOTS = 32;
const INSTANCE = 'dev';
const LINK_POLL_MS = 250;

const args = process.argv.slice(2).filter((arg) => arg !== '--');
parseStackOptions(args);
const repoRoot = resolveDevRepoRoot(import.meta.dir, existsSync);
await enterDevOwner(repoRoot, import.meta.filename, args);

function record<T>(path: string): T | null {
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as T;
  } catch {
    // Not published yet, or mid-write.
    return null;
  }
}

function alive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/** Only a boot started by this launch counts, unless a live one is reused. */
let sinceMs = Date.now();
const pending = new Map<string, () => string | null>([
  ['App', () => appLink(record(manifestPath(repoRoot, INSTANCE)), sinceMs)],
  [
    'Storybook',
    () =>
      storybookLink(
        record(
          join(repoRoot, 'pkgs/ui-root-harness-ts/.cache/storybook-dev.json')
        ),
        alive
      ),
  ],
]);
function announce(): void {
  for (const [label, link] of pending) {
    const url = link();
    if (url === null) continue;
    pending.delete(label);
    process.stdout.write(devLine(label, url));
  }
}

mkdirSync(stackRootDir(repoRoot), { recursive: true });
const logPath = devLogPath(stackRootDir(repoRoot));
process.stdout.write(devLine('Logs', logPath));
const poll = setInterval(announce, LINK_POLL_MS);
const code = await superviseDev(
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
    // Every task's output, prefixed with its name, goes to the one log.
    '--ui=stream',
    '--log-prefix=task',
  ],
  {
    env: {
      DEV_OWNER_PORTS: '1',
      LOCALHOST_STACK_ARGS: JSON.stringify([...args, '--instance', INSTANCE]),
    },
    logPath,
    onReuse: () => {
      sinceMs = 0;
      announce();
    },
  }
);
clearInterval(poll);
if (code !== 0) process.stderr.write(`Stack stopped (exit ${String(code)})\n`);
process.exit(code);
