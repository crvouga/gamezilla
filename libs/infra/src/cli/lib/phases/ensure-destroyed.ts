import type { CiPlatform } from '../../platform/platform';
import { runStep } from '../../platform/platform';
import { createRegistry } from '../../resources/registry';
import { topoSort } from '../../resources/topo-sort';

/**
 * Idempotently tear down every resource flagged
 * `routineStatus: 'destroyed'` by calling its existing `destroy()`. Runs
 * at the tail of `infra deploy` after the `'created'` stack is healthy,
 * so a successful deploy converges the cloud on the registry's intent:
 * `'created'` resources provisioned, `'destroyed'` resources gone. Each
 * `destroy()` is required to be idempotent (see `Resource.destroy`
 * doc), so this is a cheap no-op once destroyed stacks are fully
 * cleaned up.
 *
 * Order is reverse topological (dependents first) — same shape as
 * `infra destroy` — so a Worker comes down before its R2 bucket, etc.
 */
export async function runEnsureDestroyedPhase(
  platform: CiPlatform
): Promise<void> {
  const ordered = topoSort(createRegistry()).reverse();

  for (const resource of ordered) {
    if (resource.routineStatus !== 'destroyed') continue;
    await runStep(platform, `Destroy: ${resource.id}`, () =>
      resource.destroy(platform)
    );
  }
}
