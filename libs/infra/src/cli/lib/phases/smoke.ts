import type { CiPlatform } from '../../platform/platform';
import { runStep } from '../../platform/platform';
import type { InfraOutputs } from '../infra-outputs';
import { runHttpSmokeTests } from '../smoke-tests';

/**
 * Runs DNS diagnostics + HTTP smoke tests against the deployed endpoints
 * (client, API `/api/health`).
 */
export async function runSmokePhase(
  platform: CiPlatform,
  outputs: InfraOutputs
): Promise<void> {
  await runStep(platform, 'Smoke tests', () =>
    runHttpSmokeTests(platform, outputs)
  );
}
