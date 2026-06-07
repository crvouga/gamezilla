import { join } from 'node:path';
import { REPO_ROOT } from '../../paths';
import type { CiPlatform } from '../../platform/platform';
import { runStep } from '../../platform/platform';
import { runAsync } from '../../subprocess';
import { withLockDbSuspended } from '../lock-db-session';

/**
 * Runs `bun run db:migrate` from `apps/api`. The migrate script loads
 * `DATABASE_URL` from Doppler via `SecretStore`; CI just needs the DOPPLER
 * env in place (already true for any infra subcommand).
 *
 * Deploy acquires the global lock only after this phase. When a lock is
 * held (other commands), suspends the lock DB connection for the subprocess.
 */
export async function runMigratePhase(platform: CiPlatform): Promise<void> {
  await withLockDbSuspended(async () => {
    await runStep(platform, 'Database migrate', async () => {
      await runAsync(platform, 'bun', ['run', 'db:migrate'], {
        cwd: join(REPO_ROOT, 'apps/api'),
        env: process.env,
        label: 'api: db:migrate',
      });
    });
  });
}
