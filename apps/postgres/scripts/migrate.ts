/**
 * Run `@apps/api/db` migrations against the local embedded DATABASE_URL
 * via subprocess (apps must not import other @apps/* packages).
 */
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { LOCAL_DATABASE_URL } from './ports';

const REPO_ROOT = join(import.meta.dirname, '../../..');

export async function runLocalMigrate(): Promise<void> {
  process.stdout.write('[postgres] migrating…\n');
  const result = spawnSync(
    process.execPath,
    [
      'run',
      'apps/api/src/db/migrate-cli.ts',
      '--wait',
      `--database-url=${LOCAL_DATABASE_URL}`,
    ],
    {
      cwd: REPO_ROOT,
      stdio: 'inherit',
      env: { ...process.env, SECRETS_ENV: 'dev' },
    }
  );
  if (result.status !== 0) {
    throw new Error(
      `[postgres] migrate failed with exit ${String(result.status ?? 'null')}`
    );
  }
  process.stdout.write('[postgres] migrate complete\n');
}

if (import.meta.main) {
  await runLocalMigrate();
}
