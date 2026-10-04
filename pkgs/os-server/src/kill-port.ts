import { execSync } from 'node:child_process';

import { assert } from '@pkgs/assert-shared/singleton';

function assertPort(port: number): void {
  assert.integer(port, `port must be an integer (got ${port})`);
  assert.ok(port >= 1 && port <= 65_535, 'port out of range', { port });
}

/**
 * Send SIGKILL to every process listening on `port`. Used by per-package `kill`
 * scripts so `turbo dev` can reclaim stale listeners left by hard exits.
 */
export function killListenersOnPort(port: number): void {
  assertPort(port);
  if (process.platform === 'win32') return;

  try {
    const out = execSync(`lsof -nP -iTCP:${port} -sTCP:LISTEN -t`, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
    const pids = [...new Set(out.split(/\s+/).filter(Boolean))];
    for (const pidStr of pids) {
      const pid = Number.parseInt(pidStr, 10);
      if (!Number.isInteger(pid) || pid <= 1 || pid === process.pid) continue;
      try {
        process.kill(pid, 'SIGKILL');
      } catch {
        // process may have exited
      }
    }
  } catch {
    // lsof exits 1 when nothing is listening
  }
}

/** Reclaim multiple dev ports. Duplicates are ignored. */
export function killListenersOnPorts(ports: readonly number[]): void {
  assert.ok(ports.length > 0, 'ports must be non-empty');
  for (const port of [...new Set(ports)]) {
    killListenersOnPort(port);
  }
}
