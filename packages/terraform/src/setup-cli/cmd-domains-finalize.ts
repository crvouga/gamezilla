import { spawnSync } from 'node:child_process';
import { BaseSetupCommand } from './base-command';
import { getTfPackageRoot, runLocal } from './shared';
import { readTfOutputs } from '../deployment-pipeline-cli/tf-outputs';
import { LocalPlatform } from '../deployment-pipeline-cli/ci-platform-local';
import { SETUP_DNS_DOMAINS } from './dns-config';

export class DomainsFinalizeCommand extends BaseSetupCommand {
  readonly id = 'domains-finalize';
  readonly summary = 'Verify public NS, then phase 2 ACM + aliases';

  async execute(): Promise<void> {
    const platform = new LocalPlatform();
    let outputs: Record<string, string | undefined>;
    try {
      outputs = readTfOutputs(platform);
    } catch (e) {
      throw new Error(
        `Could not read Terraform outputs. Run "bun run setup domains-bootstrap" first.\n` +
        `Details: ${e instanceof Error ? e.message : String(e)}`
      );
    }

    for (const { domain, outputKey } of SETUP_DNS_DOMAINS) {
      const expectedRaw = outputs[outputKey];
      if (!expectedRaw || expectedRaw === '') {
        throw new Error(`Output ${outputKey} is empty. Run "bun run setup domains-bootstrap" first.`);
      }

      const expected = parseNs(expectedRaw);
      const result = spawnSync('dig', ['NS', domain, '+short'], { encoding: 'utf-8' });
      if (result.error) {
        throw new Error(`dig NS ${domain} — could not spawn: ${result.error.message}. Is "dig" installed?`);
      }
      if (result.status !== null && result.status !== 0) {
        throw new Error(`dig NS ${domain} failed (exit ${result.status})`);
      }

      const actual = parseNs(result.stdout);
      if (actual.size === 0) {
        throw new Error(`${domain}: no NS records found. Delegation not configured at registrar.`);
      }

      const missing = [...expected].filter((ns) => !actual.has(ns));
      if (missing.length > 0) {
        throw new Error(`${domain}: NS mismatch — missing: ${missing.join(', ')}. Update registrar nameservers.`);
      }

      console.log(`✓ ${domain} NS records match Route 53.`);
    }

    const tfRoot = getTfPackageRoot();
    runLocal('terraform', ['init', '-input=false', '-reconfigure'], { cwd: tfRoot });
    runLocal('terraform', [
      'apply', '-auto-approve', '-input=false', '-lock-timeout=120s',
      '-var', 'custom_domain=true',
      '-var', 'custom_domain_bootstrap=false',
    ], { cwd: tfRoot });

    console.log('\nDomains finalized: ACM certificate + CloudFront aliases active.');
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
