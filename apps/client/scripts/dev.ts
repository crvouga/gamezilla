// @io-wall-ok
/**
 * Foreground entry for `@apps/client` `dev`: Expo web only (product app).
 * Console + local reports live in `@product/console`.
 */

import { type ChildProcess, spawn } from 'node:child_process';
import { join } from 'node:path';
import { wallTimers } from '@pkgs/clock';
import { killListenersOnPorts } from '@pkgs/os/kill-port';

const CLIENT_DIR = join(import.meta.dirname, '..');
const EXPO_PORT = 5173;

killListenersOnPorts([EXPO_PORT]);

const children: ChildProcess[] = [];
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

const expo = spawn(
  'bunx',
  ['expo', 'start', '--web', '--port', String(EXPO_PORT)],
  {
    cwd: CLIENT_DIR,
    stdio: 'inherit',
    env: { ...process.env },
  }
);
children.push(expo);

expo.on('exit', (code) => {
  shutdown(code ?? 1);
});
