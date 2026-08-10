import { DEPLOY_DEPS } from '../deps/registry';
import { cliIo } from '../lib/cli-io';
import { banner, ok } from '../lib/fmt';
import { runWithGlobalLock } from '../lib/global-lock-session';
import { infraOutputs } from '../lib/infra-outputs';
import {
  runCheckDepsPhase,
  runWranglerAuthPhase,
} from '../lib/phases/check-deps';
import { runDeployResourcesPhase } from '../lib/phases/deploy-resources';
import { runEnsureDestroyedPhase } from '../lib/phases/ensure-destroyed';
import { runMigratePhase } from '../lib/phases/migrate';
import { runDryRunPhase, runProvisionPhase } from '../lib/phases/provision';
import { runPublishClientEasUpdatePhase } from '../lib/phases/publish-client-eas-update';
import { runSmokePhase } from '../lib/phases/smoke';
import { runStripeSyncPhase } from '../lib/phases/stripe-sync';
import type { CiPlatform } from '../platform/platform';
import type { InfraContext } from '../resources/types';
import type { Command } from './types';

/**
 * Local + legacy CI entry point: runs the full deploy pipeline in a
 * single process. The global lock is acquired after `db:migrate` so
 * migrate does not compete with the lock connection for Neon direct
 * slots. CI also has
 * per-phase commands (`provision`, `migrate`, `deploy-resources`,
 * `stripe-sync`, `smoke`) that share these same phase
 * functions but can run as separate jobs with the lock held externally
 * by `lock-acquire` / `lock-release`.
 *
 * Client config is materialized by the Worker on first DB-backed request
 * (no HTTP refresh step).
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
  readonly summary =
    'Provision infra, deploy apps (web + EAS OTA update), smoke test';

  constructor(private readonly platform: CiPlatform) {}

  async execute(): Promise<void> {
    const t0 = cliIo.clock.now();
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
      await runPublishClientEasUpdatePhase(p, ctx);
      await runEnsureDestroyedPhase(p);

      banner('Deploy Complete', cliIo.clock.now() - t0);
      ok('client_url', outputs.client_url);
      ok('api_url', outputs.api_url);

      p.setOutput('client_url', outputs.client_url);
      // Do not emit api_url: the secrets action masks API_URL, and GHA drops job
      // outputs that contain masked secrets. Report derives it from domain.
      p.setOutput('cloudflare_nameservers', outputs.cloudflare_nameservers);
    });
  }
}
