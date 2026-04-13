import { assert } from '@gamezilla/shared/assert';
import { ALL_DEPS } from '../deps/registry';
import { collectDepVersionIssues } from '../deps/version-check';
import { banner, fail, ok, warn } from '../lib/fmt';
import { infraOutputs } from '../lib/infra-outputs';
import { refreshClientConfig } from '../lib/refresh-client-config';
import { runHttpSmokeTests } from '../lib/smoke-tests';
import type { CiPlatform } from '../platform/platform';
import { runStep } from '../platform/platform';
import { createRegistry } from '../resources/registry';
import { topoSort } from '../resources/topo-sort';
import type { InfraContext } from '../resources/types';
import { runCaptureAsync } from '../subprocess';
import type { Command } from './types';

export class DeployCommand implements Command {
  readonly id = 'deploy';
  readonly summary =
    'Full idempotent deploy: ensure infra → deploy apps → smoke tests → refresh client config';

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

    // ── 3. Deploy resources that have a deploy method (topological order)
    for (const resource of resources) {
      if (!resource.deploy) continue;
      assert.defined(resource.deploy, 'resource.deploy is defined');
      await runStep(p, `Deploy: ${resource.id}`, () => {
        assert.defined(resource.deploy, 'resource.deploy is defined');
        resource.deploy(p, ctx);
      });
    }

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

    this.writeSummary(outputs);
  }

  private writeSummary(outputs: ReturnType<typeof infraOutputs>): void {
    const services = [
      { label: 'Client', url: outputs.client_url },
      { label: 'API (Workers)', url: outputs.api_url },
    ] as const;

    const rows = services
      .map((s) => `| **${s.label}** | ${s.url} |`)
      .join('\n');

    const ns = outputs.cloudflare_nameservers || '_(unavailable)_';

    this.platform.appendJobSummary(`## Deployment Complete

| Service | URL |
|---------|-----|
${rows}

### Squarespace Nameserver Setup (one-time)

Point your domain to Cloudflare in [Squarespace Domains](https://domains.squarespace.com):

**Nameservers:** \`${ns}\`

> DNS records and the apex-to-www redirect are managed by the infra CLI.
> Once nameservers are delegated, no further Squarespace configuration is needed.
`);
  }
}
