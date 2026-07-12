import { existsSync, readFileSync } from 'node:fs';

import { resolveLocalApiOrigin } from '../src/harness';

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

const origin = await resolveLocalApiOrigin();
const healthUrl = `${origin}/api/health`;
const deadline = Date.now() + timeoutMs;
let lastErr: string | undefined;

while (Date.now() < deadline) {
  if (Number.isFinite(previewPid) && previewPid > 0 && !isPidAlive(previewPid)) {
    throw new Error(
      `API /api/health: preview process (pid ${String(previewPid)}) exited before becoming healthy.${formatPreviewLog()}`
    );
  }

  try {
    const res = await fetch(healthUrl);
    if (res.ok) {
      process.stdout.write(`[wait-for-api-health] ready ${healthUrl}\n`);
      process.exit(0);
    }
    lastErr = `HTTP ${String(res.status)}`;
  } catch (e) {
    lastErr = e instanceof Error ? e.message : String(e);
  }

  await Bun.sleep(250);
}

throw new Error(
  `API /api/health: timed out (${String(timeoutMs)}ms). Last: ${lastErr ?? 'unknown'}${formatPreviewLog()}`
);
