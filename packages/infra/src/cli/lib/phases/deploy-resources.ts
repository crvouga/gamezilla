import type { CiPlatform } from '../../platform/platform';
import { runStep } from '../../platform/platform';
import { createRegistry } from '../../resources/registry';
import { topoSort } from '../../resources/topo-sort';
import type { InfraContext } from '../../resources/types';

/**
 * Walks every resource in topo order and calls `deploy()` on the ones
 * that have one (turbo-cache, api-worker, client). Assumes the
 * provision/dry-run phases have already run.
 */
export async function runDeployResourcesPhase(
  platform: CiPlatform,
  ctx: InfraContext
): Promise<void> {
  const resources = topoSort(createRegistry());
  for (const resource of resources) {
    if (!resource.deploy) continue;
    await runStep(platform, `Deploy: ${resource.id}`, async () => {
      await resource.deploy!(platform, ctx);
    });
  }
}
