import { CloudFormationClient, DescribeStacksCommand } from '@aws-sdk/client-cloudformation';
import { GetCallerIdentityCommand, STSClient } from '@aws-sdk/client-sts';
import { BaseSetupCommand } from './base-command';
import { requireStackOutput } from './shared';
import { PROJECT_CONFIG } from '../project-config';
import { statusSym, statusRule } from './status-symbols';
import { readTfOutputs } from '../deployment-pipeline-cli/tf-outputs';
import { LocalPlatform } from '../deployment-pipeline-cli/ci-platform-local';
import { DomainsStatusCommand } from './cmd-domains-status';

export class StatusCommand extends BaseSetupCommand {
  readonly id = 'status';
  readonly summary = 'AWS identity, OIDC stack, Terraform outputs, GitHub vars, domains';

  async execute(): Promise<void> {
    const region = PROJECT_CONFIG.aws.region;
    console.log('=== Status ===\n');

    // AWS identity
    try {
      const sts = new STSClient({ region });
      const id = await sts.send(new GetCallerIdentityCommand({}));
      console.log(statusRule(statusSym.ok, 'AWS identity', `${id.Arn} (${id.Account})`));
    } catch (e) {
      console.log(statusRule(statusSym.fail, 'AWS identity', e instanceof Error ? e.message : String(e)));
    }

    // OIDC stack
    const cfn = new CloudFormationClient({ region });
    try {
      const roleArn = await requireStackOutput(cfn, PROJECT_CONFIG.aws.bootstrapStackName, 'RoleArn');
      console.log(statusRule(statusSym.ok, 'OIDC stack', roleArn));
    } catch {
      console.log(statusRule(statusSym.fail, 'OIDC stack', 'not found — run "bun run setup aws-oidc"'));
    }

    // Terraform outputs
    const platform = new LocalPlatform();
    try {
      const outputs = readTfOutputs(platform);
      const keys = Object.keys(outputs);
      console.log(statusRule(statusSym.ok, 'Terraform outputs', `${keys.length} outputs`));
      for (const [k, v] of Object.entries(outputs)) {
        if (v) console.log(`  ${statusSym.bullet} ${k}: ${v}`);
      }
    } catch {
      console.log(statusRule(statusSym.warn, 'Terraform outputs', 'not available'));
    }

    // GitHub vars
    try {
      const { spawnSync } = await import('node:child_process');
      const r = spawnSync('gh', ['variable', 'list'], { encoding: 'utf-8' });
      if (r.error) {
        console.log(statusRule(statusSym.warn, 'GitHub variables', `gh not available: ${r.error.message}`));
      } else if (r.status !== 0) {
        const stderr = (r.stderr ?? '').trim();
        console.log(statusRule(statusSym.warn, 'GitHub variables', `gh failed (exit ${r.status}): ${stderr || 'unknown error'}`));
      } else {
        console.log(statusRule(statusSym.ok, 'GitHub variables'));
        console.log(r.stdout.split('\n').map((l) => `  ${l}`).join('\n'));
      }
    } catch (e) {
      console.log(statusRule(statusSym.warn, 'GitHub variables', `${e instanceof Error ? e.message : String(e)}`));
    }

    // Domains
    console.log('');
    const domainsCmd = new DomainsStatusCommand();
    await domainsCmd.execute(process.argv);
  }
}
