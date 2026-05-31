import type { CiPlatform } from '../../platform/platform';
import { runStep } from '../../platform/platform';
import { ClientResource } from '../../resources/client';
import type { InfraContext } from '../../resources/types';

/**
 * Native mobile deploy phase: fires EAS Build + publishes an OTA
 * `eas update` via {@link ClientResource.deployEas}. Runs after the web
 * client + API are live and the API has been smoke-tested / config-refreshed,
 * so a freshly-shipped mobile bundle never reaches a stale server.
 *
 * No-ops (with a skip notice) when no EAS profile resolves — see
 * `resolveEasProfile` in `lib/deploy-client-eas.ts`.
 */
export async function runDeployClientEasPhase(
  platform: CiPlatform,
  ctx: InfraContext
): Promise<void> {
  await runStep(platform, 'Deploy client (EAS mobile)', () =>
    new ClientResource().deployEas(platform, ctx)
  );
}
