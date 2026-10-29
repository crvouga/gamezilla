/**
 * How OpenTofu's AWS provider authenticates. The process's
 * `AWS_ACCESS_KEY_ID` is the R2 state credential, so account credentials are
 * passed as `TF_VAR_aws_*` and never under that name.
 *
 * GitHub Actions assumes `AWS_ROLE_ARN` with the job's OIDC token. A laptop
 * uses the AWS CLI's current login. Long-lived account keys still work when
 * no OIDC token is available; they are not required.
 */

import { technicalName } from '@libs/product-identity-shared-ts/technical-names';

export type AwsSession = {
  readonly accessKeyId: string;
  readonly secretAccessKey: string;
  readonly sessionToken: string;
};

export type AwsAuthPlan = 'oidc' | 'account-keys' | 'local' | 'none';

const AWS_STACKS = new Set(['foundation', 'bootstrap']);

function present(
  env: Readonly<Record<string, string | undefined>>,
  name: string
): boolean {
  return (env[name]?.trim() ?? '').length > 0;
}

/** Which credential source the wrapper should use for this stack. */
export function awsAuthPlan(
  env: Readonly<Record<string, string | undefined>>,
  stack: string
): AwsAuthPlan {
  if (!AWS_STACKS.has(stack)) return 'none';
  if (
    present(env, 'AWS_ROLE_ARN') &&
    present(env, 'ACTIONS_ID_TOKEN_REQUEST_URL') &&
    present(env, 'ACTIONS_ID_TOKEN_REQUEST_TOKEN')
  ) {
    return 'oidc';
  }
  if (
    present(env, 'AWS_ACCOUNT_ACCESS_KEY_ID') &&
    present(env, 'AWS_ACCOUNT_SECRET_ACCESS_KEY')
  ) {
    return 'account-keys';
  }
  if (env['GITHUB_ACTIONS'] === 'true') return 'none';
  return 'local';
}

/** Long-lived keys already in the environment, including a session token. */
export function accountKeySession(
  env: Readonly<Record<string, string | undefined>>
): AwsSession | null {
  const named = pair(
    env,
    'AWS_ACCOUNT_ACCESS_KEY_ID',
    'AWS_ACCOUNT_SECRET_ACCESS_KEY'
  );
  if (named !== null) return named;
  return pair(env, 'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY');
}

function pair(
  env: Readonly<Record<string, string | undefined>>,
  idName: string,
  secretName: string
): AwsSession | null {
  const accessKeyId = env[idName]?.trim() ?? '';
  const secretAccessKey = env[secretName]?.trim() ?? '';
  if (accessKeyId.length === 0 || secretAccessKey.length === 0) return null;
  return {
    accessKeyId,
    secretAccessKey,
    sessionToken: env['AWS_SESSION_TOKEN']?.trim() ?? '',
  };
}

/** `aws configure export-credentials --format env-no-export` (or `export`). */
export function parseAwsEnvCredentials(text: string): AwsSession | null {
  const values = new Map<string, string>();
  for (const line of text.split('\n')) {
    const trimmed = line.trim().replace(/^export\s+/, '');
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq);
    let value = trimmed.slice(eq + 1).trim();
    const quoted =
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"));
    if (quoted) value = value.slice(1, -1);
    values.set(key, value);
  }
  const accessKeyId = values.get('AWS_ACCESS_KEY_ID') ?? '';
  const secretAccessKey = values.get('AWS_SECRET_ACCESS_KEY') ?? '';
  if (accessKeyId.length === 0 || secretAccessKey.length === 0) return null;
  return {
    accessKeyId,
    secretAccessKey,
    sessionToken: values.get('AWS_SESSION_TOKEN') ?? '',
  };
}

export function githubOidcUrl(requestUrl: string): string {
  const url = new URL(requestUrl);
  url.searchParams.set('audience', 'sts.amazonaws.com');
  return url.toString();
}

export function stsSessionName(
  env: Readonly<Record<string, string | undefined>>
): string {
  const run = env['GITHUB_RUN_ID']?.trim() ?? '';
  if (/^\d+$/.test(run)) return `gha-${run}`;
  return technicalName(['tofu']);
}

/** Credentials element of an AssumeRoleWithWebIdentity response. */
export function parseStsCredentials(xml: string): AwsSession {
  const accessKeyId = xmlTag(xml, 'AccessKeyId');
  const secretAccessKey = xmlTag(xml, 'SecretAccessKey');
  const sessionToken = xmlTag(xml, 'SessionToken');
  if (
    accessKeyId.length === 0 ||
    secretAccessKey.length === 0 ||
    sessionToken.length === 0
  ) {
    const message = xmlTag(xml, 'Message');
    throw new Error(
      message.length > 0
        ? `AWS STS AssumeRoleWithWebIdentity failed: ${message}`
        : 'AWS STS AssumeRoleWithWebIdentity returned no credentials'
    );
  }
  return { accessKeyId, secretAccessKey, sessionToken };
}

function xmlTag(xml: string, name: string): string {
  const match = new RegExp(`<${name}>([^<]*)</${name}>`).exec(xml);
  return match?.[1]?.trim() ?? '';
}
