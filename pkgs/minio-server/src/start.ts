// @io-wall-ok
import { type ChildProcess, spawn } from 'node:child_process';
import { connect } from 'node:net';
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

async function portOpen(port: number): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const socket = connect(port, '127.0.0.1');
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('error', (error: NodeJS.ErrnoException) => {
      socket.destroy();
      if (error.code === 'ECONNREFUSED') resolve(false);
      else reject(error);
    });
  });
}

export async function startMinioServer(): Promise<MinioServerHandle> {
  const [apiOpen, consoleOpen] = await Promise.all([
    portOpen(MINIO_API_PORT),
    portOpen(MINIO_CONSOLE_PORT),
  ]);
  if (apiOpen !== consoleOpen) {
    throw new Error(
      'MinIO ports are partly occupied; stop the stale local server'
    );
  }
  if (apiOpen) {
    await waitForMinioReady(2_000);
    await ensureLocalBucket();
    process.stdout.write('[minio] using running local server\n');
    return { endpoint: MINIO_ENDPOINT, stop: () => undefined };
  }
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

  try {
    await waitForMinioReady();
    await ensureLocalBucket();
  } catch (error) {
    killChild(minio, 'SIGTERM');
    throw error;
  }

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
