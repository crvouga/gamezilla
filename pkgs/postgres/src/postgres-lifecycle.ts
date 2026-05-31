/**
 * Pure, binary-free lifecycle helpers for the managed local Postgres cluster:
 * probing `postmaster.pid`, reconciling crash-leftover state, and stopping a
 * running cluster by signaling its recorded PID.
 *
 * The actual cluster boot (initdb / start / wait-for-ready) is owned by
 * `embedded-cluster.ts`, which drives the bundled `embedded-postgres` binaries.
 * These helpers exist so the *cross-process* `kill.ts` can stop a cluster it
 * never started (the `dev.ts` wrapper holds the live `EmbeddedPostgres`
 * instance; `kill` only has the data dir + PID files to work with).
 *
 * Everything here uses `node:fs` + `process.kill` signals only — no shell-outs,
 * no Postgres CLI binaries. Works on macOS, Linux, and WSL.
 */

import { existsSync, readFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import type { Logger } from '@pkgs/logger';
import type { PostgresConfig } from './postgres-config';

/** Result of probing the postmaster.pid for an existing cluster. */
export interface PostmasterProbe {
  readonly state: 'absent' | 'stale' | 'alive';
  readonly pid: number | null;
}

function postmasterPidPath(dataDir: string): string {
  return join(dataDir, 'postmaster.pid');
}

export function isProcessAlive(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code;
    // EPERM means a process exists but we can't signal it (still alive).
    return code === 'EPERM';
  }
}

/**
 * Read `<dataDir>/postmaster.pid` and figure out whether a real postmaster is
 * still running for our cluster. Distinguishes "no file" from "file points at
 * a dead pid" (which is the classic crash-leftover case).
 */
export function probePostmaster(dataDir: string): PostmasterProbe {
  const pidFile = postmasterPidPath(dataDir);
  if (!existsSync(pidFile)) return { state: 'absent', pid: null };
  const raw = (() => {
    try {
      return readFileSync(pidFile, 'utf8');
    } catch {
      return '';
    }
  })();
  const firstLine = raw.split('\n', 1)[0]?.trim() ?? '';
  const pid = Number.parseInt(firstLine, 10);
  if (!Number.isInteger(pid) || pid <= 0) {
    return { state: 'stale', pid: null };
  }
  return isProcessAlive(pid)
    ? { state: 'alive', pid }
    : { state: 'stale', pid };
}

/**
 * Remove a leftover `postmaster.pid` only if the recorded PID is dead. Never
 * touch live clusters; that would corrupt them.
 */
export function reconcileStalePostmaster(dataDir: string, log: Logger): void {
  const probe = probePostmaster(dataDir);
  if (probe.state !== 'stale') return;
  log.warn('removing stale postmaster.pid', {
    dataDir,
    recordedPid: probe.pid,
  });
  try {
    unlinkSync(postmasterPidPath(dataDir));
  } catch (e) {
    log.warn('failed to remove stale postmaster.pid', {
      error: e instanceof Error ? e.message : String(e),
    });
  }
}

/** True if the data dir already holds an initialized cluster (PG_VERSION present). */
export function isClusterInitialized(dataDir: string): boolean {
  return existsSync(join(dataDir, 'PG_VERSION'));
}

/**
 * Escalate `SIGINT` (Postgres fast shutdown) -> `SIGTERM` -> `SIGKILL` on a
 * postmaster PID until it dies or the budget is exhausted. Scoped to the given
 * PID only — never "anything on the port".
 */
export async function escalateSignals(
  pid: number,
  budgetMs: number,
  log: Logger
): Promise<void> {
  const stages: Array<{ signal: NodeJS.Signals; waitMs: number }> = [
    { signal: 'SIGINT', waitMs: Math.min(5_000, budgetMs / 2) },
    { signal: 'SIGTERM', waitMs: Math.min(5_000, budgetMs / 3) },
    { signal: 'SIGKILL', waitMs: 1_000 },
  ];
  for (const { signal, waitMs } of stages) {
    if (!isProcessAlive(pid)) return;
    log.warn('signaling postmaster', { signal, pid });
    try {
      process.kill(pid, signal);
    } catch (e) {
      const code = (e as NodeJS.ErrnoException).code;
      if (code === 'ESRCH') return;
      log.warn('signal failed', {
        signal,
        pid,
        error: e instanceof Error ? e.message : String(e),
      });
    }
    const deadline = Date.now() + Math.max(100, waitMs);
    while (Date.now() < deadline) {
      if (!isProcessAlive(pid)) return;
      await sleep(50);
    }
  }
  if (isProcessAlive(pid)) {
    log.error('postmaster still alive after SIGKILL', { pid });
  }
}

/**
 * Stop a managed cluster identified purely by its `postmaster.pid`. Used by the
 * cross-process `kill.ts`, which has no handle on the live `EmbeddedPostgres`
 * instance. Reconciles stale state and no-ops when nothing is running.
 */
export async function stopClusterByPid(
  config: PostgresConfig,
  log: Logger
): Promise<void> {
  const probe = probePostmaster(config.dataDir);
  if (probe.state === 'absent') {
    log.info('cluster not running (no postmaster.pid)', {
      dataDir: config.dataDir,
    });
    return;
  }
  if (probe.state === 'stale') {
    log.info('cluster not running (stale postmaster.pid); reconciling', {
      dataDir: config.dataDir,
      recordedPid: probe.pid,
    });
    reconcileStalePostmaster(config.dataDir, log);
    return;
  }
  log.info('stopping postgres (fast)', {
    dataDir: config.dataDir,
    pid: probe.pid,
  });
  if (probe.pid !== null) {
    await escalateSignals(probe.pid, config.shutdownTimeoutMs, log);
  }
}
