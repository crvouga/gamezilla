// @io-wall-ok
import { spawn } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { connect } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Clock, Timers } from '@pkgs/clock-shared/types';
import {
  EMQX_API_KEY,
  EMQX_API_SECRET,
  EMQX_DASHBOARD_PASS,
  EMQX_DASHBOARD_PORT,
  EMQX_DASHBOARD_USER,
  EMQX_MQTT_PASS,
  EMQX_MQTT_PORT,
  EMQX_MQTT_USER,
  EMQX_WS_PORT,
} from '@pkgs/emqx-shared/ports';
import type { HttpClient } from '@pkgs/http-client-shared/types';
import { brokerLogDirectory } from './broker-log-directory';
import { resolveEmqxBin } from './emqx-bin';

export type EmqxServerHandle = {
  readonly dashboardPort: number;
  readonly mqttPort: number;
  readonly wsPort: number;
  readonly dataDir: string;
  stop(): void;
};

export type StartEmqxServerOptions = {
  /** Wall clock, timers and HTTP from the process entry: boot readiness polls. */
  readonly clock: Clock;
  readonly timers: Timers;
  readonly http: HttpClient;
  readonly mqttPort?: number;
  readonly wsPort?: number;
  readonly dashboardPort?: number;
  /** A distinct directory + node name is what allows a second broker. */
  readonly dataDir?: string;
  readonly nodeName?: string;
};

const APP_DIR = join(import.meta.dirname, '..');
/** Tail of broker output kept for the report when it dies unexpectedly. */
const OUTPUT_TAIL_BYTES = 64 * 1024;
const DEFAULT_DATA_DIR = join(APP_DIR, 'data');
/**
 * A cold broker boots in ~3 s idle; under a full `bun check` on a loaded
 * host it measured 26–60 s. Three times that, so load cannot fail a boot;
 * a broker that exits fails at once.
 */
const READY_TIMEOUT_MS = 180_000;
/**
 * A local broker serves a handful of clients: two schedulers without
 * busy-waiting boot it on ~2 s of CPU instead of ~3.3 s (one scheduler per
 * core, each spinning), and keep it from starving the other tasks of a
 * loaded check.
 */
const ERL_FLAGS = '+S 2:2 +SDcpu 2:2 +sbwt none +sbwtdcpu none +sbwtdio none';
const READY_POLL_MS = 100;

/** Seed the config + bootstrap files a fresh data directory needs. */
export function ensureEmqxDataDir(dataDir: string): void {
  const etcDir = join(dataDir, 'etc');
  mkdirSync(dataDir, { recursive: true });
  mkdirSync(etcDir, { recursive: true });

  const bootstrap = join(dataDir, 'api-keys.bootstrap');
  if (!existsSync(bootstrap)) {
    writeFileSync(bootstrap, `${EMQX_API_KEY}:${EMQX_API_SECRET}\n`, 'utf8');
  }
  copyFileSync(join(APP_DIR, 'config', 'emqx.conf'), join(etcDir, 'emqx.conf'));

  // EMQX `bootstrap_type = plain` CSV: header row, then one user per line.
  const users = join(dataDir, 'auth-built-in-db-bootstrap.csv');
  if (!existsSync(users)) {
    writeFileSync(
      users,
      `user_id,password,is_superuser\n${EMQX_MQTT_USER},${EMQX_MQTT_PASS},false\n`,
      'utf8'
    );
  }
}

function listenerEnv(args: {
  readonly mqttPort: number;
  readonly wsPort: number;
  readonly dashboardPort: number;
}): Record<string, string> {
  return {
    EMQX_LISTENERS__TCP__DEFAULT__BIND: `0.0.0.0:${String(args.mqttPort)}`,
    EMQX_LISTENERS__WS__DEFAULT__BIND: `0.0.0.0:${String(args.wsPort)}`,
    EMQX_DASHBOARD__LISTENERS__HTTP__BIND: `0.0.0.0:${String(args.dashboardPort)}`,
    // Unused locally, and on by default on fixed ports (8883 / 8084) that a
    // second broker on the host would fail to bind.
    EMQX_LISTENERS__SSL__DEFAULT__ENABLE: 'false',
    EMQX_LISTENERS__WSS__DEFAULT__ENABLE: 'false',
  };
}

function authEnv(dataDir: string): Record<string, string> {
  return {
    EMQX_AUTHENTICATION__1__MECHANISM: 'password_based',
    EMQX_AUTHENTICATION__1__BACKEND: 'built_in_database',
    EMQX_AUTHENTICATION__1__ENABLE: 'true',
    EMQX_AUTHENTICATION__1__BOOTSTRAP_TYPE: 'plain',
    EMQX_AUTHENTICATION__1__BOOTSTRAP_FILE: join(
      dataDir,
      'auth-built-in-db-bootstrap.csv'
    ),
  };
}

function tcpAccepts(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = connect({ port, host: '127.0.0.1' });
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('error', () => resolve(false));
  });
}

