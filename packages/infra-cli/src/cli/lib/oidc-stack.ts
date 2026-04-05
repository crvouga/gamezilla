import {
  CloudFormationClient,
  CreateStackCommand,
  DeleteStackCommand,
  DescribeStacksCommand,
  UpdateStackCommand,
  waitUntilStackCreateComplete,
  waitUntilStackDeleteComplete,
  waitUntilStackUpdateComplete,
} from '@aws-sdk/client-cloudformation';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PROJECT_CONFIG } from '../../project-config';
import { INFRA_CLI_ROOT } from '../paths';

const OIDC_TEMPLATE_PATH = resolve(
  INFRA_CLI_ROOT,
  'src',
  'bootstrap',
  'github-oidc.template.json',
);

const RECOVERABLE_STATES = new Set([
  'CREATE_COMPLETE',
  'UPDATE_COMPLETE',
  'UPDATE_ROLLBACK_COMPLETE',
  'IMPORT_COMPLETE',
  'IMPORT_ROLLBACK_COMPLETE',
]);

const DELETE_AND_RECREATE_STATES = new Set([
  'ROLLBACK_COMPLETE',
  'ROLLBACK_FAILED',
  'CREATE_FAILED',
  'DELETE_FAILED',
]);

const WAIT_STATES = new Set([
  'CREATE_IN_PROGRESS',
  'UPDATE_IN_PROGRESS',
  'UPDATE_COMPLETE_CLEANUP_IN_PROGRESS',
  'UPDATE_ROLLBACK_IN_PROGRESS',
  'UPDATE_ROLLBACK_COMPLETE_CLEANUP_IN_PROGRESS',
  'DELETE_IN_PROGRESS',
]);

interface StackInfo {
  status: string;
  outputs: Record<string, string>;
}

async function describeStackFull(
  client: CloudFormationClient,
  stackName: string,
): Promise<StackInfo | null> {
  try {
    const out = await client.send(new DescribeStacksCommand({ StackName: stackName }));
    const s = out.Stacks?.[0];
    if (!s || !s.StackStatus) return null;
    const outputs: Record<string, string> = {};
    for (const o of s.Outputs ?? []) {
      if (o.OutputKey && o.OutputValue) outputs[o.OutputKey] = o.OutputValue;
    }
    return { status: s.StackStatus, outputs };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('does not exist')) return null;
    throw e;
  }
}

export async function requireStackOutput(
  client: CloudFormationClient,
  stackName: string,
  outputKey: string,
): Promise<string> {
  const stack = await describeStackFull(client, stackName);
  if (!stack || !stack.outputs[outputKey]) {
    throw new Error(`Stack ${stackName} output "${outputKey}" not found`);
  }
  return stack.outputs[outputKey];
}

async function createStack(
  client: CloudFormationClient,
  stackName: string,
  template: string,
  params: Array<{ ParameterKey: string; ParameterValue: string }>,
): Promise<string> {
  console.log(`Creating stack ${stackName}...`);
  try {
    await client.send(
      new CreateStackCommand({
        StackName: stackName,
        TemplateBody: template,
        Parameters: params,
        Capabilities: ['CAPABILITY_NAMED_IAM'],
      }),
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('already exists')) {
      console.log('Stack appeared concurrently — treating as existing.');
      return requireStackOutput(client, stackName, 'RoleArn');
    }
    throw e;
  }
  await waitUntilStackCreateComplete({ client, maxWaitTime: 300 }, { StackName: stackName });
  return requireStackOutput(client, stackName, 'RoleArn');
}

async function updateStack(
  client: CloudFormationClient,
  stackName: string,
  template: string,
  params: Array<{ ParameterKey: string; ParameterValue: string }>,
): Promise<string> {
  console.log(`Updating stack ${stackName}...`);
  try {
    await client.send(
      new UpdateStackCommand({
        StackName: stackName,
        TemplateBody: template,
        Parameters: params,
        Capabilities: ['CAPABILITY_NAMED_IAM'],
      }),
    );
    await waitUntilStackUpdateComplete({ client, maxWaitTime: 300 }, { StackName: stackName });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('No updates are to be performed')) {
      console.log('Stack is already up to date.');
    } else {
      throw e;
    }
  }
  return requireStackOutput(client, stackName, 'RoleArn');
}

export async function deployOidcStackIdempotent(): Promise<string> {
  const region = PROJECT_CONFIG.aws.region;
  const stackName = PROJECT_CONFIG.aws.bootstrapStackName;
  const client = new CloudFormationClient({ region });

  if (!existsSync(OIDC_TEMPLATE_PATH)) {
    throw new Error(`OIDC template not found at ${OIDC_TEMPLATE_PATH}. Ensure the file exists.`);
  }
  const template = readFileSync(OIDC_TEMPLATE_PATH, 'utf-8');
  const params = [
    { ParameterKey: 'GitHubOrg', ParameterValue: PROJECT_CONFIG.github.owner },
    { ParameterKey: 'GitHubRepo', ParameterValue: PROJECT_CONFIG.github.repo },
  ];

  const stack = await describeStackFull(client, stackName);

  if (stack === null) {
    return createStack(client, stackName, template, params);
  }

  const status = stack.status;

  if (WAIT_STATES.has(status)) {
    console.log(`Stack ${stackName} is ${status} — waiting for it to settle...`);
    if (status === 'DELETE_IN_PROGRESS') {
      await waitUntilStackDeleteComplete({ client, maxWaitTime: 300 }, { StackName: stackName });
      return createStack(client, stackName, template, params);
    }
    if (status.startsWith('CREATE')) {
      await waitUntilStackCreateComplete({ client, maxWaitTime: 300 }, { StackName: stackName });
    } else {
      await waitUntilStackUpdateComplete({ client, maxWaitTime: 300 }, { StackName: stackName });
    }
    return requireStackOutput(client, stackName, 'RoleArn');
  }

  if (DELETE_AND_RECREATE_STATES.has(status)) {
    console.log(`Stack ${stackName} is ${status} — deleting and recreating...`);
    await client.send(new DeleteStackCommand({ StackName: stackName }));
    await waitUntilStackDeleteComplete({ client, maxWaitTime: 300 }, { StackName: stackName });
    return createStack(client, stackName, template, params);
  }

  if (RECOVERABLE_STATES.has(status)) {
    return updateStack(client, stackName, template, params);
  }

  throw new Error(
    `Stack ${stackName} is in unrecoverable state "${status}". ` +
      `Delete it manually in the CloudFormation console and re-run.`,
  );
}
