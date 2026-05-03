import { join } from 'node:path';
import { ALL_DEPS } from '../deps/registry';
import { collectDepVersionIssues } from '../deps/version-check';
import { banner, fail, ok, warn } from '../lib/fmt';
import { infraOutputs } from '../lib/infra-outputs';
import { refreshClientConfig } from '../lib/refresh-client-config';
import { runHttpSmokeTests } from '../lib/smoke-tests';
import { REPO_ROOT } from '../paths';
import type { CiPlatform } from '../platform/platform';
import { runStep } from '../platform/platform';
import { createRegistry } from '../resources/registry';
import { topoSort } from '../resources/topo-sort';
import type { InfraContext } from '../resources/types';
import { runAsync, runCaptureAsync } from '../subprocess';
import type { Command } from './types';

export class DeployCommand implements Command {
  readonly id = 'deploy';
  readonly requiresLock = true;
  readonly group = 'lifecycle' as const;
  readonly summary = 'Provision infra, deploy apps, smoke test, refresh config';

  constructor(private readonly platform: CiPlatform) {}

  async execute(): Promise<void> {
    const t0 = performance.now();
    banner('Deploy');
    const p = this.platform;

    // ── 0. CLI dependencies at latest ───────────────────────────────────
    await runStep(p, 'Dependency versions', async () => {
      const problems: string[] = [];
      for (const dep of ALL_DEPS) {
        const r = await collectDepVersionIssues(dep);
        if (r.ok === true) {
          ok(dep.name, r.version);
          continue;
        }
        if (r.ok === 'unknown-latest') {
          warn(r.name, `${r.version} — could not resolve latest, continuing`);
          continue;
        }
        if (r.issue.kind === 'missing') {
          fail(r.issue.name, r.issue.reason);
          problems.push(r.issue.name);
          continue;
        }
        fail(
          r.issue.name,
          `outdated ${r.issue.current} — latest is ${r.issue.latest}`
        );
        problems.push(r.issue.name);
      }
      if (problems.length > 0) {
        throw new Error(
          `Update CLI dependencies (${problems.join(', ')}) — run \`bun run infra setup\``
        );
      }
    });

    // ── 1. Wrangler auth ────────────────────────────────────────────────
    await runStep(p, 'Wrangler auth', async () => {
      const whoami = await runCaptureAsync('wrangler', ['whoami']);
      p.notice(`Wrangler identity: ${whoami}`);
    });

    // ── 2. Ensure all resources (topological order) ─────────────────────
    const resources = topoSort(createRegistry());
    const ctx: InfraContext = {};

    for (const resource of resources) {
      await runStep(p, `Ensure: ${resource.id}`, () =>
        resource.provision(p, ctx)
      );
    }

    // ── 2b. DB migrations (`migrate` loads DB_URL from Doppler via SecretStore) ───
    await runStep(p, 'Database migrate', async () => {
      await runAsync(p, 'bun', ['run', 'migrate'], {
        cwd: join(REPO_ROOT, 'apps/db'),
        env: process.env,
        label: 'db: migrate',
      });
    });

    // ── 3. Deploy resources that have a deploy method (topological order)
    for (const resource of resources) {
      if (!resource.deploy) continue;
      await runStep(p, `Deploy: ${resource.id}`, async () => {
        await resource.deploy!(p, ctx);
      });
    }

    await runStep(p, 'Stripe sync', async () => {
      await runAsync(
        p,
        'bun',
        ['run', '--filter', '@gamezilla/stripe', '--elide-lines=0', 'sync'],
        {
          cwd: REPO_ROOT,
          env: process.env,
          label:
            'stripe: catalog + patch-db backfill + webhook endpoints (+ Doppler STRIPE_WEBHOOK_SECRET)',
        }
      );
    });

    // ── 4. Smoke tests ──────────────────────────────────────────────────
    const outputs = infraOutputs(ctx);
    await runStep(p, 'Smoke tests', () => runHttpSmokeTests(p, outputs));

    // ── 5. Refresh client config (PatchDB singleton) ───────────────────
    await runStep(p, 'Refresh client config', () =>
      refreshClientConfig(p, outputs)
    );

    // ── Done ─────────────────────────────────────────────────────────────
    banner('Deploy Complete', performance.now() - t0);
    ok('client_url', outputs.client_url);
    ok('api_url', outputs.api_url);
    ok('turbo_cache_url', outputs.turbo_cache_url);

    p.setOutput('client_url', outputs.client_url);
    p.setOutput('api_url', outputs.api_url);
    p.setOutput('turbo_cache_url', outputs.turbo_cache_url);
    p.setOutput('pages_project_name', outputs.pages_project_name);
    p.setOutput('pages_subdomain', outputs.pages_subdomain);
    p.setOutput('cloudflare_nameservers', outputs.cloudflare_nameservers);
  }
}
