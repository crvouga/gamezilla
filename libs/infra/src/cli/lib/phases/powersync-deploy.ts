import type { CiPlatform } from '../../platform/platform';
import { runStep } from '../../platform/platform';
import { deployPowerSyncConfig } from '../../resources/powersync';
import type { InfraContext } from '../../resources/types';

/**
 * Deploys PowerSync service + sync config after Postgres migrate has applied
 * `schema.sql` (tables + `powersync` publication).
 */
export async function runPowerSyncDeployPhase(
  platform: CiPlatform,
  _ctx: InfraContext
): Promise<void> {
  await runStep(platform, 'Deploy: powersync', async () => {
    await deployPowerSyncConfig(platform);
  });
}
