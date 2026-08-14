import { globalHttpFetch } from '@pkgs/http-client';
import type { ObjectStore } from '@pkgs/object-store/interface';
import {
  SecretStoreParseError,
  SecretStoreRequestError,
} from '@pkgs/secret-store';
import { resolveSecretsScope } from '@pkgs/secrets-config';
import { resolveInfisicalEndpoint } from './resolve-endpoint';

function trimEnv(name: string): string {
  return (process.env[name] ?? '').trim();
}

function normalizeDomain(domain: string): string {
  return domain.replace(/\/+$/, '');
}

function resolveOidcAudience(): string {
  const explicit = trimEnv('INFISICAL_OIDC_AUDIENCE');
  if (explicit.length > 0) return explicit;
  const repo = trimEnv('GITHUB_REPOSITORY');
  if (repo.length > 0) {
    const owner = repo.split('/')[0] ?? '';
    if (owner.length > 0) return `https://github.com/${owner}`;
  }
  const identityAudience = trimEnv('SECRETS_OIDC_AUDIENCE');
  if (identityAudience.length > 0) return identityAudience;
  return 'https://github.com/crvouga';
}

async function fetchGithubActionsOidcJwt(audience: string): Promise<string> {
  const requestUrl = trimEnv('ACTIONS_ID_TOKEN_REQUEST_URL');
  const requestToken = trimEnv('ACTIONS_ID_TOKEN_REQUEST_TOKEN');
  if (requestUrl.length === 0 || requestToken.length === 0) {
    return '';
  }
  const url = `${requestUrl}&audience=${encodeURIComponent(audience)}`;
  const response = await globalHttpFetch(url, {
    headers: { Authorization: `Bearer ${requestToken}` },
  });
  if (!response.ok) {
    throw new SecretStoreRequestError(
      `GitHub OIDC token request failed: HTTP ${response.status}`,
      response.status
    );
  }
  const json: unknown = await response.json();
  if (json === null || typeof json !== 'object' || Array.isArray(json)) {
    throw new SecretStoreParseError(
      'GitHub OIDC token response: expected JSON object'
    );
  }
  const value = (json as Record<string, unknown>)['value'];
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new SecretStoreParseError(
      'GitHub OIDC token response: missing value field'
    );
  }
  return value.trim();
}

async function exchangeOidcJwtForInfisicalAccessToken(args: {
  readonly domain: string;
  readonly identityId: string;
  readonly jwt: string;
}): Promise<string> {
  const response = await globalHttpFetch(
    `${normalizeDomain(args.domain)}/api/v1/auth/oidc-auth/login`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        identityId: args.identityId,
        jwt: args.jwt,
      }),
    }
  );
  if (!response.ok) {
    throw new SecretStoreRequestError(
      `Infisical OIDC login failed: HTTP ${response.status}`,
      response.status
    );
  }
  const json: unknown = await response.json();
  if (json === null || typeof json !== 'object' || Array.isArray(json)) {
    throw new SecretStoreParseError(
      'Infisical OIDC login: expected JSON object body'
    );
  }
  const accessToken = (json as Record<string, unknown>)['accessToken'];
  if (typeof accessToken !== 'string' || accessToken.trim().length === 0) {
    throw new SecretStoreParseError(
      'Infisical OIDC login: missing accessToken field'
    );
  }
  return accessToken.trim();
}

export type ResolveInfisicalAccessTokenOptions = {
  readonly repoRoot: string;
  readonly configStore: ObjectStore;
  readonly secretsEnv?: string;
};

/**
 * Resolves a bearer token for Infisical write API / CLI calls during scripts/CI.
 * Prefers explicit tokens, then GitHub Actions OIDC (deploy pipeline).
 */
export async function resolveInfisicalAccessTokenForWrites(
  options: ResolveInfisicalAccessTokenOptions
): Promise<string | null> {
  const explicit =
    trimEnv('SECRETS_TOKEN') ||
    trimEnv('INFISICAL_TOKEN') ||
    trimEnv('INFISICAL_ACCESS_TOKEN');
  if (explicit.length > 0) return explicit;

  if (process.env['GITHUB_ACTIONS'] !== 'true') return null;

  const identityId =
    trimEnv('SECRETS_IDENTITY_ID') || trimEnv('INFISICAL_IDENTITY_ID');
  if (identityId.length === 0) return null;

  const audience = resolveOidcAudience();
  const jwt = await fetchGithubActionsOidcJwt(audience);
  if (jwt.length === 0) return null;

  const scope = await resolveSecretsScope(
    options.configStore,
    options.secretsEnv ?? (trimEnv('SECRETS_ENV') || undefined)
  );
  return exchangeOidcJwtForInfisicalAccessToken({
    domain: resolveInfisicalEndpoint(scope),
    identityId,
    jwt,
  });
}
