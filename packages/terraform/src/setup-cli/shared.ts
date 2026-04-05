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
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PROJECT_CONFIG } from '../project-config';

const TF_PACKAGE_ROOT = join(__dirname, '..', '..');
export const BOOTSTRAP_DIR = join(TF_PACKAGE_ROOT, 'src', 'bootstrap');
export const OIDC_TEMPLATE_PATH = join(
  BOOTSTRAP_DIR,
  'github-oidc.template.json'
);

export function runLocal(
  cmd: string,
  args: string[],
  opts?: { cwd?: string }
): void {
  console.log(`> ${cmd} ${args.join(' ')}`);
  const r = spawnSync(cmd, args, {
    stdio: 'inherit',
    env: process.env,
    ...(opts?.cwd ? { cwd: opts.cwd } : {}),
  });
  if (r.error) {
    throw new Error(`Failed to spawn ${cmd}: ${r.error.message}`);
  }
  if (r.status !== null && r.status !== 0) {
    throw new Error(`${cmd} ${args.join(' ')} exited ${r.status}`);
  }
  if (r.signal) {
    throw new Error(`${cmd} ${args.join(' ')} killed by signal ${r.signal}`);
  }
}

export function runLocalCapture(
  cmd: string,
  args: string[],
  opts?: { cwd?: string }
): string {
  const r = spawnSync(cmd, args, {
    encoding: 'utf-8',
    env: process.env,
    ...(opts?.cwd ? { cwd: opts.cwd } : {}),
  });
  if (r.error) {
    throw new Error(`Failed to spawn ${cmd}: ${r.error.message}`);
  }
  if (r.status !== null && r.status !== 0) {
    throw new Error(`${cmd} ${args.join(' ')} exited ${r.status}: ${r.stderr}`);
  }
  return r.stdout.trim();
}

export function gh(args: string[]): void {
  runLocal('gh', args);
}

/**
 * Resolve the current AWS credentials (SSO, IAM, etc.) into standard env vars
 * so that tools like Terraform's S3 backend (which can't parse sso_session
 * config) work correctly.  No-op when credentials are already in the
 * environment (e.g. CI via OIDC).
 */
export function ensureAwsEnvCredentials(): void {
  if (
    process.env['AWS_ACCESS_KEY_ID'] &&
    process.env['AWS_SECRET_ACCESS_KEY']
  ) {
    return;
  }
  try {
    const raw = runLocalCapture('aws', [
      'configure',
      'export-credentials',
      '--format',
      'process',
    ]);
    const creds = JSON.parse(raw) as {
      Version?: number;
      AccessKeyId?: string;
      SecretAccessKey?: string;
      SessionToken?: string;
    };
    if (creds.AccessKeyId) process.env['AWS_ACCESS_KEY_ID'] = creds.AccessKeyId;
    if (creds.SecretAccessKey)
      process.env['AWS_SECRET_ACCESS_KEY'] = creds.SecretAccessKey;
    if (creds.SessionToken)
      process.env['AWS_SESSION_TOKEN'] = creds.SessionToken;
    console.log('✓ AWS credentials resolved to environment');
  } catch {
    console.warn(
      '[WARNING] Could not export AWS credentials — terraform may fail if using SSO'
    );
  }
}

/**
 * Run a `gh` command, suppressing only "not found" style errors.
 * Other failures (auth, network) are logged as warnings.
 */
export function ghQuiet(args: string[]): void {
  try {
    const r = spawnSync('gh', args, { encoding: 'utf-8', env: process.env });
    if (r.status === 0) return;
    const stderr = (r.stderr ?? '').toLowerCase();
    if (
      stderr.includes('not found') ||
      stderr.includes('could not find') ||
      stderr.includes('no secret')
    ) {
      return;
    }
    console.warn(
      `[WARNING] gh ${args.join(' ')} exited ${r.status}: ${r.stderr?.trim()}`
    );
  } catch (e) {
    console.warn(
      `[WARNING] gh ${args.join(' ')} failed: ${e instanceof Error ? e.message : String(e)}`
    );
  }
}

