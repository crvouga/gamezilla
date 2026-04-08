import { assert } from '@gamezilla/shared/assert';
import { createInterface } from 'node:readline/promises';
import { PROJECT_CONFIG } from '../../project-config';
import { ALL_DEPS } from '../deps/registry';
import { ensureR2Enabled } from '../lib/ensure-r2';
import {
  banner,
  fmt,
  fail as fmtFail,
  heading,
  info,
  ok,
  warn,
} from '../lib/fmt';
import { resolveDatabaseUrl } from '../lib/resolve-database-url';
import { TF_DEPLOY_VAR_ARGS } from '../lib/tf-vars';
import { TF_PACKAGE_ROOT } from '../paths';
import type { CiPlatform } from '../platform/platform';
import { runStep } from '../platform/platform';
import { cfAccountId, cfHeaders } from '../secrets/cloudflare';
import {
  getSecretMap,
  loadSecretsIntoEnv,
  setDopplerSecret,
  validateSecret,
} from '../secrets/secrets';
import { run, runQuiet, runSafe } from '../subprocess';
import type { Command } from './types';

interface ImportableResource {
  readonly address: string;
  readonly foundation?: boolean;
  readonly lookupId: () => Promise<string | null>;
}

const IMPORTABLE_RESOURCES: readonly ImportableResource[] = [
  {
    address: 'cloudflare_zone.main',
    foundation: true,
    lookupId: async () => {
      if (!process.env['CLOUDFLARE_API_TOKEN']) return null;
      try {
        const res = await fetch(
          `https://api.cloudflare.com/client/v4/zones?name=${PROJECT_CONFIG.domain}&per_page=1`,
          { headers: cfHeaders() }
        );
        if (!res.ok) return null;
        const body = (await res.json()) as { result?: Array<{ id: string }> };
        return body.result?.[0]?.id ?? null;
      } catch {
        return null;
      }
    },
  },
  {
    address: 'module.cloudflare_pages.cloudflare_pages_domain.apex[0]',
    lookupId: async () => {
      if (!process.env['CLOUDFLARE_API_TOKEN'] || !cfAccountId()) return null;
      try {
        const res = await fetch(
          `https://api.cloudflare.com/client/v4/accounts/${cfAccountId()}/pages/projects/${PROJECT_CONFIG.cloudflare.pagesProject}/domains/${PROJECT_CONFIG.domain}`,
          { headers: cfHeaders() }
        );
        if (!res.ok) return null;
        return `${cfAccountId()}/${PROJECT_CONFIG.cloudflare.pagesProject}/${PROJECT_CONFIG.domain}`;
      } catch {
        return null;
      }
    },
  },
  {
    address: 'module.cloudflare_pages.cloudflare_pages_domain.www[0]',
    lookupId: async () => {
      if (!process.env['CLOUDFLARE_API_TOKEN'] || !cfAccountId()) return null;
      try {
        const res = await fetch(
          `https://api.cloudflare.com/client/v4/accounts/${cfAccountId()}/pages/projects/${PROJECT_CONFIG.cloudflare.pagesProject}/domains/www.${PROJECT_CONFIG.domain}`,
          { headers: cfHeaders() }
        );
        if (!res.ok) return null;
        return `${cfAccountId()}/${PROJECT_CONFIG.cloudflare.pagesProject}/www.${PROJECT_CONFIG.domain}`;
      } catch {
        return null;
      }
    },
  },
];

interface DiagnosticResult {
  readonly label: string;
  readonly healthy: boolean;
  readonly detail: string;
}

export class SetupCommand implements Command {
  readonly id = 'setup';
  readonly summary =
    'Self-healing init: deps, secrets, state repair, targeted applies';

  constructor(private readonly platform: CiPlatform) {}

