import type { CiPlatform } from '../../platform/platform';
import { runStep } from '../../platform/platform';
import { ApiWorkerResource } from '../../resources/api-worker';
import type { InfraContext } from '../../resources/types';

/**
 * OTA update phase: publishes an `eas update` via
 * {@link ApiWorkerResource.publishEasUpdate}. Runs after the API + www
 * Workers are live and the API has been smoke-tested / config-refreshed, so a
 * freshly-shipped mobile bundle never reaches a stale server.
 *
 * No-ops (with a skip notice) when no EAS profile resolves — see
 * `resolveEasProfile` in `lib/eas-mobile.ts`. Native binaries are built
 * separately by the manual `build-client-native` command.
 */
export async function runPublishClientEasUpdatePhase(
  platform: CiPlatform,
  ctx: InfraContext
): Promise<void> {
  await runStep(platform, 'Publish client OTA update (EAS)', () =>
    new ApiWorkerResource().publishEasUpdate(platform, ctx)
  );
}
