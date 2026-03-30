import {
  CloudFormationClient,
  DescribeStacksCommand,
} from '@aws-sdk/client-cloudformation';
import { GetCallerIdentityCommand, STSClient } from '@aws-sdk/client-sts';
import { BaseSetupCommand } from './base-command';
import {
  DEPLOYABLE_STATUSES,
  STACK_NAME,
  describeStack,
} from '../deployment-pipeline-cli/cfn-shared';
import { PROJECT_CONFIG } from '../project-config';
import { DomainsStatusCommand } from './cmd-domains-status';
import { describeStackExists, getStackOutput, runLocal } from './shared';

const GH_REPO = `${PROJECT_CONFIG.github.owner}/${PROJECT_CONFIG.github.repo}`;

export class StatusCommand extends BaseSetupCommand {
  readonly id = 'status';
  readonly summary = 'AWS identity, stacks, GitHub vars, domain summary';

  async execute(argv: string[]): Promise<void> {
    const region = PROJECT_CONFIG.aws.region;
    process.env['AWS_REGION'] = region;
    process.env['AWS_DEFAULT_REGION'] = region;

    console.log('=== STS caller ===\n');
    const sts = new STSClient({ region });
    const id = await sts.send(new GetCallerIdentityCommand({}));
    console.log(
      JSON.stringify(
        { Account: id.Account, Arn: id.Arn, UserId: id.UserId, Region: region },
        null,
        2
      )
    );

    const cfn = new CloudFormationClient({ region });

    console.log(
      `\n=== OIDC bootstrap stack: ${PROJECT_CONFIG.aws.bootstrapStackName} ===\n`
    );
    const oidcExists = await describeStackExists(
      cfn,
      PROJECT_CONFIG.aws.bootstrapStackName
    );
    if (!oidcExists) {
      console.log('(stack does not exist)');
    } else {
      const out = await cfn.send(
        new DescribeStacksCommand({
          StackName: PROJECT_CONFIG.aws.bootstrapStackName,
        })
      );
      const s = out.Stacks?.[0];
      console.log(`Status: ${s?.StackStatus ?? '?'}`);
      const roleArn = await getStackOutput(
        cfn,
        PROJECT_CONFIG.aws.bootstrapStackName,
        'RoleArn'
      );
      console.log(`RoleArn: ${roleArn ?? '(missing)'}`);
    }

    console.log('\n=== CDK bootstrap stack: CDKToolkit ===\n');
    const cdkOk = await describeStackExists(cfn, 'CDKToolkit');
    console.log(cdkOk ? 'present' : 'absent');

    console.log(`\n=== App stack: ${STACK_NAME} ===\n`);
    const gamezilla = await describeStack(cfn);
    if (gamezilla === null) {
      console.log('(stack does not exist)');
    } else {
      console.log(`Status: ${gamezilla.status ?? '?'}`);
      if (gamezilla.reason !== undefined && gamezilla.reason !== '') {
        console.log(`Reason: ${gamezilla.reason}`);
      }
      if (
        gamezilla.status !== undefined &&
        !DEPLOYABLE_STATUSES.has(gamezilla.status)
      ) {
        console.log('(warning: status not in typical deployable set)');
      }
      const outs = await cfn.send(
        new DescribeStacksCommand({ StackName: STACK_NAME })
      );
      const outputs = outs.Stacks?.[0]?.Outputs ?? [];
      const keys = [
        'WebAppUrl',
        'PatchDbAppUrl',
        'SyncServerUrl',
        'WebAppBucketName',
        'Route53Nameservers',
      ] as const;
      console.log('Selected outputs:');
      for (const k of keys) {
        const v = outputs.find((o) => o.OutputKey === k)?.OutputValue;
        if (v !== undefined && v !== '') console.log(`  ${k}: ${v}`);
      }
    }

    console.log(`\n=== GitHub variables (${GH_REPO}) ===\n`);
    try {
      runLocal('gh', ['variable', 'list', '-R', GH_REPO]);
    } catch {
      console.log('(gh variable list failed — is gh authenticated?)');
    }

    console.log('\n=== Domains (domains-status) ===\n');
    await new DomainsStatusCommand().execute(argv);
  }
}
