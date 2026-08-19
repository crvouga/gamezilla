// @io-wall-ok
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { ensureEmqxBin } from '../scripts/ensure-emqx';
import {
  EMQX_DASHBOARD_PASS,
  EMQX_DASHBOARD_PORT,
  EMQX_DASHBOARD_USER,
  EMQX_JWT_SECRET,
} from './ports';

export type EmqxServerHandle = {
  readonly dashboardPort: number;
  stop(): void;
};

const APP_DIR = join(import.meta.dirname, '..');
const DATA_DIR = join(APP_DIR, 'data');
const ETC_DIR = join(DATA_DIR, 'etc');

export async function startEmqxServer(): Promise<EmqxServerHandle> {
  const bin = ensureEmqxBin();
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

  return {
    dashboardPort: EMQX_DASHBOARD_PORT,
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
