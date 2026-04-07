import { assert } from '@gamezilla/shared/assert';
import { PROJECT_CONFIG } from '../../project-config';
import { ALL_DEPS } from '../deps/registry';
import { banner, fail as fmtFail, heading, info, ok, warn } from '../lib/fmt';
import { TF_DEPLOY_VAR_ARGS } from '../lib/tf-vars';
import { TF_PACKAGE_ROOT } from '../paths';
import type { CiPlatform } from '../platform/platform';
import { runStep } from '../platform/platform';
import { cfAccountId, cfHeaders } from '../secrets/cloudflare';
import {
  getSecretMap,
  loadSecretsIntoEnv,
  validateSecret,
} from '../secrets/secrets';
import { run, runSafe } from '../subprocess';
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

const STALE_STATE_ENTRIES = [
  'module.database.aws_rds_cluster.this',
  'module.database.aws_db_subnet_group.this',
  'module.database.aws_security_group.db',
  'module.database.random_password.db',
  'module.vpc.aws_subnet.private[0]',
  'module.vpc.aws_subnet.private[1]',
  'module.vpc.aws_vpc.this',
] as const;

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
      else
        fmtFail(
          s.env,
          'not found in Doppler — run `bun run infra secrets-setup`'
        );
    }
    const missing = secrets.filter((s) => !s.set);
    if (missing.length > 0) {
      this.platform.warning(
        `${missing.length} secret(s) missing — setup will continue but Terraform may fail`
      );
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

    // ── 4. Terraform init ───────────────────────────────────────────────
    heading('Terraform init');
    await runStep(this.platform, 'Terraform init', () =>
      run(this.platform, 'terraform', ['init', '-input=false'], {
        cwd: TF_PACKAGE_ROOT,
        label: 'Terraform init',
      })
    );

    // ── 5. Diagnose state health ────────────────────────────────────────
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

    // ── 6. Remove stale state entries ───────────────────────────────────
    heading('Repair state');
    for (const addr of STALE_STATE_ENTRIES) {
      if (this.stateHas(addr)) {
        info('Removing stale resource', addr);
        this.stateRm(addr);
        ok('Removed', addr);
      }
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
          run(
            this.platform,
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

    // ── 8. Full apply ───────────────────────────────────────────────────
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

  private ensureDeps(): void {
    for (const dep of ALL_DEPS) {
      const status = dep.check();

      if (!status.ok) {
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
        continue;
      }

      const before = status.version;
      info(dep.name, `${before} — upgrading…`);
      try {
        dep.upgrade();
      } catch {
        ok(dep.name, `${before} (upgrade skipped)`);
        continue;
      }
      const after = dep.check();
      const afterVersion = after.ok ? after.version : before;
      if (afterVersion !== before) {
        ok(dep.name, `${before} → ${afterVersion}`);
      } else {
        ok(dep.name, `${afterVersion} (latest)`);
      }

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

    for (const addr of STALE_STATE_ENTRIES) {
      if (this.stateHas(addr)) {
        results.push({
          label: addr,
          healthy: false,
          detail: 'stale — no longer in config, will be removed from state',
        });
      }
    }

    return results;
  }

  private stateHas(address: string): boolean {
    const r = runSafe('terraform', ['state', 'show', address], {
      cwd: TF_PACKAGE_ROOT,
    });
    return r.exitCode === 0;
  }

  private stateRm(address: string): void {
    run(this.platform, 'terraform', ['state', 'rm', address], {
      cwd: TF_PACKAGE_ROOT,
      label: `state rm ${address}`,
    });
  }
}
