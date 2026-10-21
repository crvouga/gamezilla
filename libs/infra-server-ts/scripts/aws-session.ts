// @io-wall-ok — GitHub OIDC and the local AWS CLI, for the OpenTofu wrapper.
/**
 * Resolves the AWS provider session for foundation and bootstrap.
 * The child process's `AWS_ACCESS_KEY_ID` stays the R2 state key.
 */
import { spawnSync } from 'node:child_process';
import type { AwsSession } from '@libs/infra-shared-ts/aws-session';
import {
  awsAuthPlan,
  githubOidcUrl,
  parseAwsEnvCredentials,
  parseStsCredentials,
  stsSessionName,
} from '@libs/infra-shared-ts/aws-session';
import { GLOBAL } from '@libs/infra-shared-ts/global';

export async function resolveAwsSession(
  env: Readonly<Record<string, string | undefined>>,
  stack: string,
  signal: AbortSignal
): Promise<AwsSession | null> {
  const plan = awsAuthPlan(env, stack);
  if (plan === 'oidc') return assumeGithub(env, signal);
  if (plan === 'local') return readLocalAwsSession();
  return null;
}

async function assumeGithub(
  env: Readonly<Record<string, string | undefined>>,
  signal: AbortSignal
): Promise<AwsSession> {
  const roleArn = env['AWS_ROLE_ARN']?.trim() ?? '';
  const requestUrl = env['ACTIONS_ID_TOKEN_REQUEST_URL']?.trim() ?? '';
  const requestToken = env['ACTIONS_ID_TOKEN_REQUEST_TOKEN']?.trim() ?? '';
  const tokenResponse = await fetch(githubOidcUrl(requestUrl), {
    headers: { Authorization: `bearer ${requestToken}` },
    signal,
  });
  if (!tokenResponse.ok) {
    throw new Error(
      `GitHub OIDC token request failed: HTTP ${String(tokenResponse.status)}`
    );
  }
  const tokenBody: unknown = await tokenResponse.json();
  const webIdentityToken = oidcTokenValue(tokenBody);
  const body = new URLSearchParams({
    Action: 'AssumeRoleWithWebIdentity',
    Version: '2011-06-15',
    RoleArn: roleArn,
    RoleSessionName: stsSessionName(env),
    WebIdentityToken: webIdentityToken,
  });
  const sts = await fetch(`https://sts.${GLOBAL.aws.region}.amazonaws.com/`, {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  return parseStsCredentials(await sts.text());
}

function oidcTokenValue(body: unknown): string {
  if (typeof body !== 'object' || body === null || !('value' in body)) {
    throw new Error('GitHub OIDC token response: missing value');
  }
  const value = body.value;
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error('GitHub OIDC token response: missing value');
  }
  return value;
}

function readLocalAwsSession(): AwsSession | null {
  const result = spawnSync(
    'aws',
    ['configure', 'export-credentials', '--format', 'env-no-export'],
    { encoding: 'utf8', timeout: 20_000, killSignal: 'SIGKILL' }
  );
  if (result.error)
    throw new Error(
      `AWS CLI credential export failed: ${result.error.message}`
    );
  if (result.status !== 0) {
    const line = (result.stderr ?? '')
      .split('\n')
      .find((entry) => entry.trim().length > 0);
    if (
      line !== undefined &&
      !line.includes('AKIA') &&
      !line.includes('ASIA')
    ) {
      console.error(`[infra] AWS CLI credentials: ${line.trim()}`);
    }
    return null;
  }
  return parseAwsEnvCredentials(result.stdout ?? '');
}
