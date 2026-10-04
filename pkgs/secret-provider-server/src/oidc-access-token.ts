import type { Clock } from '@pkgs/clock-shared/types';
import { globalHttpFetch } from '@pkgs/http-client-shared/global';
import type { ObjectStore } from '@pkgs/object-store-root-shared/interface';
import { resolveInfisicalEndpoint } from '@pkgs/secret-provider-shared/resolve-endpoint';
import { SecretStoreParseError } from '@pkgs/secret-store-shared/secret-store-parse-error';
import { SecretStoreRequestError } from '@pkgs/secret-store-shared/secret-store-request-error';
import { resolveSecretsScope } from '@pkgs/secrets-config-server/secrets-scope';

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
  throw new SecretStoreParseError(
    'OIDC audience needs INFISICAL_OIDC_AUDIENCE, SECRETS_OIDC_AUDIENCE or GITHUB_REPOSITORY'
  );
}

async function fetchCiOidcJwt(audience: string): Promise<string> {
  const requestUrl = trimEnv('ACTIONS_ID_TOKEN_REQUEST_URL');
  const requestToken = trimEnv('ACTIONS_ID_TOKEN_REQUEST_TOKEN');
  if (requestUrl.length === 0 || requestToken.length === 0) {
    return '';
  }
  const url = new URL(requestUrl);
  url.searchParams.set('audience', audience);
  const response = await globalHttpFetch(url.toString(), {
    headers: { Authorization: `Bearer ${requestToken}` },
  });
  if (!response.ok) {
    throw new SecretStoreRequestError(
      `CI OIDC token request failed: HTTP ${response.status}`,
      response.status
    );
  }
  const json: unknown = await response.json();
  if (json === null || typeof json !== 'object' || Array.isArray(json)) {
    throw new SecretStoreParseError(
      'CI OIDC token response: expected JSON object'
    );
  }
  const value = (json as Record<string, unknown>)['value'];
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new SecretStoreParseError(
      'CI OIDC token response: missing value field'
    );
  }
  return value.trim();
}

/**
 * Set beside a token this module minted: when it stops being valid (epoch
 * ms). A token without it is the caller's own and is used as is. It travels
 * in the environment so a child process that inherits a minted token also
 * knows to mint a new one — the CI identity's tokens live 10 minutes
 * (`modules/ci-identity`), shorter than a Deploy or Health run.
 */
export const MINTED_TOKEN_EXPIRES_AT = 'INFISICAL_TOKEN_EXPIRES_AT';

/** Mint a new token this long before the old one expires. */
const REFRESH_MARGIN_MS = 60_000;

/** When Infisical's login answer carries no `expiresIn`. */
const DEFAULT_LIFETIME_SECONDS = 300;

type MintedToken = { readonly token: string; readonly lifetimeSeconds: number };

/** True when the environment's token was minted here and is about to expire. */
function mintedTokenExpiring(now: number): boolean {
  const expiresAt = Number(trimEnv(MINTED_TOKEN_EXPIRES_AT));
  return (
    trimEnv(MINTED_TOKEN_EXPIRES_AT).length > 0 &&
    Number.isFinite(expiresAt) &&
    now >= expiresAt - REFRESH_MARGIN_MS
  );
}

/**
 * Publish a minted token where the CLI (`INFISICAL_TOKEN`) and tooling stores
 * (`SECRETS_TOKEN`) read it, replacing an earlier minted one but never a
 * token the caller set.
 */
function publishMintedToken(minted: MintedToken, now: number): void {
  const previous = trimEnv('INFISICAL_TOKEN');
  process.env['INFISICAL_TOKEN'] = minted.token;
  const secretsToken = trimEnv('SECRETS_TOKEN');
  if (secretsToken.length === 0 || secretsToken === previous) {
    process.env['SECRETS_TOKEN'] = minted.token;
  }
  process.env[MINTED_TOKEN_EXPIRES_AT] = String(
    now + minted.lifetimeSeconds * 1000
  );
}

async function exchangeOidcJwtForInfisicalAccessToken(args: {
  readonly domain: string;
  readonly identityId: string;
  readonly jwt: string;
}): Promise<MintedToken> {
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
  const expiresIn = (json as Record<string, unknown>)['expiresIn'];
  return {
    token: accessToken.trim(),
    lifetimeSeconds:
      typeof expiresIn === 'number' && expiresIn > 0
        ? expiresIn
        : DEFAULT_LIFETIME_SECONDS,
  };
}

export type ResolveInfisicalAccessTokenOptions = {
  readonly repoRoot: string;
  readonly configStore: ObjectStore;
  readonly secretsEnv?: string;
  /** Tells when a minted token is due for replacement. */
  readonly clock: Clock;
};

/**
 * Resolves a bearer token for Infisical write API / CLI calls during scripts/CI.
 * Prefers explicit tokens, then CI OIDC (CI workflows). A token
 * minted here is published to the environment and minted again shortly
 * before it expires, so call this before every use rather than once.
 */
export async function resolveInfisicalAccessTokenForWrites(
  options: ResolveInfisicalAccessTokenOptions
): Promise<string | null> {
  const now = options.clock.now();
  const explicit =
    trimEnv('SECRETS_TOKEN') ||
    trimEnv('INFISICAL_TOKEN') ||
    trimEnv('INFISICAL_ACCESS_TOKEN');
  if (explicit.length > 0 && !mintedTokenExpiring(now)) return explicit;
  // An expiring minted token is still the best answer when no new one can be minted.
  const fallback = explicit.length > 0 ? explicit : null;

  if (process.env['GITHUB_ACTIONS'] !== 'true') return fallback;

  const identityId =
    trimEnv('SECRETS_IDENTITY_ID') || trimEnv('INFISICAL_IDENTITY_ID');
  if (identityId.length === 0) return fallback;

  const audience = resolveOidcAudience();
  const jwt = await fetchCiOidcJwt(audience);
  if (jwt.length === 0) return fallback;

  const scope = await resolveSecretsScope(
    options.configStore,
    options.secretsEnv ?? (trimEnv('SECRETS_ENV') || undefined)
  );
  const minted = await exchangeOidcJwtForInfisicalAccessToken({
    domain: resolveInfisicalEndpoint(scope),
    identityId,
    jwt,
  });
  publishMintedToken(minted, now);
  return minted.token;
}
