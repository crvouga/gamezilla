import { banner, ok } from '../lib/fmt';
import { infraOutputs } from '../lib/infra-outputs';
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
    'Full idempotent deploy: ensure infra → deploy apps → smoke tests';

  constructor(private readonly platform: CiPlatform) {}

  async execute(): Promise<void> {
    const t0 = performance.now();
    banner('Deploy');
    const p = this.platform;

    // ── 1. Wrangler auth ────────────────────────────────────────────────
    await runStep(p, 'Wrangler auth', async () => {
      const whoami = await runCaptureAsync('wrangler', ['whoami']);
      p.notice(`Wrangler identity: ${whoami}`);
    });

    // ── 2. Ensure all resources (topological order) ─────────────────────
    const resources = topoSort(createRegistry());
    const ctx: InfraContext = {};

    for (const resource of resources) {
      await runStep(p, `Ensure: ${resource.id}`, () => resource.ensure(p, ctx));
    }

    // ── 3. Deploy resources that have a deploy method (topological order)
    for (const resource of resources) {
      if (!resource.deploy) continue;
      await runStep(p, `Deploy: ${resource.id}`, () =>
        resource.deploy!(p, ctx)
      );
    }

    // ── 4. Smoke tests ──────────────────────────────────────────────────
    const outputs = infraOutputs(ctx);
    await runStep(p, 'Smoke tests', () => runHttpSmokeTests(p, outputs));

    // ── Done ─────────────────────────────────────────────────────────────
    banner('Deploy Complete', performance.now() - t0);
    ok('client_url', outputs.client_url);
    ok('api_url', outputs.api_url);

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
