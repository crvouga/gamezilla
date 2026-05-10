import type { CiPlatform } from '../../platform/platform';
import { runStep } from '../../platform/platform';
import { createRegistry } from '../../resources/registry';
import { topoSort } from '../../resources/topo-sort';
import type { InfraContext } from '../../resources/types';

/**
 * Walks every resource in topo order and runs `provision()` to make sure
 * the underlying infra exists. `ctx` is mutated in place — `zoneId`,
 * `nameservers`, `pagesSubdomain` are populated by upstream resources and
 * read by downstream ones (and by `infraOutputs(ctx)` later).
 */
export async function runProvisionPhase(
  platform: CiPlatform,
  ctx: InfraContext
): Promise<void> {
  const resources = topoSort(createRegistry());
  for (const resource of resources) {
    await runStep(platform, `Ensure: ${resource.id}`, () =>
      resource.provision(platform, ctx)
    );
  }
}

/**
 * Dry-run every deployable resource BEFORE touching any of them.
 *
 * Fail-fast gate: if any resource's deploy would fail at bundle/bindings
 * validation, surface that here — *before* turbo-cache ships and leaves
 * the stack in a half-deployed state. Resources without a `dryRun` method
 * (e.g. infra that can't be simulated) are skipped; a missing `dryRun` on
 * a resource that *does* have `deploy` is allowed but worth revisiting if
 * partial-deploy incidents recur.
 */
export async function runDryRunPhase(
  platform: CiPlatform,
  ctx: InfraContext
): Promise<void> {
  const resources = topoSort(createRegistry());
  for (const resource of resources) {
    if (!resource.dryRun) continue;
    await runStep(platform, `Dry run: ${resource.id}`, async () => {
      await resource.dryRun!(platform, ctx);
    });
  }
}
