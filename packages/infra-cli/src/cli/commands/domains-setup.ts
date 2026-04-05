import type { Command } from '../command';
import type { CiPlatform } from '../platform';
import { banner, heading, ok } from '../fmt';
import { ensureAwsEnvCredentials } from '../lib/aws-creds';
import { DNS_DOMAINS } from '../lib/dns';
import { readTfOutputs } from '../lib/tf-outputs';
import { TF_PACKAGE_ROOT } from '../paths';
import { runLocal } from '../subprocess';
import { LocalPlatform } from '../platform';

export class DomainsSetupCommand implements Command {
  readonly id = 'domains-setup';
  readonly summary = 'Create Route 53 zone (NS bootstrap)';
  readonly group = 'domains' as const;

  constructor(private readonly platform: CiPlatform) {}

  async execute(): Promise<void> {
    banner('Domains Setup');

    ensureAwsEnvCredentials();

    heading('Terraform Apply (bootstrap mode)');
    runLocal('terraform', ['init', '-input=false', '-reconfigure'], { cwd: TF_PACKAGE_ROOT });
    runLocal('terraform', [
      'apply', '-auto-approve', '-input=false', '-lock-timeout=120s',
      '-var', 'custom_domain=true',
      '-var', 'custom_domain_bootstrap=true',
    ], { cwd: TF_PACKAGE_ROOT });

    const localPlatform = this.platform instanceof LocalPlatform ? this.platform : new LocalPlatform();
    const outputs = readTfOutputs(localPlatform);

    heading('Registrar Nameservers');
    console.log('Set these nameservers at your domain registrar, then run: bun run infra domains-cert\n');

    for (const { domain, outputKey } of DNS_DOMAINS) {
      const ns = outputs[outputKey];
      if (ns && ns !== '') {
        console.log(`  ${domain}:`);
        for (const s of ns.split(',').map((s) => s.trim()).filter(Boolean)) {
          console.log(`    ${s}`);
        }
      }
    }

    ok('Domain bootstrap complete');
  }
}
