import type { Command } from '../command';
import type { CiPlatform } from '../platform';
import { LocalPlatform, runStep } from '../platform';
import { banner, heading, ok, info } from '../fmt';
import { PROJECT_CONFIG } from '../../project-config';
import { ensureAwsEnvCredentials } from '../lib/aws-creds';
import { checkDnsDelegation, DNS_DOMAINS } from '../lib/dns';
import { readTfOutputs, requireOutput, type TfOutputs } from '../lib/tf-outputs';
import { ApplyCommand } from './apply';
import { DeployAppsCommand } from './deploy-apps';
import { runHttpSmokeTestsOnly } from './post-deploy';

export class DeployCommand implements Command {
  readonly id = 'deploy';
  readonly summary = 'Full deploy: terraform + apps + smoke tests';
  readonly group = 'main' as const;

  constructor(private readonly platform: CiPlatform) {}

  async execute(): Promise<void> {
    banner('Deploy');

    process.env['AWS_REGION'] = process.env['AWS_REGION'] ?? PROJECT_CONFIG.aws.region;
    ensureAwsEnvCredentials();

    const localPlatform = this.platform instanceof LocalPlatform ? this.platform : new LocalPlatform();

    const { bootstrap, reason } = resolveDomainMode(localPlatform);
    heading(`Domain mode: ${bootstrap ? 'bootstrap (zone only)' : 'full (ACM + aliases)'}`);
    info('', reason);

    const tfVarOverrides = [
      '-var', 'custom_domain=true',
      '-var', `custom_domain_bootstrap=${bootstrap}`,
    ] as const;

    const applyCmd = new ApplyCommand(this.platform, { tfVarOverrides });
    await applyCmd.execute();

    const deployAppsCmd = new DeployAppsCommand(this.platform);
    await deployAppsCmd.execute();

    const outputs = readTfOutputs(this.platform);

    if (bootstrap) {
      printBootstrapInstructions(outputs);
      return;
    }

    await runHttpSmokeTestsOnly(this.platform, outputs);

    banner('Deploy Complete');
    for (const key of ['web_app_url', 'req_res_url'] as const) {
      try {
        ok(key, requireOutput(this.platform, outputs, key));
      } catch { /* output not available */ }
    }
  }
}

function resolveDomainMode(platform: CiPlatform): { bootstrap: boolean; reason: string } {
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

function printBootstrapInstructions(outputs: TfOutputs): void {
  heading('Domain Bootstrap: Action Required');
  console.log('Set these nameservers at your domain registrar:\n');

  for (const { domain, outputKey } of DNS_DOMAINS) {
    const ns = outputs[outputKey];
    if (ns && ns !== '') {
      console.log(`  ${domain}:`);
      for (const s of ns.split(',').map((s) => s.trim()).filter(Boolean)) {
        console.log(`    ${s}`);
      }
    }
  }

  console.log('\nAfter updating your registrar, re-run: bun run infra deploy');
  console.log('The next deploy will detect the delegation and create the ACM certificate.\n');
}
