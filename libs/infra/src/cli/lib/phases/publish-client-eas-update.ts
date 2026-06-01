import type { CiPlatform } from '../../platform/platform';
import { runStep } from '../../platform/platform';
import { ClientResource } from '../../resources/client';
import type { InfraContext } from '../../resources/types';

/**
 * OTA update phase: publishes an `eas update` via
 * {@link ClientResource.publishEasUpdate}. Runs after the web client + API
 * are live and the API has been smoke-tested / config-refreshed, so a
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
    new ClientResource().publishEasUpdate(platform, ctx)
  );
}
