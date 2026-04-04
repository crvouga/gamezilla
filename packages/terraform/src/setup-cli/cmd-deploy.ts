import { BaseSetupCommand } from './base-command';
import { LocalPlatform } from '../deployment-pipeline-cli/ci-platform-local';
import { DeployCommand } from '../deployment-pipeline-cli/cmd-deploy';
import { DeployAppsCommand } from '../deployment-pipeline-cli/cmd-deploy-apps';
import { runHttpSmokeTestsOnly } from '../deployment-pipeline-cli/cmd-post-deploy';
import { readTfOutputs, requireOutput, type TfOutputs } from '../deployment-pipeline-cli/tf-outputs';
import { PROJECT_CONFIG } from '../project-config';
import { checkDnsDelegation } from './dns-delegation';
import { SETUP_DNS_DOMAINS } from './dns-config';

export class SetupDeployCommand extends BaseSetupCommand {
  readonly id = 'deploy';
  readonly summary = 'Full deploy: terraform apply + apps + HTTP smoke';

  async execute(): Promise<void> {
    process.env['AWS_REGION'] = process.env['AWS_REGION'] ?? PROJECT_CONFIG.aws.region;

    const platform = new LocalPlatform();

    const { bootstrap, reason } = this.resolveDomainMode(platform);
    console.log(`\n=== Domain mode: ${bootstrap ? 'bootstrap (zone only)' : 'full (ACM + aliases)'} ===`);
    console.log(`  ${reason}\n`);

    const tfVarOverrides = [
      '-var', 'custom_domain=true',
      '-var', `custom_domain_bootstrap=${bootstrap}`,
    ] as const;

    const argv = ['', '', 'deploy'];

    const deployCmd = new DeployCommand(platform, { tfVarOverrides });
    await deployCmd.execute(argv);

    const deployAppsCmd = new DeployAppsCommand(platform);
    await deployAppsCmd.execute(argv);

    const outputs = readTfOutputs(platform);

    if (bootstrap) {
      this.printBootstrapInstructions(outputs);
      return;
    }

    await runHttpSmokeTestsOnly(platform, outputs);

    console.log('\n=== Deploy complete ===');
    const urlKeys = ['web_app_url', 'req_res_url'] as const;
    for (const key of urlKeys) {
      try {
        console.log(`  ${key}: ${requireOutput(platform, outputs, key)}`);
      } catch { /* output not available */ }
    }
  }

  private resolveDomainMode(platform: LocalPlatform): { bootstrap: boolean; reason: string } {
    let outputs: TfOutputs;
    try {
      outputs = readTfOutputs(platform);
    } catch {
      return { bootstrap: true, reason: 'No terraform outputs yet — first deploy uses bootstrap mode.' };
    }

    const delegation = checkDnsDelegation(outputs);
    if (delegation.delegated) {
      return { bootstrap: false, reason: 'DNS delegation verified — deploying with ACM certificate.' };
    }

    const reasons = delegation.details.map((d) => `${d.domain}: ${d.message}`).join('; ');
    return { bootstrap: true, reason: `DNS not yet delegated — ${reasons}` };
  }

  private printBootstrapInstructions(outputs: TfOutputs): void {
    console.log('\n=== Domain Bootstrap: Action Required ===');
    console.log('Set these nameservers at your domain registrar:\n');

    for (const { domain, outputKey } of SETUP_DNS_DOMAINS) {
      const ns = outputs[outputKey];
      if (ns && ns !== '') {
        console.log(`  ${domain}:`);
        for (const s of ns.split(',').map((s) => s.trim()).filter(Boolean)) {
          console.log(`    ${s}`);
        }
      }
    }

    console.log('\nAfter updating your registrar, re-run: bun run setup deploy');
    console.log('The next deploy will detect the delegation and create the ACM certificate.\n');
  }
}
