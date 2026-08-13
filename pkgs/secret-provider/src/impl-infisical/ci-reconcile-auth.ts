import { spawnSync } from 'node:child_process';
import { globalHttpFetch } from '@pkgs/http-client';
import { readUtf8 } from '@pkgs/object-store/helpers';
import type { ObjectStore } from '@pkgs/object-store/interface';
import type { ReconcileFail, ReconcileLog } from './ci-reconcile-types';

function trimEnv(name: string): string {
  return (process.env[name] ?? '').trim();
}

function normalizeDomain(domain: string): string {
  return domain.replace(/\/+$/, '');
}

async function loginUniversalAuth(
  domain: string,
  clientId: string,
  clientSecret: string,
  fail: ReconcileFail
): Promise<string> {
  const res = await globalHttpFetch(
    `${domain}/api/v1/auth/universal-auth/login`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ clientId, clientSecret }),
    }
  );
  if (!res.ok) {
    fail(`Infisical universal-auth login failed: HTTP ${res.status}`);
  }
  const body = (await res.json()) as { accessToken?: string };
  const token = body.accessToken?.trim() ?? '';
  if (token.length === 0) fail('Infisical login returned no access token');
  return token;
}

type CliLogin = {
  readonly email: string;
  readonly domain: string;
};

async function readCliLogin(store: ObjectStore): Promise<CliLogin | null> {
  const raw = await readUtf8(store, '.infisical/infisical-config.json');
  if (raw === null) return null;
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  const email =
    typeof parsed['loggedInUserEmail'] === 'string'
      ? parsed['loggedInUserEmail']
      : '';
  const rawDomain =
    typeof parsed['LoggedInUserDomain'] === 'string'
      ? parsed['LoggedInUserDomain']
      : '';
  if (email.length === 0) return null;
  return { email, domain: normalizeDomain(rawDomain.replace(/\/api$/, '')) };
}

function readCliKeychainToken(email: string): string | null {
  if (process.platform !== 'darwin') return null;
  const result = spawnSync(
    'security',
    ['find-generic-password', '-s', 'infisical-cli', '-a', email, '-w'],
    { encoding: 'utf8' }
  );
  if (result.status !== 0) return null;
  const raw = (result.stdout ?? '').trim();
  const base64 = raw.replace(/^go-keyring-base64:/, '');
  try {
    const json = JSON.parse(
      Buffer.from(base64, 'base64').toString('utf8')
    ) as Record<string, unknown>;
    const token =
      typeof json['JTWToken'] === 'string' ? json['JTWToken'].trim() : '';
    return token.length > 0 ? token : null;
  } catch {
    return null;
  }
}

async function resolveCliToken(args: {
  readonly domain: string;
  readonly log: ReconcileLog;
  readonly cliConfigStore: ObjectStore | null;
}): Promise<string | null> {
  if (args.cliConfigStore === null) return null;
  const login = await readCliLogin(args.cliConfigStore);
  if (login === null) return null;
  if (login.domain.length > 0 && login.domain !== args.domain) {
    args.log(
      `Skipping CLI session: logged into ${login.domain}, project domain is ${args.domain}.`
    );
    return null;
  }
  const token = readCliKeychainToken(login.email);
  if (token === null) return null;
  args.log(`Using logged-in Infisical CLI session (${login.email}).`);
  return token;
}

export async function resolveInfisicalAdminToken(args: {
  readonly domain: string;
  readonly log: ReconcileLog;
  readonly fail: ReconcileFail;
  readonly cliConfigStore?: ObjectStore | null;
}): Promise<string | null> {
  const explicit = trimEnv('SECRETS_TOKEN') || trimEnv('INFISICAL_TOKEN');
  if (explicit.length > 0) {
    args.log('Using SECRETS_TOKEN / INFISICAL_TOKEN from env.');
    return explicit;
  }
  const clientId = trimEnv('INFISICAL_CLIENT_ID');
  const clientSecret = trimEnv('INFISICAL_CLIENT_SECRET');
  if (clientId.length > 0 && clientSecret.length > 0) {
    args.log('Authenticating to Infisical via universal auth…');
    return loginUniversalAuth(args.domain, clientId, clientSecret, args.fail);
  }
  return resolveCliToken({
    domain: args.domain,
    log: args.log,
    cliConfigStore: args.cliConfigStore ?? null,
  });
}
