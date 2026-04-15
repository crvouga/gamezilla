import { PROJECT_CONFIG, turboCachePublicUrl } from '../../project-config';
import { ALL_DEPS } from '../deps/registry';
import { collectDepVersionIssues } from '../deps/version-check';
import { banner, fail, heading, kv, ok, warn } from '../lib/fmt';
import { httpProbe } from '../lib/http-probe';
import { infraOutputs, type InfraOutputs } from '../lib/infra-outputs';
import type { CiPlatform } from '../platform/platform';
import type { Command } from './types';

export class StatusCommand implements Command {
  readonly id = 'status';
  readonly summary = 'Health dashboard: deps, infra outputs, endpoints';

  constructor(private readonly platform: CiPlatform) {}

  async execute(): Promise<void> {
    banner('Infrastructure Status');

    // ── 1. Dependencies ─────────────────────────────────────────────────
    heading('Dependencies');
    let failed = false;
    const depFailures: string[] = [];
    for (const dep of ALL_DEPS) {
      const r = await collectDepVersionIssues(dep);
      if (r.ok === true) {
        ok(dep.name, r.version);
        continue;
      }
      if (r.ok === 'unknown-latest') {
        warn(
          r.name,
          `${r.version} — could not resolve latest (offline or network)`,
        );
        continue;
      }
      if (r.issue.kind === 'missing') {
        fail(r.issue.name, r.issue.reason);
        depFailures.push(r.issue.name);
        failed = true;
        continue;
      }
      fail(
        r.issue.name,
        `outdated ${r.issue.current} — latest is ${r.issue.latest}`,
      );
      depFailures.push(r.issue.name);
      failed = true;
    }
    if (depFailures.length > 0) {
      warn(
        'Dependency issues',
        `${depFailures.join(', ')} — run \`bun run infra setup\` to install or upgrade`,
      );
    }

    // ── 2. Infra Outputs ────────────────────────────────────────────────
    heading('Infra Outputs');
    const outputs: InfraOutputs = infraOutputs({});
    for (const [k, v] of Object.entries(outputs)) {
      if (v) kv(k, v);
    }

    // ── 3. Endpoints ────────────────────────────────────────────────────
    heading('Endpoints');
    const { domain } = PROJECT_CONFIG;
    const urls = [
      `https://www.${domain}`,
      `https://api.${domain}/health`,
      `${turboCachePublicUrl()}/health`,
    ];

    for (const url of urls) {
      const result = await httpProbe(url, 10_000);
      if (result.status === 0) {
        fail(url, result.error ?? 'unreachable');
        failed = true;
      } else if (result.ok) {
        ok(url, `HTTP ${result.status}`);
      } else {
        fail(url, `HTTP ${result.status}`);
        failed = true;
      }
    }

    if (failed) process.exit(1);
  }
}
