// @io-wall-ok
import { type ChildProcess, spawn } from 'node:child_process';
import { join } from 'node:path';
import { ensureLocalBucket, waitForMinioReady } from '../scripts/ensure-bucket';
import { ensureMinioBin } from '../scripts/ensure-minio';
import {
  MINIO_API_PORT,
  MINIO_CONSOLE_PORT,
  MINIO_ENDPOINT,
  MINIO_ROOT_PASSWORD,
  MINIO_ROOT_USER,
} from './ports';

export type MinioServerHandle = {
  readonly endpoint: typeof MINIO_ENDPOINT;
  stop(): void;
};

const APP_DIR = join(import.meta.dirname, '..');
const DATA_DIR = join(APP_DIR, 'data');

export async function startMinioServer(): Promise<MinioServerHandle> {
  const bin = ensureMinioBin();
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
        MINIO_API_CORS_ALLOW_ORIGIN:
          process.env['MINIO_API_CORS_ALLOW_ORIGIN'] ??
          'http://localhost:5173,http://127.0.0.1:5173',
      },
    }
  );

  minio.on('error', (err) => {
    process.stderr.write(`[minio] failed to start ${String(err)}\n`);
  });

  await waitForMinioReady();
  await ensureLocalBucket();

  return {
    endpoint: MINIO_ENDPOINT,
    stop() {
      killChild(minio, 'SIGTERM');
    },
  };
}

function killChild(child: ChildProcess, signal: NodeJS.Signals): void {
  if (child.exitCode !== null || child.killed) return;
  try {
    child.kill(signal);
  } catch {
    // already gone
  }
}
