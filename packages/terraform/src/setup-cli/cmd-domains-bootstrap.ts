import { BaseSetupCommand } from './base-command';
import { getTfPackageRoot, runLocal } from './shared';
import { readTfOutputs } from '../deployment-pipeline-cli/tf-outputs';
import { LocalPlatform } from '../deployment-pipeline-cli/ci-platform-local';
import { SETUP_DNS_DOMAINS } from './dns-config';

export class DomainsBootstrapCommand extends BaseSetupCommand {
  readonly id = 'domains-bootstrap';
  readonly summary = 'Terraform phase 1: zones + NS outputs';

  async execute(): Promise<void> {
    const tfRoot = getTfPackageRoot();

    runLocal('terraform', ['init', '-input=false', '-reconfigure'], { cwd: tfRoot });
    runLocal('terraform', [
      'apply', '-auto-approve', '-input=false', '-lock-timeout=120s',
      '-var', 'custom_domain=true',
      '-var', 'custom_domain_bootstrap=true',
    ], { cwd: tfRoot });

    const platform = new LocalPlatform();
    const outputs = readTfOutputs(platform);

    console.log('\n=== Domain Bootstrap Complete ===');
    console.log('Set these nameservers at your domain registrar, then run: bun run setup domains-finalize\n');

    for (const { domain, outputKey } of SETUP_DNS_DOMAINS) {
      const ns = outputs[outputKey];
      if (ns && ns !== '') {
        console.log(`  ${domain}:`);
        for (const s of ns.split(',').map((s) => s.trim()).filter(Boolean)) {
          console.log(`    ${s}`);
        }
      }
    }
  }
}
