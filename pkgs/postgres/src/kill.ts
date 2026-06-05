/**
 * Stops the managed local PostgreSQL cluster started by `dev.ts`.
 *
 * Scope: first shut down *our* cluster (wrapper PID + data-dir `postmaster.pid`).
 * Then reclaim the dev ports (`PG_PORT`, `PG_GUI_PORT`) so a stale listener from
 * a prior hard turbo exit — or another local dev stack on the same port — does
 * not block the next `@pkgs/postgres#dev` boot.
 *
 * Order of operations:
 *
 * 1. If a wrapper PID file exists and points at a live wrapper, send SIGTERM
 *    to it — its own signal handler runs the graceful shutdown path.
 * 2. Independently, run `pg_ctl stop -m fast` against the data dir as a
 *    belt-and-suspenders shutdown for the cluster itself.
 * 3. Reconcile any leftover `postmaster.pid` if its recorded PID is dead.
 */

import { existsSync, readFileSync, unlinkSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
import { createLogger, type Logger } from '@pkgs/logger';
import { killListenersOnPorts } from '@pkgs/os/kill-port';
import { loadPostgresConfig } from './postgres-config';
import { stopClusterByPid } from './postgres-lifecycle';
import { WRAPPER_PID_FILE } from './postgres-paths';

const log = createLogger({ name: 'pg' });

function readWrapperPid(): number | null {
  if (!existsSync(WRAPPER_PID_FILE)) return null;
  try {
    const raw = readFileSync(WRAPPER_PID_FILE, 'utf8').trim();
    const pid = Number.parseInt(raw, 10);
    if (!Number.isInteger(pid) || pid <= 0) return null;
    return pid;
  } catch {
    return null;
  }
}

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code;
    return code === 'EPERM';
  }
}

async function signalWrapper(pid: number, timeoutMs: number): Promise<void> {
  log.info('signaling wrapper', { pid, signal: 'SIGTERM' });
  try {
    process.kill(pid, 'SIGTERM');
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code;
    if (code === 'ESRCH') {
      log.info('wrapper already gone', { pid });
      return;
    }
    log.warn('failed to signal wrapper', {
      pid,
      error: e instanceof Error ? e.message : String(e),
    });
    return;
  }

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!isAlive(pid)) return;
    await sleep(50);
  }
  log.warn('wrapper did not exit; escalating to SIGKILL', { pid });
  try {
    process.kill(pid, 'SIGKILL');
  } catch {
    // Already gone or permission issue; nothing more we can do here.
  }
}

/**
 * Stop the managed cluster + signal the wrapper process. Reusable from other
 * scripts (e.g. `drop.ts`, which needs to stop the DB before deleting its
 * data dir). Logs to the provided logger so the caller controls naming.
 */
export async function killCluster(logger: Logger): Promise<void> {
  const config = loadPostgresConfig();

  const wrapperPid = readWrapperPid();
  if (wrapperPid !== null && isAlive(wrapperPid)) {
    await signalWrapper(wrapperPid, config.shutdownTimeoutMs);
  } else if (wrapperPid !== null) {
    logger.info('removing stale wrapper.pid', { pid: wrapperPid });
    try {
      unlinkSync(WRAPPER_PID_FILE);
    } catch {
      // best effort
    }
  } else {
    logger.info('no wrapper.pid present');
  }

  // Belt-and-suspenders: stop the cluster directly by its recorded
  // `postmaster.pid` in case the wrapper already exited without cleaning up
  // (crash / kill -9). Scoped to our data dir's recorded PID only — never
  // "anything on the port".
  await stopClusterByPid(config, logger);
}

function reclaimDevPorts(): void {
  const config = loadPostgresConfig();
  const ports = [config.port];
  if (config.gui.enabled) ports.push(config.gui.port);
  killListenersOnPorts(ports);
}

async function main(): Promise<void> {
  await killCluster(log);
  reclaimDevPorts();
  log.info('kill complete');
}

// Guard so other scripts (e.g. `drop.ts`) can import `killCluster` without
// running `main()` as a side effect.
if (import.meta.main) {
  await main();
}
