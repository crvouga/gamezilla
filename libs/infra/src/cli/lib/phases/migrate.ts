import { REPO_ROOT } from '../../paths';
import type { CiPlatform } from '../../platform/platform';
import { runStep } from '../../platform/platform';
import { runAsync } from '../../subprocess';
import { withLockDbSuspended } from '../lock-db-session';

/**
 * Runs root `bun run db:migrate` (`@apps/server/db` migrate CLI). Loads
 * `DATABASE_URL` from the secret store via `SecretStore`; CI just needs secrets
 * auth in place (already true for any infra subcommand).
 *
 * Deploy acquires the global lock only after this phase. When a lock is
 * held (other commands), suspends the lock DB connection for the subprocess.
 */
export async function runMigratePhase(platform: CiPlatform): Promise<void> {
  await withLockDbSuspended(async () => {
    await runStep(platform, 'Database migrate', async () => {
      await runAsync(platform, 'bun', ['run', 'db:migrate'], {
        cwd: REPO_ROOT,
        env: process.env,
        label: 'api:db:migrate',
      });
    });
  });
}
