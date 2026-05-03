/**
 * Module for starting and stopping a PostgreSQL database locally via Docker.
 * Intended for testing purposes.
 */

import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';

/** Narrow spawn result: bundled typings omit `on` on `ChildProcess` in some environments. */
type SpawnPiped = {
  stdout: NodeJS.ReadableStream | null;
  stderr: NodeJS.ReadableStream | null;
  on(
    event: 'close',
    listener: (code: number | null, signal?: NodeJS.Signals) => void
  ): void;
};

export type PostgresConfig = {
  host?: string;
  port?: number;
  user?: string;
  password?: string;
  database?: string;
  /** Prefix for the Docker container name. Default: "postgres-test" */
  containerNamePrefix?: string;
};

export type StartedPostgres = {
  containerId: string;
  connectionUrl: string;
  config: Required<PostgresConfig>;
  stop: () => Promise<void>;
};

const DEFAULT_CONFIG = {
  host: 'localhost',
  port: 5432,
  user: 'postgres',
  password: 'postgres',
  database: 'test',
  containerNamePrefix: 'postgres-test',
} satisfies Required<PostgresConfig>;

function exec(
  command: string,
  args: string[],
  env: Record<string, string> = {}
): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve) => {
    const proc = spawn(command, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, ...env } as NodeJS.ProcessEnv,
    }) as unknown as SpawnPiped;
    let stdout = '';
    let stderr = '';
    proc.stdout?.on('data', (d) => (stdout += d.toString()));
    proc.stderr?.on('data', (d) => (stderr += d.toString()));
    proc.on('close', (code, _signal) =>
      resolve({ stdout, stderr, code: code ?? 1 })
    );
  });
}

function buildConnectionUrl(config: Required<PostgresConfig>): string {
  const { host, port, user, password, database } = config;
  const encoded = encodeURIComponent(password);
  return `postgres://${user}:${encoded}@${host}:${port}/${database}`;
}

async function waitForReady(
  config: Required<PostgresConfig>,
  timeoutMs = 10_000
): Promise<void> {
  const start = Date.now();
  const { SQL } = await import('bun');
  const url = buildConnectionUrl(config);
  const pollIntervalMs = 30;
  while (Date.now() - start < timeoutMs) {
    try {
      const sql = new SQL(url);
      await sql.unsafe('SELECT 1');
      void sql.close();
      return;
    } catch {
      await new Promise((r) => setTimeout(r, pollIntervalMs));
    }
  }
  throw new Error(`Postgres did not become ready within ${timeoutMs}ms`);
}

/**
 * Starts a PostgreSQL container via Docker.
 * Uses the official postgres image. Requires Docker to be running.
 *
 * @param config - Optional overrides for host, port, user, password, database, containerNamePrefix
 * @returns Object with containerId, connectionUrl, config, and stop function
 */
export async function startPostgresContainer(
  config: Partial<PostgresConfig> = {}
): Promise<StartedPostgres> {
  const merged = { ...DEFAULT_CONFIG, ...config };
  const containerName = [merged.containerNamePrefix, randomUUID().slice(0, 8)]
    .filter(Boolean)
    .join('-');
  const { stdout, stderr, code } = await exec('docker', [
    'run',
    '-d',
    '--rm',
    `--name=${containerName}`,
    `-e`,
    `POSTGRES_USER=${merged.user}`,
    `-e`,
    `POSTGRES_PASSWORD=${merged.password}`,
    `-e`,
    `POSTGRES_DB=${merged.database}`,
    `-p`,
    `${merged.port}:5432`,
    'postgres:16-alpine',
  ]);

  if (code !== 0) {
    throw new Error(
      `Failed to start Postgres container: ${stderr || stdout}\n\nEnsure Docker is running.`
    );
  }

  const containerId = stdout.trim();

  try {
    await waitForReady(merged);
  } catch (err) {
    await exec('docker', ['stop', containerName]);
    throw err;
  }

  const connectionUrl = buildConnectionUrl(merged);

  return {
    containerId,
    connectionUrl,
    config: merged,
    stop: async () => {
      await exec('docker', ['stop', '-t', '2', containerName]);
    },
  };
}

/**
 * Stops a Postgres container by container ID or name.
 * Safe to call even if the container is already stopped.
 * Containers started with startPostgres use --rm, so they are removed on stop.
 */
export async function stopPostgresContainer(
  containerId: string
): Promise<void> {
  await exec('docker', ['stop', '-t', '2', containerId]);
}
