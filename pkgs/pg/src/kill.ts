/**
 * Stops the managed local PostgreSQL cluster started by `dev.ts`.
 *
 * Scope is intentional: this targets *our* cluster only — identified by the
 * data directory (`PG_DATA_DIR`/default) and the wrapper PID file we wrote in
 * `dev.ts`. It will never `kill -9 $(lsof -ti :5432)` style operations because
 * that pattern terminates unrelated Postgres servers (Homebrew, Docker, system
 * `postgresql.service`) that happen to bind the same port.
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
import { createLogger, type Logger } from '@gamezilla/logger';
import { loadPostgresConfig } from './postgres-config';
import {
  probePostmaster,
  reconcileStalePostmaster,
  stopCluster,
} from './postgres-lifecycle';
import { resolvePostgresBinaries } from './postgres-binaries';
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
  const binaries = (() => {
    try {
      return resolvePostgresBinaries();
    } catch (e) {
      // Even without the binaries we can still try to signal the wrapper PID,
      // so don't make this fatal.
      logger.warn(
        'postgres binaries unavailable; will only signal wrapper PID',
        {
          error: e instanceof Error ? e.message : String(e),
        }
      );
      return null;
    }
  })();

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

  if (binaries !== null) {
    await stopCluster(binaries, config, logger);
  } else {
    // Without binaries we can still clean up a stale postmaster.pid pointing
    // at a dead PID; live ones we have to leave to the user.
    reconcileStalePostmaster(config.dataDir, logger);
    const probe = probePostmaster(config.dataDir);
    if (probe.state === 'alive') {
      logger.warn(
        'postmaster still alive; install postgres CLI tools to enable graceful stop',
        {
          pid: probe.pid,
        }
      );
    }
  }
}

async function main(): Promise<void> {
  await killCluster(log);
  log.info('kill complete');
}

// Guard so other scripts (e.g. `drop.ts`) can import `killCluster` without
// running `main()` as a side effect.
if (import.meta.main) {
  await main();
}
