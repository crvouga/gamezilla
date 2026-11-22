// @io-wall-ok
/**
 * Poll `/api/health` until ready (used by CI after starting `serve:api`).
 * Optional `API_PID` / `API_LOG` fail fast if the process dies.
 */

import { existsSync, readFileSync } from 'node:fs';
import { wallClock, wallTimers } from '@pkgs/clock-shared-ts/wall';

const DEFAULT_ORIGIN = 'http://localhost:8788';
const timeoutMs = Number(process.env['API_HEALTH_WAIT_MS'] ?? '120000');
const apiPidRaw = (process.env['API_PID'] ?? '').trim();
const apiPid = apiPidRaw.length > 0 ? Number(apiPidRaw) : NaN;
const apiLog = (process.env['API_LOG'] ?? '').trim();

function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function readApiLogTail(): string {
  if (apiLog.length === 0 || !existsSync(apiLog)) return '';
  try {
    const text = readFileSync(apiLog, { encoding: 'utf8' });
    const lines = text.split('\n');
    return lines.slice(-200).join('\n').trimEnd();
  } catch {
    return '';
  }
}

function formatApiLog(): string {
  const tail = readApiLogTail();
  return tail.length > 0
    ? `\nProcess output:\n${tail}`
    : apiLog.length > 0
      ? `\n(API log empty or unreadable: ${apiLog})`
      : '';
}

const fromEnv = process.env['LOCAL_PREVIEW_API_ORIGIN']?.trim();
const origin =
  fromEnv !== undefined && fromEnv.length > 0 ? fromEnv : DEFAULT_ORIGIN;
const healthUrl = `${origin}/api/health`;
const deadline = wallClock.now() + timeoutMs;
let lastErr: string | undefined;

while (wallClock.now() < deadline) {
  if (Number.isFinite(apiPid) && apiPid > 0 && !isPidAlive(apiPid)) {
    throw new Error(
      `API /api/health: API process (pid ${String(apiPid)}) exited before becoming healthy.${formatApiLog()}`
    );
  }

  try {
    const res = await globalThis.fetch(healthUrl);
    if (res.ok) {
      process.stdout.write(`[wait-for-api-health] ready ${healthUrl}\n`);
      process.exit(0);
    }
    lastErr = `HTTP ${String(res.status)}`;
  } catch (e) {
    lastErr = e instanceof Error ? e.message : String(e);
  }

  await new Promise<void>((resolve) => {
    wallTimers.setTimeout(() => resolve(), 250);
  });
}

throw new Error(
  `API /api/health: timed out (${String(timeoutMs)}ms). Last: ${lastErr ?? 'unknown'}${formatApiLog()}`
);
