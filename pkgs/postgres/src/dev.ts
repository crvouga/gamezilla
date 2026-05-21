/**
 * Foreground entrypoint for `bun run --filter @pkgs/postgres dev`.
 *
 * Starts a real local PostgreSQL cluster in the foreground so Turbo's
 * persistent-task lifecycle owns it: SIGINT/SIGTERM from `turbo dev` (or
 * Ctrl-C) are translated into a graceful `pg_ctl stop -m fast`, falling back
 * to escalated signals on the recorded postmaster PID if needed.
 *
 * Also auto-starts the [pgweb](https://github.com/sosedoff/pgweb) GUI as a
 * sibling foreground child, pre-connected to the local DB. The GUI is a
 * developer convenience: missing binary or boot failure logs a warning and
 * lets the cluster keep running.
 *
 * Lifecycle invariants (the things that prevent orphans / wedged clusters):
 *
 * - The postmaster + pgweb are spawned as direct children in our process
 *   group; if our wrapper exits abnormally, the OS sends SIGHUP to the group
 *   and they shut down with us.
 * - On stale `postmaster.pid` (recorded PID is dead), we reconcile *before*
 *   trying to start, so a previous abrupt exit doesn't permanently wedge
 *   `dev`.
 * - The shutdown handler is single-flight and idempotent; double Ctrl-C does
 *   not race. Shutdown order is GUI -> cluster -> wrapper.pid cleanup so the
 *   GUI never queries a closed DB.
 * - We write a wrapper PID file so `kill.ts` can target *our* wrapper without
 *   depending on "whatever is on port 5432".
 */

import { mkdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { assert } from '@pkgs/assert';
import { createLogger } from '@pkgs/logger';
import {
  buildConnectionUrl,
  buildGuiUrl,
  loadPostgresConfig,
  type PostgresConfig,
} from './postgres-config';
import {
  initClusterIfNeeded,
  probePostmaster,
  reconcileStalePostmaster,
  startPostmaster,
  stopCluster,
  waitUntilReady,
} from './postgres-lifecycle';
import {
  resolvePostgresBinaries,
  type ResolvedBinaries,
} from './postgres-binaries';
import { resolvePgwebBinary, startPgweb, type StartedGui } from './pg-gui';
import {
  GUI_LOG_FILE,
  LOG_FILE,
  RUN_DIR,
  WRAPPER_PID_FILE,
} from './postgres-paths';

const log = createLogger({ name: 'pg' });

function writeWrapperPidFile(): void {
  mkdirSync(RUN_DIR, { recursive: true });
  writeFileSync(WRAPPER_PID_FILE, String(process.pid), { encoding: 'utf8' });
}

function clearWrapperPidFile(): void {
  try {
    unlinkSync(WRAPPER_PID_FILE);
  } catch {
    // Already gone — fine.
  }
}

interface RunningServer {
  readonly config: PostgresConfig;
  readonly binaries: ResolvedBinaries;
  /** null when the GUI sidecar is disabled or pgweb couldn't start. */
  gui: StartedGui | null;
}

/**
 * Best-effort GUI startup. Failures here NEVER bubble up — the cluster is the
 * contract; the GUI is a convenience. Returns null on any failure (binary
 * missing, port collision, etc.).
 */
function startGuiBestEffort(
  config: PostgresConfig,
  dbUrl: string
): StartedGui | null {
  if (!config.gui.enabled) {
    log.info('pgweb sidecar disabled', {
      reason: 'PG_GUI=off or CI=1',
    });
    return null;
  }
  const binary = resolvePgwebBinary(config.gui.binaryOverride, log);
  if (binary === null) return null;
  try {
    const gui = startPgweb({
      binary,
      dbUrl,
      host: config.gui.host,
      port: config.gui.port,
      logFile: GUI_LOG_FILE,
      log,
    });
    log.info('pgweb sidecar started', {
      pid: gui.pid,
      url: gui.url,
      logFile: GUI_LOG_FILE,
    });
    return gui;
  } catch (e) {
    log.warn('pgweb sidecar failed to start; continuing without GUI', {
      error: e instanceof Error ? e.message : String(e),
    });
    return null;
  }
}

async function bootCluster(): Promise<RunningServer> {
  const config = loadPostgresConfig();
  const binaries = resolvePostgresBinaries();

  log.info('postgres binaries resolved', {
    source: binaries.source,
    postgres: binaries.paths.postgres,
  });

  // Reconcile stale state from previous abrupt exits before doing anything.
  reconcileStalePostmaster(config.dataDir, log);

  const probe = probePostmaster(config.dataDir);
  assert.ok(
    probe.state !== 'alive',
    'cluster appears to be already running for this data dir; ' +
      'run `bun run --filter @pkgs/postgres kill` (or stop the existing process) before `dev`',
    { dataDir: config.dataDir, pid: probe.pid }
  );

  initClusterIfNeeded(binaries, config, log);

  const child = startPostmaster(binaries, config, LOG_FILE, log);
  log.info('postmaster spawned', { pid: child.pid });

  await waitUntilReady(binaries, config, log);

  const dbUrl = buildConnectionUrl(config);
  log.info('postgres ready', {
    host: config.host,
    port: config.port,
    dataDir: config.dataDir,
    dbUrl,
    logFile: LOG_FILE,
  });

  const gui = startGuiBestEffort(config, dbUrl);
  const running: RunningServer = { config, binaries, gui };

  if (gui !== null) {
    log.info('dev sidecar ready', {
      dbUrl,
      guiUrl: buildGuiUrl(config),
    });
    // If pgweb dies on its own, log + warn but keep the cluster running.
    void gui.exited.then(({ code, signal }) => {
      if (shutdownInFlight) return;
      log.warn('pgweb sidecar exited (cluster keeps running)', {
        code,
        signal,
      });
      running.gui = null;
    });
  }

  // If the postmaster dies on its own (crash, OOM, kill -9 from elsewhere)
  // there is nothing useful left for the wrapper to do — exit so Turbo
  // shows the failure instead of hanging on "ready" forever.
  void child.exited.then(({ code, signal }) => {
    if (shutdownInFlight) return;
    log.error('postmaster exited unexpectedly', { code, signal });
    void shutdown('postmaster-exit').then(() => {
      process.exit(typeof code === 'number' ? code : 1);
    });
  });

  return running;
}

let server: RunningServer | null = null;
let shutdownInFlight = false;
let shutdownPromise: Promise<void> | null = null;

function shutdown(reason: string): Promise<void> {
  if (shutdownPromise !== null) return shutdownPromise;
  shutdownInFlight = true;
  shutdownPromise = (async () => {
    log.info('shutting down', { reason });
    try {
      // Stop the GUI BEFORE the cluster so it doesn't see torn-down connections.
      if (server?.gui) {
        await server.gui.stop(server.config.shutdownTimeoutMs);
      }
      if (server !== null) {
        await stopCluster(server.binaries, server.config, log);
      }
    } catch (e) {
      log.error('shutdown failed', {
        error: e instanceof Error ? e.message : String(e),
      });
    } finally {
      clearWrapperPidFile();
    }
  })();
  return shutdownPromise;
}

function installSignalHandlers(): void {
  const onSignal = (signal: NodeJS.Signals): void => {
    void shutdown(`signal:${signal}`).then(() => {
      // Conventional 128 + signal numbers; default to SIGINT's 130.
      const codes: Record<string, number> = {
        SIGHUP: 129,
        SIGINT: 130,
        SIGQUIT: 131,
        SIGTERM: 143,
      };
      process.exit(codes[signal] ?? 0);
    });
  };
  for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP', 'SIGQUIT'] as const) {
    process.on(sig, onSignal);
  }
  process.on('uncaughtException', (e) => {
    log.error('uncaughtException', {
      error: e instanceof Error ? e.message : String(e),
    });
    void shutdown('uncaughtException').then(() => process.exit(1));
  });
  process.on('unhandledRejection', (e) => {
    log.error('unhandledRejection', {
      error: e instanceof Error ? e.message : String(e),
    });
    void shutdown('unhandledRejection').then(() => process.exit(1));
  });
}

async function main(): Promise<void> {
  installSignalHandlers();
  writeWrapperPidFile();
  try {
    server = await bootCluster();
  } catch (e) {
    log.error('failed to start postgres', {
      error: e instanceof Error ? e.message : String(e),
    });
    await shutdown('boot-failed');
    process.exit(1);
  }
}

await main();
