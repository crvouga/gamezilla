// @io-wall-ok
import { spawn } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ensureEmqxBin } from '../scripts/ensure-emqx';
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
} from './ports';

export type EmqxServerHandle = {
  readonly dashboardPort: number;
  readonly mqttPort: number;
  readonly wsPort: number;
  readonly dataDir: string;
  stop(): void;
};

export type StartEmqxServerOptions = {
  readonly mqttPort?: number;
  readonly wsPort?: number;
  readonly dashboardPort?: number;
  /** A distinct directory + node name is what allows a second broker. */
  readonly dataDir?: string;
  readonly nodeName?: string;
};

const APP_DIR = join(import.meta.dirname, '..');
const DEFAULT_DATA_DIR = join(APP_DIR, 'data');

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

  const users = join(dataDir, 'auth-built-in-db-bootstrap.csv');
  if (!existsSync(users)) {
    writeFileSync(
      users,
      `${EMQX_MQTT_USER}:{plain}${EMQX_MQTT_PASS}\n`,
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
  };
}

function authEnv(dataDir: string): Record<string, string> {
  return {
    EMQX_AUTHENTICATION__1__MECHANISM: 'password_based',
    EMQX_AUTHENTICATION__1__BACKEND: 'built_in_database',
    EMQX_AUTHENTICATION__1__ENABLE: 'true',
    EMQX_AUTHENTICATION__1__BOOTSTRAP_FILE: join(
      dataDir,
      'auth-built-in-db-bootstrap.csv'
    ),
  };
}

export async function startEmqxServer(
  options?: StartEmqxServerOptions
): Promise<EmqxServerHandle> {
  const dataDir = options?.dataDir ?? DEFAULT_DATA_DIR;
  const mqttPort = options?.mqttPort ?? EMQX_MQTT_PORT;
  const wsPort = options?.wsPort ?? EMQX_WS_PORT;
  const dashboardPort = options?.dashboardPort ?? EMQX_DASHBOARD_PORT;
  ensureEmqxDataDir(dataDir);
  const bin = ensureEmqxBin();
  const emqx = spawn(bin, ['foreground'], {
    cwd: APP_DIR,
    stdio: 'inherit',
    env: {
      ...process.env,
      EMQX_NODE__DATA_DIR: dataDir,
      EMQX_NODE__ETC_DIR: join(dataDir, 'etc'),
      EMQX_NODE__NAME: options?.nodeName ?? 'emqx@127.0.0.1',
      EMQX_NODE__COOKIE: 'emqx_local',
      EMQX_API_KEY__BOOTSTRAP_FILE: join(dataDir, 'api-keys.bootstrap'),
      EMQX_DASHBOARD__DEFAULT_USERNAME: EMQX_DASHBOARD_USER,
      EMQX_DASHBOARD__DEFAULT_PASSWORD: EMQX_DASHBOARD_PASS,
      ...listenerEnv({ mqttPort, wsPort, dashboardPort }),
      ...authEnv(dataDir),
    },
  });

  emqx.on('error', (err) => {
    process.stderr.write(`[emqx] failed to start ${String(err)}\n`);
  });

  return {
    dashboardPort,
    mqttPort,
    wsPort,
    dataDir,
    stop() {
      if (emqx.exitCode !== null || emqx.killed) return;
      try {
        emqx.kill('SIGTERM');
      } catch {
        // already gone
      }
    },
  };
}
