import { PROJECT_CONFIG } from '../../project-config';
import {
  ClientDeployable,
  TurboCacheDeployable,
  WorkersDeployable,
} from '../lib/deploy-registry';
import { ensureR2Enabled } from '../lib/ensure-r2';
import { banner, ok } from '../lib/fmt';
import { resolveDatabaseUrl } from '../lib/resolve-database-url';
import { runHttpSmokeTests } from '../lib/smoke-tests';
import { readTfOutputs, requireOutput } from '../lib/tf-outputs';
import { TF_DEPLOY_VAR_ARGS } from '../lib/tf-vars';
import { TF_PACKAGE_ROOT } from '../paths';
import type { CiPlatform } from '../platform/platform';
import { runStep } from '../platform/platform';
import { cfAccountId } from '../secrets/cloudflare';
import {
  fetchDopplerSecret,
  getSecretMap,
  setDopplerSecret,
  validateSecret,
} from '../secrets/secrets';
import { runAsync, runCaptureAsync } from '../subprocess';
import type { Command } from './types';

export class DeployCommand implements Command {
  readonly id = 'deploy';
  readonly summary =
    'Full idempotent deploy: validate → terraform → apps → smoke tests';

  constructor(private readonly platform: CiPlatform) {}

  async execute(): Promise<void> {
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

    // ── 4. R2 activation ──────────────────────────────────────────────
    await runStep(p, 'Ensure R2 enabled', () =>
      ensureR2Enabled(p, cfAccountId(), process.env['CLOUDFLARE_API_TOKEN'] ?? '')
    );

    // ── 5. Resolve DATABASE_URL ─────────────────────────────────────────
    await runStep(p, 'Resolve DATABASE_URL', async () => {
      const url = await resolveDatabaseUrl();
      ok('DATABASE_URL', url.replace(/\/\/[^@]+@/, '//***:***@'));
    });

    // ── 5. Terraform init ───────────────────────────────────────────────
    await runStep(p, 'Terraform init', () =>
      runAsync(p, 'terraform', ['init', '-input=false'], {
        cwd: TF_PACKAGE_ROOT,
        label: 'Terraform init',
      })
    );

    // ── 6. Terraform validate ───────────────────────────────────────────
    await runStep(p, 'Terraform validate', () =>
      runAsync(p, 'terraform', ['validate'], {
        cwd: TF_PACKAGE_ROOT,
        label: 'Terraform validate',
      })
    );

    // ── 7. Terraform apply ──────────────────────────────────────────────
    await runStep(p, 'Terraform apply', () =>
      runAsync(
        p,
        'terraform',
        [
          'apply',
          '-auto-approve',
          '-input=false',
          '-lock-timeout=120s',
          ...TF_DEPLOY_VAR_ARGS,
        ],
        { cwd: TF_PACKAGE_ROOT, label: 'Terraform apply' }
      )
    );

    // ── 8. Read TF outputs ──────────────────────────────────────────────
    const outputs = await runStep(p, 'Read TF outputs', () => readTfOutputs(p));

    // ── 9. Deploy turbo-cache ───────────────────────────────────────────
    await runStep(p, 'Deploy: turbo-cache', () =>
      new TurboCacheDeployable(p).deploy({})
    );

    // ── 10. Deploy workers-api ──────────────────────────────────────────
    await runStep(p, 'Deploy: workers-api', () =>
      new WorkersDeployable(p).deploy({})
    );

    // ── 11. Deploy client ───────────────────────────────────────────────
    await runStep(p, 'Deploy: client', () =>
      new ClientDeployable(p).deploy(outputs)
    );

    // ── 12. Smoke tests ─────────────────────────────────────────────────
    await runStep(p, 'Smoke tests', () => runHttpSmokeTests(p, outputs));

    // ── Done ─────────────────────────────────────────────────────────────
    banner('Deploy Complete');
    for (const key of ['client_url', 'api_url'] as const) {
      try {
        ok(key, requireOutput(p, outputs, key));
      } catch {
        /* output not available */
      }
    }

    this.writeSummary(outputs);
  }

  private writeSummary(outputs: Record<string, string | undefined>): void {
    const services = [
      { label: 'Client', key: 'client_url' },
      { label: 'API (Workers)', key: 'api_url' },
    ] as const;

    const rows = services
      .map((s) => `| **${s.label}** | ${outputs[s.key] ?? '_(unavailable)_'} |`)
      .join('\n');

    const ns = outputs['cloudflare_nameservers'] ?? '_(unavailable)_';

    this.platform.appendJobSummary(`## Deployment Complete

| Service | URL |
|---------|-----|
${rows}

### Squarespace Nameserver Setup (one-time)

Point your domain to Cloudflare in [Squarespace Domains](https://domains.squarespace.com):

**Nameservers:** \`${ns}\`

> DNS records and the apex-to-www redirect are managed by Cloudflare via Terraform.
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

    this.ensureDopplerDefaults();

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

  /**
   * Populate Doppler with default values for config that can be derived
   * automatically (turbo cache URL, team slug, bearer token, log order).
   */
  private ensureDopplerDefaults(): void {
    const defaults: Record<string, () => string> = {
      TURBO_TOKEN: () => crypto.randomUUID(),
      TURBO_API: () => `https://turbo-cache.${PROJECT_CONFIG.domain}`,
      TURBO_TEAM: () => `team_${PROJECT_CONFIG.domain.replace(/\.\w+$/, '')}`,
      TURBO_LOG_ORDER: () => 'stream',
    };

    for (const [key, generate] of Object.entries(defaults)) {
      if (process.env[key]) continue;

      const value = generate();
      process.env[key] = value;

      try {
        setDopplerSecret(key, value);
        ok(key, 'populated in Doppler');
      } catch {
        ok(key, 'set in env (Doppler save skipped)');
      }
    }
  }
}
