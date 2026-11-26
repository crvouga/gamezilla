// @io-wall-ok — development process entry.

/**
 * `bun run dev` — one full localhost stack in the foreground. `bun run stack`
 * is the same command.
 *
 * The stack is a Turborepo run: `@apps/product-ts#dev` and, alongside it, one
 * persistent task per service (turbo.json). This launcher makes that run the
 * checkout's one supervised boot, hands every task the stack's options, sends
 * every task's output to one log file, and prints only where to look: the
 * product app, Storybook and that log.
 */

import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { enterDevOwner } from '@pkgs/dev-owner-server-ts/dev-owner-entry';
import { superviseDev } from '@pkgs/dev-owner-server-ts/dev-owner-supervisor';
import { appLink, devLogPath, devStatusLine, storybookLink } from './dev-links';
import { resolveDevRepoRoot } from './dev-repo-root';
import { manifestPath } from './manifest';
import { parseStackOptions } from './stack-options';
import { stackRootDir } from './stack-plan-file';

/** Persistent tasks each hold a slot; this leaves room for all of them. */
const TASK_SLOTS = 32;
const INSTANCE = 'dev';
const LINK_POLL_MS = 250;

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

const repoRoot = resolveDevRepoRoot(import.meta.dir, existsSync);
mkdirSync(stackRootDir(repoRoot), { recursive: true });
const logPath = devLogPath(stackRootDir(repoRoot));
const terminal = Boolean(process.stdout.isTTY);
let previous = '';
let product: string | null = null;
let storybook: string | null = null;

function show(status: string): void {
  const line = devStatusLine({ status, logPath, product, storybook, terminal });
  if (line === previous) return;
  previous = line;
  process.stdout.write(terminal ? `\r\x1b[2K${line}` : `${line}\n`);
}

async function run(): Promise<number> {
  const args = process.argv.slice(2).filter((arg) => arg !== '--');
  const options = parseStackOptions(args);
  await enterDevOwner(repoRoot, import.meta.filename, args);
  // Ignore a previous boot's manifest unless the supervisor reuses that boot.
  let sinceMs = Date.now();
  let ready = false;
  function announce(reused = false): void {
    if (ready) return;
    const manifest = record<{ webOrigin: string | null; startedAtMs: number }>(
      manifestPath(repoRoot, INSTANCE)
    );
    product = appLink(manifest, sinceMs);
    storybook = storybookLink(
      record(
        join(repoRoot, 'pkgs/ui-root-harness-ts/.cache/storybook-dev.json')
      ),
      alive
    );
    ready = Boolean(
      storybook &&
        manifest &&
        manifest.startedAtMs >= sinceMs &&
        (product || !options.withWeb)
    );
    if (terminal || ready || reused) show(ready ? 'Ready' : 'Starting');
  }
  if (terminal) show('Starting');
  const poll = setInterval(announce, LINK_POLL_MS);
  try {
    return await superviseDev(
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
          LOCALHOST_STACK_ARGS: JSON.stringify([
            ...args,
            '--instance',
            INSTANCE,
          ]),
        },
        logPath,
        appendLog: process.env['WORKSPACE_LAUNCH_LOG'] === logPath,
        onReuse: () => {
          sinceMs = 0;
          announce(true);
        },
      }
    );
  } finally {
    clearInterval(poll);
  }
}

try {
  process.exitCode = await run();
} catch (error) {
  appendFileSync(
    logPath,
    `${error instanceof Error ? error.stack : String(error)}\n`
  );
  process.exitCode = 1;
}
if (process.exitCode) {
  product = null;
  storybook = null;
  show(`Failed (${String(process.exitCode)})`);
}
if (terminal) process.stdout.write('\n');
