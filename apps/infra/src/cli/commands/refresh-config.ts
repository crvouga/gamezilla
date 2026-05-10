import { banner } from '../lib/fmt';
import { infraOutputs } from '../lib/infra-outputs';
import { runRefreshConfigPhase } from '../lib/phases/refresh-config';
import { readInfraContextFromEnv } from '../lib/serialize-infra-context';
import type { CiPlatform } from '../platform/platform';
import type { Command } from './types';

/**
 * CI atomic step 6: POSTs `/client-config/refresh` so the Worker writes
 * the latest client runtime config into PatchDB. Final pipeline step.
 */
export class RefreshConfigCommand implements Command {
  readonly id = 'refresh-config';
  readonly group = 'phase' as const;
  readonly summary = 'Refresh PatchDB client runtime config';

  constructor(private readonly platform: CiPlatform) {}

  async execute(): Promise<void> {
    const t0 = performance.now();
    banner('Refresh client config');
    const ctx = readInfraContextFromEnv();
    const outputs = infraOutputs(ctx);
    await runRefreshConfigPhase(this.platform, outputs);
    banner('Refresh client config complete', performance.now() - t0);
  }
}
