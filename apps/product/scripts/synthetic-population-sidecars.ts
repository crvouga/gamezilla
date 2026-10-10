// @io-wall-ok — local development stack process composition.
import type { ChildProcess } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnOwned as spawn } from '@pkgs/os-server/dev-owner-spawn';
import { reservePort, waitForHttp } from './free-port';

/** Persist local keys with local data; a stack never inherits deployed credentials. */
export function syntheticPopulationStackSecrets(
  dataDir: string
): Record<string, string> {
  const file = join(dataDir, 'synthetic-population-secrets.json');
  if (existsSync(file))
    return JSON.parse(readFileSync(file, 'utf8')) as Record<string, string>;
  const values = {
    POPULATION_WORKER_TOKEN: `${crypto.randomUUID()}${crypto.randomUUID()}`,
    POPULATION_CREDENTIAL_SECRET: `${crypto.randomUUID()}${crypto.randomUUID()}`,
  };
  writeFileSync(file, JSON.stringify(values), { mode: 0o600 });
  return values;
}

export async function startSyntheticPopulationSidecars(input: {
  repoRoot: string;
  origin: string;
  count: number;
  token: string;
  track: (child: ChildProcess) => void;
}): Promise<void> {
  for (let index = 0; index < input.count; index += 1) {
    const reservation = reservePort();
    await reservation.release();
    const child = spawn(
      'bun',
      [
        '--conditions=browser',
        '--conditions=development',
        'apps/synthetic-population-worker/src/main.ts',
      ],
      {
        cwd: input.repoRoot,
        stdio: 'inherit',
        env: {
          ...process.env,
          SECRETS_ENV: 'local',
          DEPLOYMENT_ENVIRONMENT: '',
          DEPLOYMENT_VERSION: 'local',
          POPULATION_API_ORIGIN: input.origin,
          POPULATION_WORKER_TOKEN: input.token,
          POPULATION_CAPACITY: '1',
          POPULATION_SHUTDOWN_MS: '25000',
          PORT: String(reservation.port),
        },
      }
    );
    input.track(child);
    await waitForHttp(`http://127.0.0.1:${reservation.port}/ready`);
  }
}
