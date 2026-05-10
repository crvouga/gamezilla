import { join } from 'node:path';
import { REPO_ROOT } from '../../paths';
import type { CiPlatform } from '../../platform/platform';
import { runStep } from '../../platform/platform';
import { runAsync } from '../../subprocess';

/**
 * Runs `bun run db:migrate` from `apps/api`. The migrate script loads
 * `DB_URL` from Doppler via `SecretStore`; CI just needs the DOPPLER
 * env in place (already true for any infra subcommand).
 */
export async function runMigratePhase(platform: CiPlatform): Promise<void> {
  await runStep(platform, 'Database migrate', async () => {
    await runAsync(platform, 'bun', ['run', 'db:migrate'], {
      cwd: join(REPO_ROOT, 'apps/api'),
      env: process.env,
      label: 'api: db:migrate',
    });
  });
}
