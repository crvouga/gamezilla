import type { Command } from '../command';
import type { CiPlatform } from '../platform';
import { banner, ok, fail, warn, kv, heading } from '../fmt';
import { PROJECT_CONFIG } from '../../project-config';
import { readTfOutputs } from '../lib/tf-outputs';

export class StatusCommand implements Command {
  readonly id = 'status';
  readonly summary = 'Infrastructure status dashboard';
  readonly group = 'main' as const;

  constructor(private readonly platform: CiPlatform) {}

  async execute(): Promise<void> {
    banner('Infrastructure Status');

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

    heading('Endpoints');
    const { domain } = PROJECT_CONFIG;
    const urls = [
      `https://www.${domain}`,
      `https://api.${domain}/health`,
    ];

    for (const url of urls) {
      try {
        const resp = Bun.spawnSync(
          ['curl', '-sI', '-o', '/dev/null', '-w', '%{http_code}', '--max-time', '10', url],
          { stdout: 'pipe', stderr: 'pipe' },
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
