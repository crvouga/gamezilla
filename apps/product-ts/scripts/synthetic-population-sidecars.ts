// @io-wall-ok — local development stack process composition.
import type { ChildProcess } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnOwned as spawn } from '@pkgs/dev-owner-server-ts/dev-owner-spawn';
import { plannedPort, reservePort, waitForHttp } from './free-port';
import { localProcessEnv } from './local-process-env';

/** Persist local keys with local data; a stack never inherits deployed credentials. */
export function syntheticPopulationStackSecrets(
  dataDir: string
): Record<string, string> {
  const file = join(dataDir, 'synthetic-population-secrets.json');
  if (existsSync(file)) {
    const stored = JSON.parse(readFileSync(file, 'utf8')) as Record<
      string,
      string
    >;
    // Only the control-plane bearer is still a secret; older files hold more.
    const token = stored['POPULATION_WORKER_TOKEN'];
    if (token !== undefined) return { POPULATION_WORKER_TOKEN: token };
  }
  const values = {
    POPULATION_WORKER_TOKEN: `${crypto.randomUUID()}${crypto.randomUUID()}`,
  };
  writeFileSync(file, JSON.stringify(values), { mode: 0o600 });
  return values;
}

export async function startSyntheticPopulationSidecars(input: {
  repoRoot: string;
  origin: string;
  count: number;
  token: string;
  /** Planned ports, one per worker; without them each asks the OS for its own. */
  ports?: readonly number[] | undefined;
  track: (child: ChildProcess) => void;
}): Promise<void> {
  for (let index = 0; index < input.count; index += 1) {
    const planned = input.ports?.[index];
    const reservation =
      planned === undefined ? reservePort() : plannedPort(planned);
    await reservation.release();
    const child = spawn(
      'bun',
      [
        '--no-env-file',
        '--conditions=browser',
        '--conditions=development',
        'apps/synthetic-population-worker-ts/src/main.ts',
      ],
      {
        cwd: input.repoRoot,
        stdio: 'inherit',
        env: {
          ...localProcessEnv(process.env),
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
