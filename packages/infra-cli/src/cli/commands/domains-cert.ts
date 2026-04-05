import type { Command } from '../command';
import type { CiPlatform } from '../platform';
import { banner, heading, ok, fail } from '../fmt';
import { ensureAwsEnvCredentials } from '../lib/aws-creds';
import { checkDnsDelegation } from '../lib/dns';
import { readTfOutputs } from '../lib/tf-outputs';
import { TF_PACKAGE_ROOT } from '../paths';
import { runLocal } from '../subprocess';
import { LocalPlatform } from '../platform';

export class DomainsCertCommand implements Command {
  readonly id = 'domains-cert';
  readonly summary = 'Verify NS delegation + create ACM certificate';
  readonly group = 'domains' as const;

  constructor(private readonly platform: CiPlatform) {}

  async execute(): Promise<void> {
    banner('Domains Certificate');

    ensureAwsEnvCredentials();
    const localPlatform = this.platform instanceof LocalPlatform ? this.platform : new LocalPlatform();

    let outputs: Record<string, string | undefined>;
    try {
      outputs = readTfOutputs(localPlatform);
    } catch (e) {
      throw new Error(
        `Could not read Terraform outputs. Run "bun run infra domains-setup" first.\n` +
        `Details: ${e instanceof Error ? e.message : String(e)}`,
      );
    }

    heading('DNS Delegation Check');
    const delegation = checkDnsDelegation(outputs);
    if (!delegation.delegated) {
      const problems = delegation.details
        .filter((d) => !d.delegated)
        .map((d) => `${d.domain}: ${d.message}`)
        .join('\n  ');
      for (const d of delegation.details) {
        if (!d.delegated) fail(`${d.domain} NS`, d.message);
      }
      throw new Error(`DNS delegation check failed:\n  ${problems}\nUpdate registrar nameservers and retry.`);
    }

    for (const d of delegation.details) {
      ok(`${d.domain} NS`, 'records match Route 53');
    }

    heading('Terraform Apply (full mode)');
    runLocal('terraform', ['init', '-input=false', '-reconfigure'], { cwd: TF_PACKAGE_ROOT });
    runLocal('terraform', [
      'apply', '-auto-approve', '-input=false', '-lock-timeout=120s',
      '-var', 'custom_domain=true',
      '-var', 'custom_domain_bootstrap=false',
    ], { cwd: TF_PACKAGE_ROOT });

    ok('Domains finalized', 'ACM certificate + CloudFront aliases active');
  }
}
