/**
 * Foreground entry for `@apps/emqx dev`. Spawns `emqx foreground` under one
 * Node process so turbo SIGINT/SIGTERM tear down the broker (no shell &).
 */
import { type ChildProcess, spawn } from 'node:child_process';
import { join } from 'node:path';
import { ensureEmqxBin } from './ensure-emqx';
import {
  EMQX_DASHBOARD_PASS,
  EMQX_DASHBOARD_PORT,
  EMQX_DASHBOARD_USER,
  EMQX_JWT_SECRET,
} from './ports';

const APP_DIR = join(import.meta.dirname, '..');
const DATA_DIR = join(APP_DIR, 'data');
const ETC_DIR = join(DATA_DIR, 'etc');

const children: ChildProcess[] = [];
let shuttingDown = false;

function killChild(child: ChildProcess, signal: NodeJS.Signals): void {
  if (child.exitCode !== null || child.killed) return;
  try {
    child.kill(signal);
  } catch {
    // process may have exited
  }
}

function killChildren(): void {
  for (const child of children) {
    killChild(child, 'SIGTERM');
  }
  setTimeout(() => {
    for (const child of children) {
      killChild(child, 'SIGKILL');
    }
  }, 2_000);
}

function shutdown(exitCode: number): void {
  if (shuttingDown) return;
  shuttingDown = true;
  killChildren();
  process.exit(exitCode);
}

for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP'] as const) {
  process.on(sig, () => {
    const codes: Record<string, number> = {
      SIGHUP: 129,
      SIGINT: 130,
      SIGTERM: 143,
    };
    shutdown(codes[sig] ?? 1);
  });
}

const bin = ensureEmqxBin();
console.warn('[emqx] dashboard', {
  url: 'http://127.0.0.1:' + String(EMQX_DASHBOARD_PORT),
  user: EMQX_DASHBOARD_USER,
  pass: EMQX_DASHBOARD_PASS,
});

/**
 * Env auth chain must include JWT first. A password_based-only override was
 * wiping emqx.conf JWT and leaving MQTT clients in a reconnect storm.
 */
const emqx = spawn(bin, ['foreground'], {
  cwd: APP_DIR,
  stdio: 'inherit',
  env: {
    ...process.env,
    EMQX_NODE__DATA_DIR: DATA_DIR,
    EMQX_NODE__ETC_DIR: ETC_DIR,
    EMQX_NODE__NAME: 'emqx@127.0.0.1',
    EMQX_NODE__COOKIE: 'gamezilla_emqx_local',
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
children.push(emqx);

const exitCode = await new Promise<number>((resolve) => {
  emqx.on('exit', (code) => resolve(code ?? 1));
  emqx.on('error', (err) => {
    console.error('[emqx] failed to start', err);
    resolve(1);
  });
});

killChildren();
process.exit(exitCode);
