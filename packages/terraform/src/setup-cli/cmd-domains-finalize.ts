import { BaseSetupCommand } from './base-command';
import { getTfPackageRoot, runLocal } from './shared';
import { readTfOutputs } from '../deployment-pipeline-cli/tf-outputs';
import { LocalPlatform } from '../deployment-pipeline-cli/ci-platform-local';
import { checkDnsDelegation } from './dns-delegation';

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

    const delegation = checkDnsDelegation(outputs);
    if (!delegation.delegated) {
      const problems = delegation.details
        .filter((d) => !d.delegated)
        .map((d) => `${d.domain}: ${d.message}`)
        .join('\n  ');
      throw new Error(`DNS delegation check failed:\n  ${problems}\nUpdate registrar nameservers and retry.`);
    }

    for (const d of delegation.details) {
      console.log(`✓ ${d.domain} NS records match Route 53.`);
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
