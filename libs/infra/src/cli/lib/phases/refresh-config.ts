import type { InfraOutputs } from '../infra-outputs';
import type { CiPlatform } from '../../platform/platform';
import { runStep } from '../../platform/platform';
import { refreshClientConfig } from '../refresh-client-config';

/**
 * POSTs to the API so the Worker writes the latest client runtime config
 * into PatchDB. Must run after smoke tests confirm the API is reachable.
 */
export async function runRefreshConfigPhase(
  platform: CiPlatform,
  outputs: InfraOutputs
): Promise<void> {
  await runStep(platform, 'Refresh client config', () =>
    refreshClientConfig(platform, outputs)
  );
}
