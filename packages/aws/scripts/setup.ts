#!/usr/bin/env bun
/**
 * One-shot bootstrap: deploy GitHub OIDC CFN stack, CDK bootstrap, configure GitHub repo variables.
 * Prereqs: AWS credentials (e.g. aws configure), `gh auth login`, Bun.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CloudFormationClient,
  CreateStackCommand,
  DescribeStacksCommand,
  UpdateStackCommand,
} from '@aws-sdk/client-cloudformation';
import { GetCallerIdentityCommand, STSClient } from '@aws-sdk/client-sts';
import { PROJECT_CONFIG } from '../project-config';

const AWS_PACKAGE_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TEMPLATE_PATH = join(
  AWS_PACKAGE_ROOT,
  'bootstrap',
  'github-oidc.template.json'
);
const REGION = PROJECT_CONFIG.aws.region;
const STACK_NAME = PROJECT_CONFIG.aws.bootstrapStackName;
const GH_REPO = `${PROJECT_CONFIG.github.owner}/${PROJECT_CONFIG.github.repo}`;

function run(cmd: string, args: string[], cwd?: string): void {
  const r = spawnSync(cmd, args, {
    cwd,
    stdio: 'inherit',
    shell: false,
    env: process.env,
  });
  if (r.status !== 0) {
    throw new Error(`${cmd} ${args.join(' ')} exited ${r.status ?? 'unknown'}`);
  }
}

function gh(args: string[]): void {
  run('gh', args);
}

function stackMissingError(e: unknown): boolean {
  if (typeof e !== 'object' || e === null || !('name' in e)) return false;
  if ((e as { name?: string }).name !== 'ValidationError') return false;
  const msg =
    'message' in e && typeof (e as { message?: string }).message === 'string'
      ? (e as { message: string }).message
      : '';
  return msg.includes('does not exist');
}

async function waitForStackSuccess(
  client: CloudFormationClient,
  stackName: string
): Promise<void> {
  for (;;) {
    const out = await client.send(
      new DescribeStacksCommand({ StackName: stackName })
    );
    const status = out.Stacks?.[0]?.StackStatus ?? '';
    if (status === 'CREATE_COMPLETE' || status === 'UPDATE_COMPLETE') {
      return;
    }
    if (
      status === 'ROLLBACK_COMPLETE' ||
      status === 'UPDATE_ROLLBACK_COMPLETE' ||
      status.endsWith('_FAILED')
    ) {
      throw new Error(
        `CloudFormation stack ${stackName} failed or rolled back: ${status}`
      );
    }
    await new Promise((r) => setTimeout(r, 5000));
  }
}

async function describeStackExists(
  client: CloudFormationClient,
  stackName: string
): Promise<boolean> {
  try {
    await client.send(new DescribeStacksCommand({ StackName: stackName }));
    return true;
  } catch (e: unknown) {
    if (stackMissingError(e)) return false;
    throw e;
  }
}

async function getRoleArnFromStack(
  client: CloudFormationClient,
  stackName: string
): Promise<string> {
  const out = await client.send(
    new DescribeStacksCommand({ StackName: stackName })
  );
  const outputs = out.Stacks?.[0]?.Outputs ?? [];
  const roleArn = outputs.find((o) => o.OutputKey === 'RoleArn')?.OutputValue;
  if (roleArn === undefined || roleArn === '') {
    throw new Error('CloudFormation output RoleArn missing or empty');
  }
  return roleArn;
}

async function deployOidcStack(client: CloudFormationClient): Promise<string> {
  const templateBody = readFileSync(TEMPLATE_PATH, 'utf8');
  const parameters = [
    { ParameterKey: 'GitHubOrg', ParameterValue: PROJECT_CONFIG.github.owner },
    { ParameterKey: 'GitHubRepo', ParameterValue: PROJECT_CONFIG.github.repo },
  ];

  const exists = await describeStackExists(client, STACK_NAME);

  if (!exists) {
    console.log(`Creating stack ${STACK_NAME}…`);
    await client.send(
      new CreateStackCommand({
        StackName: STACK_NAME,
        TemplateBody: templateBody,
        Capabilities: ['CAPABILITY_NAMED_IAM'],
        Parameters: parameters,
      })
    );
  } else {
    console.log(`Updating stack ${STACK_NAME}…`);
    try {
      await client.send(
        new UpdateStackCommand({
          StackName: STACK_NAME,
          TemplateBody: templateBody,
          Capabilities: ['CAPABILITY_NAMED_IAM'],
          Parameters: parameters,
        })
      );
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('No updates are to be performed')) {
        console.log('OIDC stack: no template changes (skipping update wait).');
        return getRoleArnFromStack(client, STACK_NAME);
      }
      throw e;
    }
  }

  await waitForStackSuccess(client, STACK_NAME);
  return getRoleArnFromStack(client, STACK_NAME);
}

async function main(): Promise<void> {
  process.env['AWS_REGION'] = REGION;
  process.env['AWS_DEFAULT_REGION'] = REGION;

  const sts = new STSClient({ region: REGION });
  const me = await sts.send(new GetCallerIdentityCommand({}));
  const account = me.Account;
  if (account === undefined || account === '') {
    throw new Error('STS GetCallerIdentity: missing account');
  }
  console.log(`AWS account: ${account}  region: ${REGION}`);

  const cfn = new CloudFormationClient({ region: REGION });
  const roleArn = await deployOidcStack(cfn);
  console.log(`OIDC deploy role: ${roleArn}`);

  console.log('CDK bootstrap…');
  run(
    'bunx',
    ['cdk', 'bootstrap', `aws://${account}/${REGION}`],
    AWS_PACKAGE_ROOT
  );

  console.log(`Setting GitHub variables on ${GH_REPO}…`);
  gh(['variable', 'set', 'AWS_ROLE_ARN', '--body', roleArn, '-R', GH_REPO]);
  gh(['variable', 'set', 'AWS_REGION', '--body', REGION, '-R', GH_REPO]);

  console.log('Removing legacy static-key secrets if present…');
  spawnSync(
    'gh',
    ['secret', 'remove', 'AWS_ACCESS_KEY_ID', '-R', GH_REPO],
    { stdio: 'ignore', shell: false }
  );
  spawnSync(
    'gh',
    ['secret', 'remove', 'AWS_SECRET_ACCESS_KEY', '-R', GH_REPO],
    { stdio: 'ignore', shell: false }
  );

  console.log(
    '\nDone. Push to main to deploy via OIDC. If this account already had a GitHub OIDC provider, stack create may fail — remove the duplicate or merge policies manually.\n'
  );
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
