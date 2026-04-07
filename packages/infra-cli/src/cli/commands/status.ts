import { PROJECT_CONFIG } from '../../project-config';
import { ALL_DEPS } from '../deps/deps';
import { banner, fail, heading, kv, ok, warn } from '../lib/fmt';
import { readTfOutputs } from '../lib/tf-outputs';
import type { CiPlatform } from '../platform/platform';
import type { Command } from './types';

export class StatusCommand implements Command {
  readonly id = 'status';
  readonly summary = 'Health dashboard: deps, terraform outputs, endpoints';

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

      if (dep.verify) {
        try {
          dep.verify();
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          fail(`${dep.name} verify`, msg);
          depFailures.push(dep.name);
        }
      }
    }
    if (depFailures.length > 0) {
      warn(
        'Missing deps',
        `${depFailures.join(', ')} — run \`bun run infra setup\` to install`
      );
    }

    // ── 2. Terraform Outputs ────────────────────────────────────────────
    heading('Terraform Outputs');
    try {
      const outputs = readTfOutputs(this.platform);
      const keys = Object.keys(outputs);
      ok('Terraform outputs', `${keys.length} outputs`);
      for (const [k, v] of Object.entries(outputs)) {
        if (v) kv(k, v);
      }
    } catch {
      warn('Terraform outputs', 'not available');
    }

    // ── 3. Endpoints ────────────────────────────────────────────────────
    heading('Endpoints');
    const { domain } = PROJECT_CONFIG;
    const urls = [`https://www.${domain}`, `https://api.${domain}/health`];

    for (const url of urls) {
      try {
        const resp = Bun.spawnSync(
          [
            'curl',
            '-sI',
            '-o',
            '/dev/null',
            '-w',
            '%{http_code}',
            '--max-time',
            '10',
            url,
          ],
          { stdout: 'pipe', stderr: 'pipe' }
        );
        if (resp.exitCode !== 0) {
          fail(url, `curl exited ${resp.exitCode}`);
          continue;
        }
        const code = resp.stdout.toString().trim();
        if (code.startsWith('2') || code.startsWith('3')) {
          ok(url, `HTTP ${code}`);
        } else {
          fail(url, `HTTP ${code}`);
        }
      } catch (e) {
        fail(url, `unreachable: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }
}
