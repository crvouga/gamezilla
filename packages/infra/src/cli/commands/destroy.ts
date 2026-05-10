import { banner, ok } from '../lib/fmt';
import type { CiPlatform } from '../platform/platform';
import { runStep } from '../platform/platform';
import { createRegistry } from '../resources/registry';
import { topoSort } from '../resources/topo-sort';
import type { Command } from './types';

export class DestroyCommand implements Command {
  readonly id = 'destroy';
  readonly requiresLock = true;
  readonly group = 'lifecycle' as const;
  readonly danger = true;
  readonly summary = 'Tear down managed Cloudflare infra';

  constructor(private readonly platform: CiPlatform) {}

  async execute(): Promise<void> {
    const t0 = performance.now();
    banner('Destroy');

    const resources = topoSort(createRegistry()).reverse();

    for (const resource of resources) {
      await runStep(this.platform, `Destroy: ${resource.id}`, () =>
        resource.destroy(this.platform)
      );
    }

    banner('Destroy Complete', performance.now() - t0);
    ok('All managed infrastructure has been torn down');
  }
}
