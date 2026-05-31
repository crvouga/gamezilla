/**
 * Drives the bundled `embedded-postgres` binaries (shipped via npm — no system
 * PostgreSQL install required) for the managed local dev cluster.
 *
 * `embedded-postgres` spawns the `postgres` postmaster as a direct child of
 * this process, so our orphan-prevention invariant still holds: an abrupt
 * wrapper exit takes the cluster down via process-group SIGHUP, and the
 * library's own `async-exit-hook` SIGINTs the postmaster on a clean exit.
 *
 * This module adds the bits `embedded-postgres` does not provide on its own:
 *
 * - idempotent init (skip `initdb` when the data dir already holds a cluster),
 * - server log lines forwarded with a `pg-server:` prefix + tee'd to a log file,
 * - a bounded `stop()` that escalates signals on the recorded `postmaster.pid`
 *   if the library's `SIGINT` shutdown wedges,
 * - unexpected-exit detection so `turbo dev` fails fast instead of hanging.
 */

import EmbeddedPostgres from 'embedded-postgres';
import {
  createWriteStream,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import type { WriteStream } from 'node:fs';
import { dirname, join } from 'node:path';
import type { Logger } from '@pkgs/logger';
import type { PostgresConfig } from './postgres-config';
import {
  escalateSignals,
  isClusterInitialized,
  probePostmaster,
} from './postgres-lifecycle';

export interface EmbeddedCluster {
  /** Run `initdb` only when the data dir does not already hold a cluster. */
  initIfNeeded(): Promise<void>;
  /** Spawn the postmaster and resolve once it accepts connections. */
  start(): Promise<void>;
  /** Fast-shutdown the postmaster, escalating signals if it wedges. */
  stop(timeoutMs: number): Promise<void>;
  /** PID of the running postmaster (from `postmaster.pid`), or null. */
  pid(): number | null;
  /**
   * Invoke `onExit` if the postmaster dies unexpectedly (not via `stop`).
   * Returns a disposer that cancels the watch.
   */
  watchExit(onExit: () => void): () => void;
}

const WATCH_INTERVAL_MS = 1_000;
const RECENT_LOG_MAX = 20;
const INCOMPAT_RE = /incompatible|initialized by PostgreSQL/i;

interface LogSink {
  readonly sink: WriteStream;
  readonly emit: (message: string) => void;
  /** Snapshot of the most recent (trimmed) server log lines. */
  readonly recent: () => readonly string[];
}

/**
 * Truncate + open the postmaster log file, and build an `emit` that tees each
 * line to the file, to stdout (with a `pg-server:` prefix), and into a small
 * ring buffer used to surface a meaningful error when boot fails.
 */
function makeLogSink(logFile: string): LogSink {
  mkdirSync(dirname(logFile), { recursive: true });
  writeFileSync(logFile, '', { encoding: 'utf8' });
  const sink = createWriteStream(logFile, { flags: 'a' });
  const buffer: string[] = [];
  const emit = (message: string): void => {
    sink.write(message.endsWith('\n') ? message : `${message}\n`);
    for (const line of message.split('\n')) {
      const trimmed = line.trim();
      if (trimmed.length === 0) continue;
      process.stdout.write(`pg-server: ${line}\n`);
      buffer.push(trimmed);
      if (buffer.length > RECENT_LOG_MAX) buffer.shift();
    }
  };
  return { sink, emit, recent: () => buffer };
}

function readDataDirVersion(dataDir: string): string | null {
  try {
    return readFileSync(join(dataDir, 'PG_VERSION'), 'utf8').trim();
  } catch {
    return null;
  }
}

/**
 * `embedded-postgres` rejects `start()` with no value when the postmaster
 * closes before reporting ready, so build an actionable message from the
 * captured log. The common case after bumping major versions is a data dir
 * left behind by an older PostgreSQL — point the developer at `drop`.
 */
function buildStartError(recent: readonly string[], dataDir: string): string {
  const tail = recent.slice(-8).join('\n');
  const suffix = tail ? `\n\npostgres log:\n${tail}` : '';
  if (recent.some((line) => INCOMPAT_RE.test(line))) {
    const version = readDataDirVersion(dataDir) ?? '(unknown)';
    return (
      `Postgres data dir ${dataDir} was initialized by PostgreSQL ${version} ` +
      'and is incompatible with the bundled server. Wipe it with ' +
      '`bun run --filter @pkgs/postgres drop`, then re-run dev and ' +
      `\`bun db:migrate\`.${suffix}`
    );
  }
  return `postgres exited before becoming ready${suffix}`;
}

function postgresFlags(config: PostgresConfig): string[] {
  return [
    '-h',
    config.host,
    // Disable Unix socket dir so we don't depend on /tmp/.s.PGSQL.<port>
    // permissions (which can collide with system Postgres on shared hosts).
    '-c',
    'unix_socket_directories=',
    '-c',
    'log_min_messages=warning',
    '-c',
    'log_min_error_statement=error',
  ];
}

function toMessage(value: string | Error | unknown): string {
  if (typeof value === 'string') return value;
  if (value instanceof Error) return value.message;
  return String(value);
}

async function withTimeout<T>(
  p: Promise<T>,
  ms: number
): Promise<'ok' | 'timeout'> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<'timeout'>((resolve) => {
    timer = setTimeout(() => resolve('timeout'), ms);
  });
  try {
    await Promise.race([p.then(() => undefined), timeout]);
    return 'ok';
  } finally {
    if (timer !== null) clearTimeout(timer);
  }
}