/** This node (not another broker on the port) serves the API and MQTT. */
async function brokerReady(args: {
  readonly http: HttpClient;
  readonly nodeName: string;
  readonly mqttPort: number;
  readonly dashboardPort: number;
}): Promise<boolean> {
  try {
    const res = await args.http.fetch(
      `http://127.0.0.1:${String(args.dashboardPort)}/api/v5/status`
    );
    const body = await res.text();
    if (!res.ok || !body.includes(args.nodeName)) return false;
  } catch {
    return false;
  }
  return tcpAccepts(args.mqttPort);
}

async function waitUntilReady(args: {
  readonly clock: Clock;
  readonly timers: Timers;
  readonly http: HttpClient;
  readonly nodeName: string;
  readonly mqttPort: number;
  readonly dashboardPort: number;
  readonly exited: () => boolean;
  readonly tail: () => string;
}): Promise<void> {
  const deadline = args.clock.now() + READY_TIMEOUT_MS;
  while (!(await brokerReady(args))) {
    if (args.exited() || args.clock.now() > deadline) {
      throw new Error(
        `[emqx] ${args.nodeName} not ready on mqtt:${String(args.mqttPort)} api:${String(args.dashboardPort)}; last output:\n${args.tail()}`
      );
    }
    await new Promise<void>((resolve) => {
      args.timers.setTimeout(resolve, READY_POLL_MS);
    });
  }
}

/**
 * Boot a broker and resolve once it accepts MQTT and answers its HTTP API as
 * `nodeName` — so a stale broker still holding the port is never mistaken for
 * this one.
 */
export async function startEmqxServer(
  options: StartEmqxServerOptions
): Promise<EmqxServerHandle> {
  const dataDir = options.dataDir ?? DEFAULT_DATA_DIR;
  const mqttPort = options.mqttPort ?? EMQX_MQTT_PORT;
  const wsPort = options.wsPort ?? EMQX_WS_PORT;
  const dashboardPort = options.dashboardPort ?? EMQX_DASHBOARD_PORT;
  const nodeName = options.nodeName ?? 'emqx@127.0.0.1';
  ensureEmqxDataDir(dataDir);
  const bin = resolveEmqxBin();
  // Drop ambient EMQX_AUTHENTICATION_* from secrets-run so Infisical JWT
  // chain entries cannot override the local password bootstrap.
  const cleanEnv: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (value === undefined) continue;
    if (key.startsWith('EMQX_AUTHENTICATION_')) continue;
    cleanEnv[key] = value;
  }
  // The broker's own log is noise while it works; it is buffered and printed
  // only if the broker exits without being asked to (the parent's failure).
  const emqx = spawn(bin, ['foreground'], {
    cwd: APP_DIR,
    // stdin stays inherited: an Erlang node in `foreground` halts when its
    // stdin hits EOF, so `ignore` (/dev/null) kills the broker at boot.
    stdio: ['inherit', 'pipe', 'pipe'],
    env: {
      ...cleanEnv,
      EMQX_LOG_DIR: brokerLogDirectory(dataDir, tmpdir()),
      ERL_FLAGS: [cleanEnv['ERL_FLAGS'], ERL_FLAGS].filter(Boolean).join(' '),
      EMQX_NODE__DATA_DIR: dataDir,
      EMQX_NODE__ETC_DIR: join(dataDir, 'etc'),
      EMQX_NODE__NAME: nodeName,
      EMQX_NODE__COOKIE: 'emqx_local',
      EMQX_API_KEY__BOOTSTRAP_FILE: join(dataDir, 'api-keys.bootstrap'),
      EMQX_DASHBOARD__DEFAULT_USERNAME: EMQX_DASHBOARD_USER,
      EMQX_DASHBOARD__DEFAULT_PASSWORD: EMQX_DASHBOARD_PASS,
      ...listenerEnv({ mqttPort, wsPort, dashboardPort }),
      ...authEnv(dataDir),
    },
  });

  let tail = '';
  const keep = (chunk: Buffer): void => {
    tail = (tail + chunk.toString('utf8')).slice(-OUTPUT_TAIL_BYTES);
  };
  emqx.stdout.on('data', keep);
  emqx.stderr.on('data', keep);
  let stopping = false;

  emqx.on('error', (err) => {
    process.stderr.write(`[emqx] failed to start ${String(err)}\n`);
  });
  emqx.on('exit', (code, signal) => {
    if (stopping) return;
    process.stderr.write(
      `[emqx] exited unexpectedly (code=${String(code)} signal=${String(signal)}); last output:\n${tail}\n`
    );
  });

  try {
    await waitUntilReady({
      clock: options.clock,
      timers: options.timers,
      http: options.http,
      nodeName,
      mqttPort,
      dashboardPort,
      exited: () => emqx.exitCode !== null || emqx.signalCode !== null,
      tail: () => tail,
    });
  } catch (error) {
    stopping = true;
    emqx.kill('SIGTERM');
    throw error;
  }

  return {
    dashboardPort,
    mqttPort,
    wsPort,
    dataDir,
    stop() {
      stopping = true;
      if (emqx.exitCode !== null || emqx.killed) return;
      try {
        emqx.kill('SIGTERM');
      } catch {
        // already gone
      }
    },
  };
}
