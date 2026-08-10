import { cliIo } from '../lib/cli-io';
import { banner } from '../lib/fmt';
import { infraOutputs } from '../lib/infra-outputs';
import { runRefreshConfigPhase } from '../lib/phases/refresh-config';
import { readInfraContextFromEnv } from '../lib/serialize-infra-context';
import type { CiPlatform } from '../platform/platform';
import type { Command } from './types';

/**
 * CI atomic step 6: POSTs `/api/client-config/refresh` so the Worker writes
 * the latest client runtime config into the sync entity store. Final pipeline step.
 */
export class RefreshConfigCommand implements Command {
  readonly id = 'refresh-config';
  readonly group = 'phase' as const;
  readonly summary = 'Refresh client runtime config in sync store';

  constructor(private readonly platform: CiPlatform) {}

  async execute(): Promise<void> {
    const t0 = cliIo.clock.now();
    banner('Refresh client config');
    const ctx = readInfraContextFromEnv();
    const outputs = infraOutputs(ctx);
    await runRefreshConfigPhase(this.platform, outputs);
    banner('Refresh client config complete', cliIo.clock.now() - t0);
  }
}