export function createEmbeddedCluster(
  config: PostgresConfig,
  logFile: string,
  log: Logger
): EmbeddedCluster {
  const { sink, emit, recent } = makeLogSink(logFile);
  let stopping = false;

  const pg = new EmbeddedPostgres({
    databaseDir: config.dataDir,
    user: config.user,
    password: config.password,
    port: config.port,
    authMethod: 'scram-sha-256',
    persistent: true,
    initdbFlags: [`--encoding=${config.encoding}`, `--locale=${config.locale}`],
    postgresFlags: postgresFlags(config),
    onLog: emit,
    onError: (e) => emit(toMessage(e)),
  });

  const pid = (): number | null => {
    const probe = probePostmaster(config.dataDir);
    return probe.state === 'alive' ? probe.pid : null;
  };

  const stop = async (timeoutMs: number): Promise<void> => {
    stopping = true;
    const result = await withTimeout(pg.stop(), timeoutMs);
    if (result === 'ok') {
      sink.end();
      return;
    }
    log.warn('embedded-postgres stop timed out; escalating signals', {
      timeoutMs,
    });
    const recorded = probePostmaster(config.dataDir).pid;
    if (recorded !== null) await escalateSignals(recorded, timeoutMs, log);
    sink.end();
  };

  // NOTE: the interval is intentionally *referenced* (not unref'd) — it is the
  // wrapper's heartbeat. Besides detecting an unexpected postmaster death, it
  // keeps the Bun event loop alive so `dev` stays in the foreground until a
  // signal triggers `stop`, which clears it.
  const watchExit = (onExit: () => void): (() => void) => {
    let observed = false;
    const handle = setInterval(() => {
      const alive = pid() !== null;
      if (alive) observed = true;
      if (observed && !alive && !stopping) {
        clearInterval(handle);
        onExit();
      }
    }, WATCH_INTERVAL_MS);
    return () => clearInterval(handle);
  };

  return {
    initIfNeeded: async () => {
      if (isClusterInitialized(config.dataDir)) return;
      log.info('initializing cluster', { dataDir: config.dataDir });
      await pg.initialise();
    },
    start: async () => {
      try {
        await pg.start();
      } catch (e) {
        throw new Error(buildStartError(recent(), config.dataDir), {
          cause: e,
        });
      }
    },
    stop,
    pid,
    watchExit,
  };
}
