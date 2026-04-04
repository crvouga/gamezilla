import { spawnSync } from 'node:child_process';
import { BaseSetupCommand } from './base-command';
import { readTfOutputs } from '../deployment-pipeline-cli/tf-outputs';
import { LocalPlatform } from '../deployment-pipeline-cli/ci-platform-local';
import { SETUP_DNS_DOMAINS, CUSTOM_HTTPS_HOSTS } from './dns-config';
import { statusSym, statusRule } from './status-symbols';

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

    for (const { domain, outputKey } of SETUP_DNS_DOMAINS) {
      const expectedRaw = outputs[outputKey];
      if (!expectedRaw || expectedRaw === '') {
        console.log(statusRule(statusSym.skip, `${domain} NS`, `no ${outputKey} output`));
        continue;
      }

      const expected = parseNs(expectedRaw);
      const result = spawnSync('dig', ['NS', domain, '+short'], { encoding: 'utf-8' });
      if (result.status !== 0) {
        console.log(statusRule(statusSym.fail, `${domain} NS`, 'dig failed'));
        continue;
      }

      const actual = parseNs(result.stdout);
      if (actual.size === 0) {
        console.log(statusRule(statusSym.fail, `${domain} NS`, 'no records — delegation not configured'));
        continue;
      }

      const missing = [...expected].filter((ns) => !actual.has(ns));
      if (missing.length > 0) {
        console.log(statusRule(statusSym.fail, `${domain} NS`, `mismatch — missing: ${missing.join(', ')}`));
      } else {
        console.log(statusRule(statusSym.ok, `${domain} NS`, `${actual.size} records match`));
      }
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

function parseNs(raw: string): Set<string> {
  return new Set(
    raw
      .split(/[\n,]+/)
      .map((s) => s.trim().toLowerCase().replace(/\.$/, ''))
      .filter((s) => s.length > 0)
  );
}
