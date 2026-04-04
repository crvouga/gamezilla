import { spawnSync } from 'node:child_process';
import { BaseSetupCommand } from './base-command';
import { readTfOutputs } from '../deployment-pipeline-cli/tf-outputs';
import { LocalPlatform } from '../deployment-pipeline-cli/ci-platform-local';
import { CUSTOM_HTTPS_HOSTS } from './dns-config';
import { statusSym, statusRule } from './status-symbols';
import { checkDnsDelegation } from './dns-delegation';

export class DomainsStatusCommand extends BaseSetupCommand {
  readonly id = 'domains-status';
  readonly summary = 'NS vs public, ACM, CF aliases, HTTPS probes';

  async execute(_argv?: string[]): Promise<void> {
    const platform = new LocalPlatform();
    let outputs: Record<string, string | undefined> = {};
    try {
      outputs = readTfOutputs(platform);
    } catch {
      console.log(statusRule(statusSym.warn, 'Terraform outputs', 'not available (run terraform apply first)'));
    }

    console.log('\n=== Domain Status ===\n');

    const delegation = checkDnsDelegation(outputs);
    for (const d of delegation.details) {
      const sym = d.delegated ? statusSym.ok : statusSym.fail;
      console.log(statusRule(sym, `${d.domain} NS`, d.message));
    }

    console.log('');
    for (const url of CUSTOM_HTTPS_HOSTS) {
      try {
        const resp = spawnSync('curl', ['-sI', '-o', '/dev/null', '-w', '%{http_code}', '--max-time', '10', url], { encoding: 'utf-8', timeout: 15_000 });
        if (resp.error) {
          console.log(statusRule(statusSym.fail, url, `spawn error: ${resp.error.message}`));
          continue;
        }
        if (resp.status !== 0 && resp.status !== null) {
          console.log(statusRule(statusSym.fail, url, `curl exited ${resp.status} (${(resp.stderr ?? '').trim() || 'unknown error'})`));
          continue;
        }
        const code = (resp.stdout ?? '').trim();
        if (!code || code.length === 0) {
          console.log(statusRule(statusSym.fail, url, 'curl returned no HTTP code'));
        } else if (code.startsWith('2') || code.startsWith('3')) {
          console.log(statusRule(statusSym.ok, url, `HTTP ${code}`));
        } else {
          console.log(statusRule(statusSym.fail, url, `HTTP ${code}`));
        }
      } catch (e) {
        console.log(statusRule(statusSym.fail, url, `unreachable: ${e instanceof Error ? e.message : String(e)}`));
      }
    }
  }
}
