import { banner, ok } from '../lib/fmt';
import { infraOutputs } from '../lib/infra-outputs';
import { runDeployResourcesPhase } from '../lib/phases/deploy-resources';
import { readInfraContextFromEnv } from '../lib/serialize-infra-context';
import type { CiPlatform } from '../platform/platform';
import type { Command } from './types';

/**
 * CI atomic step 3: deploys every active resource that has a `deploy()`
 * method (api-worker, client) in topological order. Hydrates
 * `InfraContext` from `INFRA_CONTEXT` env (set by the workflow from
 * `needs.provision.outputs.infra_context`) so deploys see the same
 * `pagesSubdomain` etc. the provision phase resolved. Resources with
 * `routineStatus: 'destroyed'` (currently the self-hosted Turbo cache)
 * are skipped; the deploy's `'destroyed'`-resource tail phase tears
 * them down via `destroy()`.
 */
export class DeployResourcesCommand implements Command {
  readonly id = 'deploy-resources';
  readonly group = 'phase' as const;
  readonly summary = 'Deploy api-worker and client (Pages)';

  constructor(private readonly platform: CiPlatform) {}

  async execute(): Promise<void> {
    const t0 = performance.now();
    banner('Deploy resources');
    const p = this.platform;

    const ctx = readInfraContextFromEnv();
    await runDeployResourcesPhase(p, ctx);

    const outputs = infraOutputs(ctx);

    banner('Deploy resources complete', performance.now() - t0);
    ok('client_url', outputs.client_url);
    ok('api_url', outputs.api_url);

    p.setOutput('client_url', outputs.client_url);
    p.setOutput('api_url', outputs.api_url);
    p.setOutput('pages_project_name', outputs.pages_project_name);
  }
}
