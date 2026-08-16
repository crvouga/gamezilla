// @io-wall-ok
/**
 * Foreground entry for `@apps/minio` `dev` / `preview`.
 * Spawns `minio server` under one process so Turbo SIGINT/SIGTERM tears it down.
 */
import { type ChildProcess, spawn } from 'node:child_process';
import { join } from 'node:path';
import { ensureLocalBucket, waitForMinioReady } from './ensure-bucket';
import { ensureMinioBin } from './ensure-minio';
import {
  MINIO_API_PORT,
  MINIO_CONSOLE_PORT,
  MINIO_ENDPOINT,
  MINIO_ROOT_PASSWORD,
  MINIO_ROOT_USER,
} from './ports';

const APP_DIR = join(import.meta.dirname, '..');
const DATA_DIR = join(APP_DIR, 'data');

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

const bin = ensureMinioBin();
process.stdout.write(
  `[minio] S3 API ${MINIO_ENDPOINT} console http://127.0.0.1:${String(MINIO_CONSOLE_PORT)}\n`
);
process.stdout.write(
  `[minio] credentials ${MINIO_ROOT_USER} / ${MINIO_ROOT_PASSWORD}\n`
);

const minio = spawn(
  bin,
  [
    'server',
    DATA_DIR,
    '--address',
    `:${String(MINIO_API_PORT)}`,
    '--console-address',
    `:${String(MINIO_CONSOLE_PORT)}`,
  ],
  {
    cwd: APP_DIR,
    stdio: 'inherit',
    env: {
      ...process.env,
      MINIO_ROOT_USER,
      MINIO_ROOT_PASSWORD,
      // Global browser CORS for Expo web (bucket PutBucketCors is also applied).
      MINIO_API_CORS_ALLOW_ORIGIN:
        process.env['MINIO_API_CORS_ALLOW_ORIGIN'] ??
        'http://localhost:5173,http://127.0.0.1:5173,http://localhost:8081,http://127.0.0.1:8081,http://localhost:19006,http://127.0.0.1:19006',
    },
  }
);
children.push(minio);

minio.on('error', (err) => {
  console.error('[minio] failed to start', err);
  shutdown(1);
});

try {
  await waitForMinioReady();
  await ensureLocalBucket();
  process.stdout.write('[minio] ready (persistent)\n');
} catch (error) {
  process.stderr.write(
    `[minio] bootstrap failed: ${error instanceof Error ? error.message : String(error)}\n`
  );
  shutdown(1);
}

const exitCode = await new Promise<number>((resolve) => {
  minio.on('exit', (code) => resolve(code ?? 1));
});

killChildren();
process.exit(exitCode);
