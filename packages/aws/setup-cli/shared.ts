import {
  CloudFormationClient,
  CreateStackCommand,
  DescribeStacksCommand,
  UpdateStackCommand,
} from '@aws-sdk/client-cloudformation';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** This file lives in `packages/aws/setup-cli/`. */
const SETUP_CLI_DIR = dirname(fileURLToPath(import.meta.url));

/** Directory containing `cdk.json` (the `packages/aws` package). */
export const AWS_PACKAGE_ROOT = join(SETUP_CLI_DIR, '..');

export const OIDC_TEMPLATE_PATH = join(
  AWS_PACKAGE_ROOT,
  'bootstrap',
  'github-oidc.template.json'
);

const CDK_TOOLKIT_STACK = 'CDKToolkit';

export function runLocal(
  cmd: string,
  args: string[],
  opts?: { cwd?: string; env?: NodeJS.ProcessEnv }
): void {
  const r = spawnSync(cmd, args, {
    cwd: opts?.cwd,
    stdio: 'inherit',
    shell: false,
    env: opts?.env ?? process.env,
  });
  if (r.status !== 0) {
    throw new Error(
      `${cmd} ${args.join(' ')} exited ${r.status ?? 'unknown'}`
    );
  }
}

export function runLocalCapture(
  cmd: string,
  args: string[],
  opts?: { cwd?: string; env?: NodeJS.ProcessEnv }
): { ok: boolean; stdout: string; stderr: string; code: number | null } {
  const r = spawnSync(cmd, args, {
    cwd: opts?.cwd,
    encoding: 'utf8',
    shell: false,
    env: opts?.env ?? process.env,
  });
  return {
    ok: r.status === 0,
    stdout: typeof r.stdout === 'string' ? r.stdout : String(r.stdout ?? ''),
    stderr: typeof r.stderr === 'string' ? r.stderr : String(r.stderr ?? ''),
    code: r.status,
  };
}

export function gh(args: string[]): void {
  runLocal('gh', args);
}

export function ghQuiet(args: string[]): void {
  spawnSync('gh', args, { stdio: 'ignore', shell: false });
}

export function requireCliOnPath(name: string): void {
  const which = runLocalCapture(
    process.platform === 'win32' ? 'where' : 'which',
    [name]
  );
  if (!which.ok) {
    throw new Error(
      `Required command "${name}" not found on PATH (install and retry)`
    );
  }
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

export async function waitForStackSuccess(
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

export async function describeStackExists(
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

export async function getStackOutput(
  client: CloudFormationClient,
  stackName: string,
  outputKey: string
): Promise<string | undefined> {
  const out = await client.send(
    new DescribeStacksCommand({ StackName: stackName })
  );
  const outputs = out.Stacks?.[0]?.Outputs ?? [];
  return outputs.find((o) => o.OutputKey === outputKey)?.OutputValue;
}

export async function requireStackOutput(
  client: CloudFormationClient,
  stackName: string,
  outputKey: string
): Promise<string> {
  const v = await getStackOutput(client, stackName, outputKey);
  if (v === undefined || v === '') {
    throw new Error(
      `CloudFormation stack ${stackName} output "${outputKey}" missing or empty`
    );
  }
  return v;
}

export async function deployOidcStackIdempotent(
  client: CloudFormationClient,
  stackName: string,
  templatePath: string,
  parameters: { ParameterKey: string; ParameterValue: string }[]
): Promise<string> {
  const templateBody = readFileSync(templatePath, 'utf8');
  const exists = await describeStackExists(client, stackName);

  if (!exists) {
    console.log(`Creating stack ${stackName}…`);
    await client.send(
      new CreateStackCommand({
        StackName: stackName,
        TemplateBody: templateBody,
        Capabilities: ['CAPABILITY_NAMED_IAM'],
        Parameters: parameters,
      })
    );
  } else {
    console.log(`Updating stack ${stackName}…`);
    try {
      await client.send(
        new UpdateStackCommand({
          StackName: stackName,
          TemplateBody: templateBody,
          Capabilities: ['CAPABILITY_NAMED_IAM'],
          Parameters: parameters,
        })
      );
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('No updates are to be performed')) {
        console.log('OIDC stack: no template changes (skipping update wait).');
        return requireStackOutput(client, stackName, 'RoleArn');
      }
      throw e;
    }
  }

  await waitForStackSuccess(client, stackName);
  return requireStackOutput(client, stackName, 'RoleArn');
}

export async function assertCdkToolkitExists(
  client: CloudFormationClient
): Promise<void> {
  const ok = await describeStackExists(client, CDK_TOOLKIT_STACK);
  if (!ok) {
    throw new Error(
      `CDK bootstrap stack "${CDK_TOOLKIT_STACK}" not found in this region. Run: bun run setup cdk-bootstrap`
    );
  }
}
