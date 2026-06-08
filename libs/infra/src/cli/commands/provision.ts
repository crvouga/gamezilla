import { PROVISION_DEPS } from '../deps/registry';
import { banner, ok } from '../lib/fmt';
import { infraOutputs } from '../lib/infra-outputs';
import {
  runCheckDepsPhase,
  runWranglerAuthPhase,
} from '../lib/phases/check-deps';
import { runDryRunPhase, runProvisionPhase } from '../lib/phases/provision';
import { serializeInfraContext } from '../lib/serialize-infra-context';
import type { CiPlatform } from '../platform/platform';
import type { InfraContext } from '../resources/types';
import type { Command } from './types';

/**
 * CI atomic step 1: dependency check + wrangler auth + provision every
 * resource (topological order) + dry-run validation. Emits the resolved
 * `InfraContext` as `infra_context` (JSON) plus individual outputs the
 * report job displays. Lock is held externally by `lock-acquire`.
 */
export class ProvisionCommand implements Command {
  readonly id = 'provision';
  readonly group = 'phase' as const;
  readonly summary =
    'Provision Cloudflare/Vault/PlanetScale resources + dry-run';

  constructor(private readonly platform: CiPlatform) {}

  async execute(): Promise<void> {
    const t0 = performance.now();
    banner('Provision');
    const p = this.platform;

    await runCheckDepsPhase(p, PROVISION_DEPS);
    await runWranglerAuthPhase(p);

    const ctx: InfraContext = {};
    await runProvisionPhase(p, ctx);
    await runDryRunPhase(p, ctx);

    const outputs = infraOutputs(ctx);

    banner('Provision Complete', performance.now() - t0);
    ok('pages_subdomain', outputs.pages_subdomain);
    ok('cloudflare_nameservers', outputs.cloudflare_nameservers);

    p.setOutput('infra_context', serializeInfraContext(ctx));
    p.setOutput('zone_id', ctx.zoneId ?? '');
    p.setOutput('pages_subdomain', outputs.pages_subdomain);
    p.setOutput('cloudflare_nameservers', outputs.cloudflare_nameservers);
  }
}
