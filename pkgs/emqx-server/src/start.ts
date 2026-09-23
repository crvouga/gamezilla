// @io-wall-ok
import { spawn, spawnSync } from 'node:child_process';
import { join } from 'node:path';
import type { Clock, Timers } from '@pkgs/clock';
import type { HttpClient } from '@pkgs/http-client';
import { ensureEmqxBin } from '../scripts/ensure-emqx';
import {
  EMQX_API_KEY,
  EMQX_API_SECRET,
  EMQX_DASHBOARD_PASS,
  EMQX_DASHBOARD_PORT,
  EMQX_DASHBOARD_USER,
  EMQX_JWT_SECRET,
} from './ports';

export type EmqxServerHandle = {
  readonly dashboardPort: number;
  stop(): Promise<void>;
};

const APP_DIR = join(import.meta.dirname, '..');
const DATA_DIR = join(APP_DIR, 'data');
const ETC_DIR = join(DATA_DIR, 'etc');
const API_URL = `http://127.0.0.1:${String(EMQX_DASHBOARD_PORT)}`;

export type EmqxStartIo = {
  readonly clock: Clock;
  readonly timers: Timers;
  readonly http: HttpClient;
};

async function apiReady(io: EmqxStartIo): Promise<boolean> {
  try {
    const auth = btoa(`${EMQX_API_KEY}:${EMQX_API_SECRET}`);
    const response = await io.http.fetch(`${API_URL}/api/v5/clients?limit=1`, {
      headers: { authorization: `Basic ${auth}` },
    });
    if (response.status === 401) {
      throw new Error('EMQX rejected the local API key');
    }
    return response.ok;
  } catch (error) {
    if (error instanceof Error && error.message.includes('rejected')) {
      throw error;
    }
    return false;
  }
}

async function waitForApi(
  io: EmqxStartIo,
  exitCode: () => number | null
): Promise<void> {
  const deadline = io.clock.now() + 30_000;
  while (io.clock.now() < deadline) {
    if (exitCode() !== null)
      throw new Error('EMQX exited before its API was ready');
    if (await apiReady(io)) return;
    await new Promise<void>((resolve) => io.timers.setTimeout(resolve, 250));
  }
  throw new Error('EMQX API did not become ready within 30 seconds');
}

export async function startEmqxServer(
  io: EmqxStartIo
): Promise<EmqxServerHandle> {
  const bin = ensureEmqxBin();
  try {
    const response = await io.http.fetch(`${API_URL}/api/v5/status`);
    if (response.ok) {
      if (!(await apiReady(io))) throw new Error('EMQX API is unavailable');
      process.stdout.write('[emqx] using running local broker\n');
      return {
        dashboardPort: EMQX_DASHBOARD_PORT,
        stop: () => Promise.resolve(),
      };
    }
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('EMQX')) {
      throw new Error(
        `${error.message}; stop the stale local EMQX node before starting the app`
      );
    }
  }
  const emqx = spawn(bin, ['foreground'], {
    cwd: APP_DIR,
    stdio: 'inherit',
    env: {
      ...process.env,
      EMQX_NODE__DATA_DIR: DATA_DIR,
      EMQX_NODE__ETC_DIR: ETC_DIR,
      EMQX_NODE__NAME: 'emqx@127.0.0.1',
      EMQX_NODE__COOKIE: 'emqx_local',
      EMQX_API_KEY__BOOTSTRAP_FILE: join(DATA_DIR, 'api-keys.bootstrap'),
      EMQX_DASHBOARD__DEFAULT_USERNAME: EMQX_DASHBOARD_USER,
      EMQX_DASHBOARD__DEFAULT_PASSWORD: EMQX_DASHBOARD_PASS,
      EMQX_AUTHENTICATION__1__MECHANISM: 'jwt',
      EMQX_AUTHENTICATION__1__FROM: 'password',
      EMQX_AUTHENTICATION__1__ENABLE: 'true',
      EMQX_AUTHENTICATION__1__USE_JWKS: 'false',
      EMQX_AUTHENTICATION__1__ALGORITHM: 'hmac-based',
      EMQX_AUTHENTICATION__1__SECRET: EMQX_JWT_SECRET,
      EMQX_AUTHENTICATION__1__SECRET_BASE64_ENCODED: 'false',
      EMQX_AUTHENTICATION__1__ACL_CLAIM_NAME: 'acl',
      EMQX_AUTHENTICATION__2__MECHANISM: 'password_based',
      EMQX_AUTHENTICATION__2__BACKEND: 'built_in_database',
      EMQX_AUTHENTICATION__2__ENABLE: 'true',
      EMQX_AUTHENTICATION__2__BOOTSTRAP_FILE: join(
        DATA_DIR,
        'auth-built-in-db-bootstrap.csv'
      ),
    },
  });

  emqx.on('error', (err) => {
    process.stderr.write(`[emqx] failed to start ${String(err)}\n`);
  });

  try {
    await waitForApi(io, () => emqx.exitCode);
  } catch (error) {
    emqx.kill('SIGTERM');
    throw error;
  }
  return {
    dashboardPort: EMQX_DASHBOARD_PORT,
    async stop() {
      spawnSync(bin, ['stop'], { cwd: APP_DIR, stdio: 'ignore' });
      if (emqx.exitCode === null) {
        emqx.kill('SIGTERM');
        await new Promise<void>((resolve) => {
          emqx.once('exit', () => resolve());
        });
      }
    },
  };
}
