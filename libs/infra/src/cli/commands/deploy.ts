import { DEPLOY_DEPS } from '../deps/registry';
import { banner, ok } from '../lib/fmt';
import { infraOutputs } from '../lib/infra-outputs';
import {
  runCheckDepsPhase,
  runWranglerAuthPhase,
} from '../lib/phases/check-deps';
import { runDeployResourcesPhase } from '../lib/phases/deploy-resources';
import { runEnsureDestroyedPhase } from '../lib/phases/ensure-destroyed';
import { runWithGlobalLock } from '../lib/global-lock-session';
import { runMigratePhase } from '../lib/phases/migrate';
import { runDryRunPhase, runProvisionPhase } from '../lib/phases/provision';
import { runRefreshConfigPhase } from '../lib/phases/refresh-config';
import { runSmokePhase } from '../lib/phases/smoke';
import { runStripeSyncPhase } from '../lib/phases/stripe-sync';
import type { CiPlatform } from '../platform/platform';
import type { InfraContext } from '../resources/types';
import type { Command } from './types';

/**
 * Local + legacy CI entry point: runs the full deploy pipeline in a
 * single process. The global lock is acquired after `db:migrate` so
 * migrate does not compete with the lock connection for PlanetScale direct
 * slots. CI also has
 * per-phase commands (`provision`, `migrate`, `deploy-resources`,
 * `stripe-sync`, `smoke`, `refresh-config`) that share these same phase
 * functions but can run as separate jobs with the lock held externally
 * by `lock-acquire` / `lock-release`.
 *
 * After the `'created'` stack is healthy the deploy converges the cloud
 * on the registry by tearing down every `routineStatus: 'destroyed'`
 * resource (idempotent — a no-op once they're gone).
 */
export class DeployCommand implements Command {
  readonly id = 'deploy';
  /** Lock is acquired in {@link execute} after migrate (see {@link runWithGlobalLock}). */
  readonly requiresLock = false;
  readonly group = 'lifecycle' as const;
  readonly summary = 'Provision infra, deploy apps, smoke test, refresh config';

  constructor(private readonly platform: CiPlatform) {}

  async execute(): Promise<void> {
    const t0 = performance.now();
    banner('Deploy');
    const p = this.platform;

    await runCheckDepsPhase(p, DEPLOY_DEPS);
    await runWranglerAuthPhase(p);

    const ctx: InfraContext = {};
    await runProvisionPhase(p, ctx);
    await runMigratePhase(p);

    await runWithGlobalLock(p, this.id, async () => {
      await runDryRunPhase(p, ctx);
      await runDeployResourcesPhase(p, ctx);
      await runStripeSyncPhase(p);

      const outputs = infraOutputs(ctx);
      await runSmokePhase(p, outputs);
      await runRefreshConfigPhase(p, outputs);
      await runEnsureDestroyedPhase(p);

      banner('Deploy Complete', performance.now() - t0);
      ok('client_url', outputs.client_url);
      ok('api_url', outputs.api_url);

      p.setOutput('client_url', outputs.client_url);
      p.setOutput('api_url', outputs.api_url);
      p.setOutput('pages_project_name', outputs.pages_project_name);
      p.setOutput('pages_subdomain', outputs.pages_subdomain);
      p.setOutput('cloudflare_nameservers', outputs.cloudflare_nameservers);
    });
  }
}
