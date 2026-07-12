import type { CiPlatform } from '../../platform/platform';
import { runStep } from '../../platform/platform';
import { createRegistry } from '../../resources/registry';
import { topoSort } from '../../resources/topo-sort';
import type { InfraContext } from '../../resources/types';

/**
 * Walks every `'created'` resource in topo order and calls `deploy()` on
 * the ones that have one (api-worker, then client-worker). Resources marked
 * `routineStatus: 'destroyed'` are excluded so a torn-down stack neither
 * re-deploys nor re-creates its supporting infra. Assumes the
 * provision/dry-run phases have already run.
 */
export async function runDeployResourcesPhase(
  platform: CiPlatform,
  ctx: InfraContext
): Promise<void> {
  const resources = topoSort(createRegistry());
  for (const resource of resources) {
    if (resource.routineStatus !== 'created') continue;
    if (!resource.deploy) continue;
    await runStep(platform, `Deploy: ${resource.id}`, async () => {
      await resource.deploy!(platform, ctx);
    });
  }
}
