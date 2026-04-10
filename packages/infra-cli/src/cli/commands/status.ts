import { PROJECT_CONFIG, turboCachePublicUrl } from '../../project-config';
import { ALL_DEPS } from '../deps/registry';
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
    const depFailures: string[] = [];
    for (const dep of ALL_DEPS) {
      const status = dep.check();
      if (!status.ok) {
        fail(dep.name, status.reason);
        depFailures.push(dep.name);
        continue;
      }
      ok(dep.name, status.version);
    }
    if (depFailures.length > 0) {
      warn(
        'Missing deps',
        `${depFailures.join(', ')} — run \`bun run infra setup\` to install`
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
      const result = await httpProbe(url, { timeoutS: 10 });
      if (result.status === 0) {
        fail(url, result.error ?? 'unreachable');
      } else if (result.ok) {
        ok(url, `HTTP ${result.status}`);
      } else {
        fail(url, `HTTP ${result.status}`);
      }
    }
  }
}
