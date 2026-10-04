// @io-wall-ok
/**
 * Poll `/api/health` until ready (used by CI after starting `preview:serve`).
 * Optional `API_PREVIEW_PID` / `API_PREVIEW_LOG` fail fast if the process dies.
 */

import { existsSync, readFileSync } from 'node:fs';
import { wallClock, wallTimers } from '@pkgs/clock-shared/wall';

const DEFAULT_ORIGIN = 'http://localhost:8788';
const timeoutMs = Number(process.env['API_HEALTH_WAIT_MS'] ?? '120000');
const previewPidRaw = (process.env['API_PREVIEW_PID'] ?? '').trim();
const previewPid = previewPidRaw.length > 0 ? Number(previewPidRaw) : NaN;
const previewLog = (process.env['API_PREVIEW_LOG'] ?? '').trim();

function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function readPreviewLogTail(): string {
  if (previewLog.length === 0 || !existsSync(previewLog)) return '';
  try {
    const text = readFileSync(previewLog, { encoding: 'utf8' });
    const lines = text.split('\n');
    return lines.slice(-200).join('\n').trimEnd();
  } catch {
    return '';
  }
}

function formatPreviewLog(): string {
  const tail = readPreviewLogTail();
  return tail.length > 0
    ? `\nProcess output:\n${tail}`
    : previewLog.length > 0
      ? `\n(preview log empty or unreadable: ${previewLog})`
      : '';
}

const fromEnv = process.env['LOCAL_PREVIEW_API_ORIGIN']?.trim();
const origin =
  fromEnv !== undefined && fromEnv.length > 0 ? fromEnv : DEFAULT_ORIGIN;
const healthUrl = `${origin}/api/health`;
const deadline = wallClock.now() + timeoutMs;
let lastErr: string | undefined;

while (wallClock.now() < deadline) {
  if (
    Number.isFinite(previewPid) &&
    previewPid > 0 &&
    !isPidAlive(previewPid)
  ) {
    throw new Error(
      `API /api/health: preview process (pid ${String(previewPid)}) exited before becoming healthy.${formatPreviewLog()}`
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
  `API /api/health: timed out (${String(timeoutMs)}ms). Last: ${lastErr ?? 'unknown'}${formatPreviewLog()}`
);
