import {
  ClientDeployable,
  TurboCacheDeployable,
  WorkersDeployable,
} from '../lib/deploy-registry';
import { ensureDopplerDefaults } from '../lib/ensure-doppler-defaults';
import { banner, ok } from '../lib/fmt';
import { infraOutputs } from '../lib/infra-outputs';
import { resolveDatabaseUrl } from '../lib/resolve-database-url';
import { runHttpSmokeTests } from '../lib/smoke-tests';
import type { CiPlatform } from '../platform/platform';
import { runStep } from '../platform/platform';
import { createEnsureRegistry } from '../resources/registry';
import type { InfraContext } from '../resources/types';
import {
  fetchDopplerSecret,
  getSecretMap,
  validateSecret,
} from '../secrets/secrets';
import { runCaptureAsync } from '../subprocess';
import type { Command } from './types';

export class DeployCommand implements Command {
  readonly id = 'deploy';
  readonly summary =
    'Full idempotent deploy: validate → ensure infra → apps → smoke tests';

  constructor(private readonly platform: CiPlatform) {}

  async execute(): Promise<void> {
    const t0 = performance.now();
    banner('Deploy');
    const p = this.platform;

    // ── 1. Secrets ──────────────────────────────────────────────────────
    await runStep(p, 'Secrets', () => this.ensureSecrets());

    // ── 2. Wrangler auth ────────────────────────────────────────────────
    await runStep(p, 'Wrangler auth', async () => {
      const whoami = await runCaptureAsync('wrangler', ['whoami']);
      p.notice(`Wrangler identity: ${whoami}`);
    });

    // ── 3. Validate secrets ─────────────────────────────────────────────
    await runStep(p, 'Validate secrets', async () => {
      const secretMap = getSecretMap();
      const errors: string[] = [];
      for (const entry of secretMap) {
        const value = process.env[entry.env];
        if (!value) continue;
        const err = await validateSecret(entry, value);
        if (err) {
          p.error(`${entry.doppler}: ${err}`);
          errors.push(entry.doppler);
        } else {
          ok(entry.doppler);
        }
      }
      if (errors.length > 0) {
        throw new Error(`Secret validation failed: ${errors.join(', ')}`);
      }
    });

    // ── 4. Resolve DATABASE_URL ─────────────────────────────────────────
    await runStep(p, 'Resolve DATABASE_URL', async () => {
      const url = await resolveDatabaseUrl();
      ok('DATABASE_URL', url.replace(/\/\/[^@]+@/, '//***:***@'));
    });

    // ── 5. Ensure infrastructure ────────────────────────────────────────
    const ctx: InfraContext = {};
    const resources = createEnsureRegistry();
    for (const resource of resources) {
      await runStep(p, `Ensure: ${resource.id}`, () =>
        resource.ensure(p, ctx)
      );
    }

    const outputs = infraOutputs(ctx);

    // ── 6. Deploy turbo-cache ───────────────────────────────────────────
    await runStep(p, 'Deploy: turbo-cache', () =>
      new TurboCacheDeployable(p).deploy(outputs)
    );

    // ── 7. Deploy workers-api ───────────────────────────────────────────
    await runStep(p, 'Deploy: workers-api', () =>
      new WorkersDeployable(p).deploy(outputs)
    );

    // ── 8. Deploy client ────────────────────────────────────────────────
    await runStep(p, 'Deploy: client', () =>
      new ClientDeployable(p).deploy(outputs)
    );

    // ── 9. Smoke tests ──────────────────────────────────────────────────
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

  // ── Helpers ──────────────────────────────────────────────────────────

  private ensureSecrets(): void {
    const secretMap = getSecretMap();
    let loaded = 0;
    let alreadySet = 0;
    let failed = 0;

    for (const { doppler, env } of secretMap) {
      if (process.env[env]) {
        alreadySet++;
        continue;
      }
      try {
        const value = fetchDopplerSecret(doppler);
        process.env[env] = value;
        loaded++;
      } catch {
        this.platform.warning(`${env} — not in env and Doppler fetch failed`);
        failed++;
      }
    }

    ensureDopplerDefaults();

    if (alreadySet > 0) ok('Secrets in env', String(alreadySet));
    if (loaded > 0) ok('Loaded from Doppler', String(loaded));
    if (failed > 0) {
      const stillMissing = secretMap.filter((s) => !process.env[s.env]);
      if (stillMissing.length > 0) {
        this.platform.warning(
          `${stillMissing.length} secret(s) unavailable — deploy may fail`
        );
      }
    }
  }
}
