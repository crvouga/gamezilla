import { assert } from '@gamezilla/shared/assert';
import type { Command } from '../command';
import { banner, heading, ok, warn, fail as fmtFail, info, fmt } from '../fmt';
import type { CiPlatform } from '../platform';
import { runStep } from '../platform';
import { run, runSafe } from '../subprocess';
import { getSecretMap, loadSecretsIntoEnv, validateSecret } from '../secrets';
import { TF_DEPLOY_VAR_ARGS } from '../lib/tf-vars';
import { TF_PACKAGE_ROOT } from '../paths';
import { PROJECT_CONFIG } from '../../project-config';

interface ImportableResource {
  readonly address: string;
  readonly lookupId: () => Promise<string | null>;
}

/**
 * Resources that must exist before anything that references them can be
 * refreshed.  Each entry is a Terraform address + a way to look up whether
 * the resource already exists in the upstream provider so we can import
 * rather than create.
 */
const FOUNDATION_RESOURCES: readonly ImportableResource[] = [
  {
    address: 'cloudflare_zone.main',
    lookupId: async () => {
      const token = process.env['CLOUDFLARE_API_TOKEN'];
      if (!token) return null;
      try {
        const res = await fetch(
          `https://api.cloudflare.com/client/v4/zones?name=${PROJECT_CONFIG.domain}&per_page=1`,
          { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } },
        );
        if (!res.ok) return null;
        const body = (await res.json()) as { result?: Array<{ id: string }> };
        return body.result?.[0]?.id ?? null;
      } catch {
        return null;
      }
    },
  },
];

/**
 * Known Terraform state entries that may reference foundation resources.
 * If a foundation resource doesn't exist yet **and** these entries are
 * already in state, refreshing them will 500 / fail.  We remove them
 * from state so the targeted apply can succeed, then let the full apply
 * recreate them cleanly.
 */
const ORPHAN_STATE_ENTRIES = [
  'module.cloudflare_pages.cloudflare_pages_domain.apex[0]',
  'module.cloudflare_pages.cloudflare_pages_domain.www[0]',
] as const;

/**
 * State entries from previous Terraform configs that no longer exist in the
 * current code.  If left in state, Terraform tries to destroy them (which
 * can fail — e.g. RDS deletion protection).  We unconditionally remove
 * these from state when found.
 */
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

export class BootstrapCommand implements Command {
  readonly id = 'bootstrap';
  readonly summary = 'Self-healing init: secrets, state repair, targeted applies';
  readonly group = 'main' as const;

  constructor(private readonly platform: CiPlatform) {}

  async execute(): Promise<void> {
    banner('Bootstrap');

    // ── 1. Secrets ──────────────────────────────────────────────────────
    heading('Load secrets');
    const secrets = loadSecretsIntoEnv();
    for (const s of secrets) {
      if (s.set) ok(s.env);
      else fmtFail(s.env, 'not found in Doppler — run `bun run infra setup-secrets`');
    }
    const missing = secrets.filter((s) => !s.set);
    if (missing.length > 0) {
      this.platform.warning(
        `${missing.length} secret(s) missing — bootstrap will continue but Terraform may fail`,
      );
    }

    // ── 2. Validate secrets ─────────────────────────────────────────────
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
      'Secret validation failed — fix the issues above before continuing',
    );

    // ── 3. Terraform init ───────────────────────────────────────────────
    heading('Terraform init');
    await runStep(this.platform, 'Terraform init', () =>
      run(this.platform, 'terraform', ['init', '-input=false'], {
        cwd: TF_PACKAGE_ROOT,
        label: 'Terraform init',
      }),
    );

    // ── 4. Diagnose state health ────────────────────────────────────────
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

    // ── 5. Remove stale + orphaned state entries ──────────────────────
    heading('Repair state');
    for (const addr of STALE_STATE_ENTRIES) {
      if (this.stateHas(addr)) {
        info('Removing stale resource', addr);
        this.stateRm(addr);
        ok('Removed', addr);
      }
    }
    for (const addr of ORPHAN_STATE_ENTRIES) {
      if (this.stateHas(addr)) {
        info('Removing orphan', addr);
        this.stateRm(addr);
        ok('Removed', addr);
      }
    }

    // ── 6. Import or targeted-apply foundation resources ─────────────────
    heading('Foundation resources');
    for (const res of FOUNDATION_RESOURCES) {
      if (this.stateHas(res.address)) continue;

      const existingId = await res.lookupId();
      if (existingId) {
        info('Importing', `${res.address} (id: ${existingId})`);
        await runStep(this.platform, `Import ${res.address}`, () =>
          run(
            this.platform,
            'terraform',
            ['import', '-lock-timeout=120s', ...TF_DEPLOY_VAR_ARGS, res.address, existingId],
            { cwd: TF_PACKAGE_ROOT, label: `Import ${res.address}` },
          ),
        );
      } else {
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
            { cwd: TF_PACKAGE_ROOT, label: `Apply ${res.address}` },
          ),
        );
      }
    }

    // ── 7. Full apply ───────────────────────────────────────────────────
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
        { cwd: TF_PACKAGE_ROOT, label: 'Terraform apply' },
      ),
    );

    banner('Bootstrap Complete');
    ok('Infrastructure is healthy');
    info('Next step', 'Run `bun run infra deploy` for a full deploy with app deployment');
  }

  // ── Helpers ──────────────────────────────────────────────────────────

  /**
   * Probe the state for common chicken-and-egg problems.
   * Returns a list of diagnostics describing what we found.
   */
  private async diagnoseState(): Promise<DiagnosticResult[]> {
    const results: DiagnosticResult[] = [];

    for (const res of FOUNDATION_RESOURCES) {
      const inState = this.stateHas(res.address);
      if (inState) {
        results.push({ label: res.address, healthy: true, detail: 'exists in state' });
        continue;
      }
      const upstreamId = await res.lookupId();
      results.push({
        label: res.address,
        healthy: false,
        detail: upstreamId
          ? `missing from state but exists upstream (${upstreamId}) — will import`
          : 'missing from state and not found upstream — will create',
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

    for (const addr of ORPHAN_STATE_ENTRIES) {
      const exists = this.stateHas(addr);
      const foundationMissing = results.some((r) => !r.healthy);

      if (exists && foundationMissing) {
        results.push({
          label: addr,
          healthy: false,
          detail: 'in state but depends on missing foundation — will be removed',
        });
      } else if (exists) {
        results.push({ label: addr, healthy: true, detail: 'exists in state' });
      } else {
        results.push({
          label: addr,
          healthy: true,
          detail: 'not in state (will be created on next full apply)',
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
