// @io-wall-ok
/**
 * Foreground entry for `@product/console` `dev`: Expo (web + iOS/Android Expo Go).
 *
 * Press `i` or Shift+I to open the project iPad in Expo Go — bypasses Expo's
 * default "first booted simulator" picker so other projects' sims never win.
 */

import { type ChildProcess, spawn } from 'node:child_process';
import { join } from 'node:path';
import { wallTimers } from '@pkgs/clock';
import { killListenersOnPorts } from '@pkgs/os/kill-port';
import { SIM_PROJECT_SLUG } from '../../../tools/scripts/sims/sim-project';
import { openExpoGoOnProjectSim } from './open-expo-go-ios';

const APP_DIR = join(import.meta.dirname, '..');
const EXPO_PORT = 5173;

killListenersOnPorts([EXPO_PORT]);

const children: ChildProcess[] = [];
let shuttingDown = false;
let iosOpenInFlight = false;

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

function isOpenIosKey(buf: Buffer): boolean {
  if (buf.length === 1) {
    const code = buf[0]!;
    // Lowercase i (Expo "open iOS") and uppercase I (Expo Shift+I picker).
    return code === 0x69 || code === 0x49;
  }
  return false;
}

async function handleOpenIos(): Promise<void> {
  if (iosOpenInFlight) return;
  iosOpenInFlight = true;
  try {
    await openExpoGoOnProjectSim('ipad', EXPO_PORT);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`[dev] ${msg}\n`);
  } finally {
    iosOpenInFlight = false;
  }
}

function wireStdinIntercept(expo: ChildProcess): void {
  if (!process.stdin.isTTY || expo.stdin === null) {
    return;
  }

  process.stderr.write(
    `[dev] i / shift+i → ${SIM_PROJECT_SLUG} iPad (Expo Go)\n`
  );

  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.on('data', (buf: Buffer) => {
    if (isOpenIosKey(buf)) {
      void handleOpenIos();
      return;
    }
    expo.stdin?.write(buf);
  });
}

const expo = spawn('bunx', ['expo', 'start', '--port', String(EXPO_PORT)], {
  cwd: APP_DIR,
  stdio: ['pipe', 'inherit', 'inherit'],
  env: { ...process.env },
});
children.push(expo);
wireStdinIntercept(expo);

expo.on('exit', (code) => {
  shutdown(code ?? 1);
});
