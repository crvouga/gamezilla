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
import { statusRule, statusSym } from './status-symbols';
import { describeStackExists, getStackOutput, runLocal } from './shared';

const GH_REPO = `${PROJECT_CONFIG.github.owner}/${PROJECT_CONFIG.github.repo}`;

function hr(): void {
  console.log('');
}

function section(title: string): void {
  hr();
  console.log(`${'─'.repeat(3)} ${title} ${'─'.repeat(3)}`);
  hr();
}

export class StatusCommand extends BaseSetupCommand {
  readonly id = 'status';
  readonly summary = 'AWS identity, stacks, GitHub vars, domain summary';

  async execute(argv: string[]): Promise<void> {
    const region = PROJECT_CONFIG.aws.region;
    process.env['AWS_REGION'] = region;
    process.env['AWS_DEFAULT_REGION'] = region;

    section('AWS identity (STS)');
    const sts = new STSClient({ region });
    const id = await sts.send(new GetCallerIdentityCommand({}));
    console.log(
      `${statusSym.ok} Caller configured\n`,
      JSON.stringify(
        {
          Account: id.Account,
          Arn: id.Arn,
          UserId: id.UserId,
          Region: region,
        },
        null,
        2
      )
    );

    const cfn = new CloudFormationClient({ region });

    section(`OIDC stack · ${PROJECT_CONFIG.aws.bootstrapStackName}`);
    const oidcExists = await describeStackExists(
      cfn,
      PROJECT_CONFIG.aws.bootstrapStackName
    );
    if (!oidcExists) {
      console.log(
        statusRule(statusSym.fail, 'Stack not found', 'run: bun run setup aws-oidc')
      );
    } else {
      const out = await cfn.send(
        new DescribeStacksCommand({
          StackName: PROJECT_CONFIG.aws.bootstrapStackName,
        })
      );
      const s = out.Stacks?.[0];
      const st = s?.StackStatus ?? '?';
      if (st === 'CREATE_COMPLETE' || st === 'UPDATE_COMPLETE') {
        console.log(statusRule(statusSym.ok, `Status: ${st}`));
      } else {
        console.log(
          statusRule(statusSym.warn, `Status: ${st}`, 'unexpected for healthy bootstrap')
        );
      }
      const roleArn = await getStackOutput(
        cfn,
        PROJECT_CONFIG.aws.bootstrapStackName,
        'RoleArn'
      );
      if (roleArn !== undefined && roleArn !== '') {
        console.log(`${statusSym.ok} RoleArn: ${roleArn}`);
      } else {
        console.log(
          statusRule(statusSym.fail, 'RoleArn output missing', 're-run aws-oidc')
        );
      }
    }

    section('CDK bootstrap · CDKToolkit');
    const cdkOk = await describeStackExists(cfn, 'CDKToolkit');
    console.log(
      cdkOk
        ? statusRule(statusSym.ok, 'CDKToolkit present')
        : statusRule(
            statusSym.fail,
            'CDKToolkit absent',
            'run: bun run setup cdk-bootstrap'
          )
    );

    section(`App stack · ${STACK_NAME}`);
    const gamezilla = await describeStack(cfn);
    if (gamezilla === null) {
      console.log(
        statusRule(
          statusSym.fail,
          'Stack does not exist',
          'run CDK deploy (e.g. bun run setup deploy)'
        )
      );
    } else {
      const st = gamezilla.status ?? '?';
      if (
        gamezilla.status !== undefined &&
        DEPLOYABLE_STATUSES.has(gamezilla.status)
      ) {
        console.log(statusRule(statusSym.ok, `Status: ${st}`));
      } else {
        console.log(
          statusRule(
            statusSym.fail,
            `Status: ${st}`,
            'not in deployable set — fix in AWS console or redeploy'
          )
        );
      }
      if (gamezilla.reason !== undefined && gamezilla.reason !== '') {
        console.log(`${statusSym.warn} StackStatusReason: ${gamezilla.reason}`);
      }
      const outs = await cfn.send(
        new DescribeStacksCommand({ StackName: STACK_NAME })
      );
      const outputs = outs.Stacks?.[0]?.Outputs ?? [];
      const keys = [
        'WebAppUrl',
        'PatchDbAppUrl',
        'ServerReqResUrl',
        'WebAppBucketName',
        'Route53Nameservers',
      ] as const;
      console.log(`\n${statusSym.bullet} Selected outputs:`);
      for (const k of keys) {
        const v = outputs.find((o) => o.OutputKey === k)?.OutputValue;
        if (v !== undefined && v !== '') console.log(`    ${k}: ${v}`);
      }
    }

    section(`GitHub Actions variables · ${GH_REPO}`);
    try {
      runLocal('gh', ['variable', 'list', '-R', GH_REPO]);
      console.log(`\n${statusSym.ok} gh variable list succeeded`);
    } catch {
      console.log(
        statusRule(
          statusSym.fail,
          'gh variable list failed',
          'run: gh auth login'
        )
      );
    }

    section('Domains (full report)');
    await new DomainsStatusCommand().execute(argv);
  }
}