export function requireCliOnPath(name: string): void {
  const r = spawnSync('which', [name], { encoding: 'utf-8' });
  if (r.status !== 0) {
    throw new Error(`"${name}" not found on PATH. Install it first.`);
  }
}

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

export async function deployOidcStackIdempotent(): Promise<string> {
  const region = PROJECT_CONFIG.aws.region;
  const stackName = PROJECT_CONFIG.aws.bootstrapStackName;
  const client = new CloudFormationClient({ region });

  if (!existsSync(OIDC_TEMPLATE_PATH)) {
    throw new Error(
      `OIDC template not found at ${OIDC_TEMPLATE_PATH}. Ensure the file exists.`
    );
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
    console.log(
      `Stack ${stackName} is ${status} — waiting for it to settle...`
    );
    if (status === 'DELETE_IN_PROGRESS') {
      await waitUntilStackDeleteComplete(
        { client, maxWaitTime: 300 },
        { StackName: stackName }
      );
      return createStack(client, stackName, template, params);
    }
    if (status.startsWith('CREATE')) {
      await waitUntilStackCreateComplete(
        { client, maxWaitTime: 300 },
        { StackName: stackName }
      );
    } else {
      await waitUntilStackUpdateComplete(
        { client, maxWaitTime: 300 },
        { StackName: stackName }
      );
    }
    return requireStackOutput(client, stackName, 'RoleArn');
  }

  if (DELETE_AND_RECREATE_STATES.has(status)) {
    console.log(`Stack ${stackName} is ${status} — deleting and recreating...`);
    await client.send(new DeleteStackCommand({ StackName: stackName }));
    await waitUntilStackDeleteComplete(
      { client, maxWaitTime: 300 },
      { StackName: stackName }
    );
    return createStack(client, stackName, template, params);
  }

  if (RECOVERABLE_STATES.has(status)) {
    return updateStack(client, stackName, template, params);
  }

  throw new Error(
    `Stack ${stackName} is in unrecoverable state "${status}". ` +
      `Delete it manually in the CloudFormation console and re-run.`
  );
}

async function createStack(
  client: CloudFormationClient,
  stackName: string,
  template: string,
  params: Array<{ ParameterKey: string; ParameterValue: string }>
): Promise<string> {
  console.log(`Creating stack ${stackName}...`);
  try {
    await client.send(
      new CreateStackCommand({
        StackName: stackName,
        TemplateBody: template,
        Parameters: params,
        Capabilities: ['CAPABILITY_NAMED_IAM'],
      })
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('already exists')) {
      console.log('Stack appeared concurrently — treating as existing.');
      return requireStackOutput(client, stackName, 'RoleArn');
    }
    throw e;
  }
  await waitUntilStackCreateComplete(
    { client, maxWaitTime: 300 },
    { StackName: stackName }
  );
  return requireStackOutput(client, stackName, 'RoleArn');
}

async function updateStack(
  client: CloudFormationClient,
  stackName: string,
  template: string,
  params: Array<{ ParameterKey: string; ParameterValue: string }>
): Promise<string> {
  console.log(`Updating stack ${stackName}...`);
  try {
    await client.send(
      new UpdateStackCommand({
        StackName: stackName,
        TemplateBody: template,
        Parameters: params,
        Capabilities: ['CAPABILITY_NAMED_IAM'],
      })
    );
    await waitUntilStackUpdateComplete(
      { client, maxWaitTime: 300 },
      { StackName: stackName }
    );
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

interface StackInfo {
  status: string;
  outputs: Record<string, string>;
}

async function describeStackFull(
  client: CloudFormationClient,
  stackName: string
): Promise<StackInfo | null> {
  try {
    const out = await client.send(
      new DescribeStacksCommand({ StackName: stackName })
    );
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
  outputKey: string
): Promise<string> {
  const stack = await describeStackFull(client, stackName);
  if (!stack || !stack.outputs[outputKey]) {
    throw new Error(`Stack ${stackName} output "${outputKey}" not found`);
  }
  return stack.outputs[outputKey];
}

export function getTfPackageRoot(): string {
  return TF_PACKAGE_ROOT;
}
