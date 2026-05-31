import { BunDep } from '../deps/bun';
import { EasDep } from '../deps/eas';
import type { Dep } from '../deps/types';
import { banner } from '../lib/fmt';
import { runCheckDepsPhase } from '../lib/phases/check-deps';
import { runDeployClientEasPhase } from '../lib/phases/deploy-client-eas';
import { readInfraContextFromEnv } from '../lib/serialize-infra-context';
import type { CiPlatform } from '../platform/platform';
import type { Command } from './types';

const EAS_DEPLOY_DEPS: readonly Dep[] = [new EasDep(), new BunDep()];

/**
 * Standalone native mobile deploy: fires EAS Build + publishes an OTA
 * `eas update` for the client. Mainly for local dev — set
 * `EAS_PROFILE=development` to ship the development channel without a full
 * `infra deploy`:
 *
 *   EAS_PROFILE=development bun run infra deploy-client-eas
 *
 * The full `infra deploy` runs this same phase automatically (after smoke +
 * refresh-config) when an EAS profile resolves.
 */
export class DeployClientEasCommand implements Command {
  readonly id = 'deploy-client-eas';
  readonly group = 'phase' as const;
  readonly summary = 'Deploy mobile client via EAS Build + OTA update';

  constructor(private readonly platform: CiPlatform) {}

  async execute(): Promise<void> {
    const t0 = performance.now();
    banner('Deploy client (EAS mobile)');
    await runCheckDepsPhase(this.platform, EAS_DEPLOY_DEPS);
    const ctx = readInfraContextFromEnv();
    await runDeployClientEasPhase(this.platform, ctx);
    banner('Deploy client (EAS mobile) complete', performance.now() - t0);
  }
}
