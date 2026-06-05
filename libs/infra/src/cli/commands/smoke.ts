import { banner } from '../lib/fmt';
import { infraOutputs } from '../lib/infra-outputs';
import { runSmokePhase } from '../lib/phases/smoke';
import { readInfraContextFromEnv } from '../lib/serialize-infra-context';
import type { CiPlatform } from '../platform/platform';
import type { Command } from './types';

/**
 * CI atomic step 5: DNS diagnostics + HTTP smoke checks against the
 * deployed client / API endpoints. Hydrates `InfraContext`
 * from `INFRA_CONTEXT` env so the pages.dev fallback URL is correct.
 */
export class SmokeCommand implements Command {
  readonly id = 'smoke';
  readonly group = 'phase' as const;
  readonly summary = 'DNS + HTTP smoke checks against deployed endpoints';

  constructor(private readonly platform: CiPlatform) {}

  async execute(): Promise<void> {
    const t0 = performance.now();
    banner('Smoke');
    const ctx = readInfraContextFromEnv();
    const outputs = infraOutputs(ctx);
    await runSmokePhase(this.platform, outputs);
    banner('Smoke complete', performance.now() - t0);
  }
}