  async execute(): Promise<void> {
    banner('Setup');

    // ── 1. Dependencies ─────────────────────────────────────────────────
    heading('Dependencies');
    this.ensureDeps();

    // ── 2. Secrets ──────────────────────────────────────────────────────
    heading('Load secrets');
    const secrets = loadSecretsIntoEnv();
    for (const s of secrets) {
      if (s.set) ok(s.env);
      else fmtFail(s.env, 'not found in Doppler');
    }

    const missingEnvs = new Set(
      secrets.filter((s) => !s.set).map((s) => s.env)
    );
    if (missingEnvs.size > 0) {
      await this.promptForMissingSecrets(missingEnvs);
    }

    // ── 3. Validate secrets ─────────────────────────────────────────────
    heading('Validate secrets');
    const secretMap = getSecretMap();
    let validationFailed = false;
    for (const entry of secretMap) {
      const value = process.env[entry.env];
      if (!value) continue;
      const err = await validateSecret(entry, value);
      if (err) {
        fmtFail(entry.doppler, err);
        validationFailed = true;
      } else {
        ok(entry.doppler);
      }
    }
    assert.ok(
      !validationFailed,
      'Secret validation failed — fix the issues above before continuing'
    );

    // ── 4. R2 activation ──────────────────────────────────────────────
    heading('R2 activation');
    await runStep(this.platform, 'Ensure R2 enabled', () =>
      ensureR2Enabled(
        this.platform,
        cfAccountId(),
        process.env['CLOUDFLARE_API_TOKEN'] ?? ''
      )
    );

    // ── 5. Resolve DATABASE_URL from PlanetScale ─────────────────────
    heading('Database');
    await runStep(this.platform, 'Resolve DATABASE_URL', async () => {
      const url = await resolveDatabaseUrl();
      ok('DATABASE_URL', url.replace(/\/\/[^@]+@/, '//***:***@'));
    });

    // ── 5. Terraform init ───────────────────────────────────────────────
    heading('Terraform init');
    await runStep(this.platform, 'Terraform init', () =>
      run(this.platform, 'terraform', ['init', '-input=false'], {
        cwd: TF_PACKAGE_ROOT,
        label: 'Terraform init',
      })
    );

    // ── 6. Diagnose state health ────────────────────────────────────────
    heading('Diagnose state');
    const diagnostics = await this.diagnoseState();
    for (const d of diagnostics) {
      if (d.healthy) ok(d.label, d.detail);
      else warn(d.label, d.detail);
    }

    const needsRepair = diagnostics.some((d) => !d.healthy);
    if (!needsRepair) {
      ok('State is healthy', 'no repair needed');
      info('Tip', 'Run `bun run infra deploy` to do a full deploy');
      return;
    }

    // ── 7. Import / create missing resources ────────────────────────────
    heading('Reconcile resources');
    const sorted = [
      ...IMPORTABLE_RESOURCES.filter((r) => r.foundation),
      ...IMPORTABLE_RESOURCES.filter((r) => !r.foundation),
    ];
    for (const res of sorted) {
      if (this.stateHas(res.address)) continue;

      const existingId = await res.lookupId();
      if (existingId) {
        info('Importing', `${res.address}`);
        await runStep(this.platform, `Import ${res.address}`, () =>
          run(
            this.platform,
            'terraform',
            [
              'import',
              '-lock-timeout=120s',
              ...TF_DEPLOY_VAR_ARGS,
              res.address,
              existingId,
            ],
            { cwd: TF_PACKAGE_ROOT, label: `Import ${res.address}` }
          )
        );
      } else if (res.foundation) {
        info('Creating', res.address);
        await runStep(this.platform, `Apply ${res.address}`, () =>
          runQuiet(
            'terraform',
            [
              'apply',
              '-auto-approve',
              '-input=false',
              '-lock-timeout=120s',
              `-target=${res.address}`,
              ...TF_DEPLOY_VAR_ARGS,
            ],
            { cwd: TF_PACKAGE_ROOT, label: `Apply ${res.address}` }
          )
        );
      } else {
        info(
          'Will be created',
          `${res.address} (not found upstream, full apply will handle it)`
        );
      }
    }

    // ── 9. Full apply ───────────────────────────────────────────────────
    heading('Full apply');
    await runStep(this.platform, 'Terraform apply', () =>
      run(
        this.platform,
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

    banner('Setup Complete');
    ok('Infrastructure is healthy');
    info('Next step', 'Run `bun run infra deploy` for a full deploy');
  }

  // ── Helpers ──────────────────────────────────────────────────────────

  private async promptForMissingSecrets(
    missingEnvs: Set<string>
  ): Promise<void> {
    const secretMap = getSecretMap();
    const missing = secretMap.filter((s) => missingEnvs.has(s.env));
    if (missing.length === 0) return;

    if (process.env['CI']) {
      this.platform.warning(
        `${missing.length} secret(s) missing — cannot prompt in CI`
      );
      return;
    }

    info('tip', 'leave blank to skip a secret');
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    try {
      let set = 0;
      for (const s of missing) {
        console.log('');
        console.log(`  ${fmt.bold(s.doppler)}`);
        console.log(`  ${fmt.dim(s.hint)}`);
        const value = await rl.question(`  ${fmt.cyan('value:')} `);
        const trimmed = value.trim();

        if (trimmed === '') {
          info(s.doppler, 'skipped');
          continue;
        }

        const error = await validateSecret(s, trimmed);
        if (error !== null) {
          fmtFail(s.doppler, error);
          continue;
        }

        setDopplerSecret(s.doppler, trimmed);
        process.env[s.env] = trimmed;
        ok(s.doppler, 'saved to Doppler');
        set++;
      }

      console.log('');
      info('done', `${set} secret(s) added, ${missing.length - set} skipped`);
    } finally {
      rl.close();
    }
  }

  private ensureDeps(): void {
    for (const dep of ALL_DEPS) {
      const status = dep.check();

      if (status.ok) {
        ok(dep.name, status.version);
        continue;
      }

      warn(dep.name, status.reason);
      info(dep.name, 'installing…');
      try {
        dep.install();
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        fmtFail(dep.name, `install failed — ${msg}`);
        assert.fail(`setup: could not install ${dep.name}`);
      }
      const after = dep.check();
      if (!after.ok) {
        fmtFail(dep.name, `still not available — ${after.reason}`);
        assert.fail(`setup: ${dep.name} not available after install`);
      }
      ok(dep.name, `installed (${after.version})`);

      if (dep.verify) dep.verify();
    }
  }

  private async diagnoseState(): Promise<DiagnosticResult[]> {
    const results: DiagnosticResult[] = [];

    for (const res of IMPORTABLE_RESOURCES) {
      const inState = this.stateHas(res.address);
      if (inState) {
        results.push({
          label: res.address,
          healthy: true,
          detail: 'exists in state',
        });
        continue;
      }
      const upstreamId = await res.lookupId();
      results.push({
        label: res.address,
        healthy: false,
        detail: upstreamId
          ? 'missing from state but exists upstream — will import'
          : 'missing — will be created',
      });
    }

    return results;
  }

  private stateHas(address: string): boolean {
    const r = runSafe('terraform', ['state', 'show', address], {
      cwd: TF_PACKAGE_ROOT,
    });
    return r.exitCode === 0;
  }
}
