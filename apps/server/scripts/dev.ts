// @io-wall-ok

import { type ChildProcess, spawn } from 'node:child_process';
import { join } from 'node:path';
import { wallTimers } from '@pkgs/clock';
import { killListenersOnPorts } from '@pkgs/os/kill-port';
import { DEFAULT_REPORT_SERVER_PORT } from '@pkgs/system-console/types';
import { migratePostgresApp } from '../src/db/migrate';
import {
  type LocalReportConsoleHandle,
  startLocalReportConsole,
} from './local-report-server';

/**
 * Foreground entry for `@apps/server dev`. Runs migrate → local report console
 * → wrangler under one Node process so turbo SIGINT/SIGTERM tear down the
 * whole tree instead of leaving a shell background job alive. Client config
 * materializes on the first non-health API request from Worker secrets.
 */

const API_DIR = join(import.meta.dirname, '..');
const API_PORT = 8788;
/** `0` = OS-assigned free port. Fixed 9229/9231 hit EADDRNOTAVAIL on some hosts. */
const INSPECTOR_PORT = 0;
/** Stale wrangler from a prior turbo tear-down still binds 8788 / old inspectors. */
const LEGACY_INSPECTOR_PORTS = [9231, 9229] as const;

killListenersOnPorts([
  API_PORT,
  DEFAULT_REPORT_SERVER_PORT,
  ...LEGACY_INSPECTOR_PORTS,
]);

const children: ChildProcess[] = [];
let reportConsole: LocalReportConsoleHandle | undefined;
let shuttingDown = false;

function killChild(child: ChildProcess, signal: NodeJS.Signals): void {
  if (child.exitCode !== null || child.killed) return;
  try {
    child.kill(signal);
  } catch {
    // process may have exited
  }
}

function killChildren(): void {
  for (const child of children) {
    killChild(child, 'SIGTERM');
  }
  wallTimers.setTimeout(() => {
    for (const child of children) {
      killChild(child, 'SIGKILL');
    }
  }, 2_000);
}

function shutdown(exitCode: number): void {
  if (shuttingDown) return;
  shuttingDown = true;
  reportConsole?.stop();
  killChildren();
  process.exit(exitCode);
}

for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP'] as const) {
  process.on(sig, () => {
    const codes: Record<string, number> = {
      SIGHUP: 129,
      SIGINT: 130,
      SIGTERM: 143,
    };
    shutdown(codes[sig] ?? 1);
  });
}

await migratePostgresApp({ wait: true });

reportConsole = await startLocalReportConsole();

const wrangler = spawn(
  'wrangler',
  [
    'dev',
    '--port',
    String(API_PORT),
    '--inspector-port',
    String(INSPECTOR_PORT),
  ],
  { cwd: API_DIR, stdio: 'inherit' }
);
children.push(wrangler);

const exitCode = await new Promise<number>((resolve) => {
  wrangler.on('exit', (code) => resolve(code ?? 1));
});

killChildren();
reportConsole?.stop();
process.exit(exitCode);
