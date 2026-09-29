/**
 * The in-house IdP's configuration, read from the deployment's secrets and
 * bindings by name — the same way a hosted auth service's adapter would read
 * its API keys. Nothing outside this package knows these names or shapes.
 */
import {
  AuthProviderConfigError,
  type AuthProviderEnv,
} from '@pkgs/auth/server';

import {
  type AppleOauthEndpoints,
  GOOGLE_PRODUCTION_ENDPOINTS,
  type GoogleOauthEndpoints,
} from '../shared/auth-constants';
import { IDP_PROVIDER_LABEL } from '../shared/provider-label';
import {
  type OauthCallbackRelay,
  STATE_TAG_PATTERN,
} from './oauth-callback-relay';
import type { AppleProviderConfig } from './providers/apple-oauth';
import type { OauthProvidersConfig } from './providers/registry';
import type { SyntheticMonitorConfig } from './synthetic-monitor';

/** Every secret or binding the in-house IdP reads. */
export const INHOUSE_AUTH_SECRET = {
  /** HMAC key for session / state / ticket hashes (≥ 32 chars). */
  secret: 'AUTH_SECRET',
  googleClientId: 'WEB_CLIENT_GOOGLE_CLIENT_ID',
  googleClientSecret: 'WEB_CLIENT_GOOGLE_CLIENT_SECRET',
  /**
   * Origin of the OpenID provider to treat as Google. Unset means real
   * Google; harnesses and the localhost stack point it at a simulated provider.
   */
  googleIdpOrigin: 'GOOGLE_IDP_ORIGIN',
  /**
   * Sign in with Apple, **non-production only**: the simulated Apple
   * provider's origin plus the Services ID registration it knows this app
   * by, and the ES256 JWK the client secret is signed with. All five, or none.
   */
  appleIdpOrigin: 'APPLE_IDP_ORIGIN',
  appleClientId: 'APPLE_CLIENT_ID',
  appleTeamId: 'APPLE_TEAM_ID',
  appleKeyId: 'APPLE_KEY_ID',
  applePrivateJwk: 'APPLE_PRIVATE_JWK',
  /**
   * Bearer secret for the hidden synthetic-monitor sign-in (≥ 32 chars).
   * Unset disables the route. See `synthetic-monitor.ts`.
   */
  syntheticMonitorToken: 'SYNTHETIC_MONITOR_TOKEN',
  /**
   * Shared provider callback (see `oauth-callback-relay.ts`): the relay's
   * origin, whose callback is registered with providers, and this
   * deployment's state tag. Both or neither; unset means providers call this
   * deployment back directly.
   */
  oauthCallbackOrigin: 'OAUTH_CALLBACK_ORIGIN',
  oauthStateTag: 'OAUTH_STATE_TAG',
} as const;

/** Shorter tokens are refused: the route is reachable from the internet. */
const MIN_SYNTHETIC_MONITOR_TOKEN_LENGTH = 32;

export type InhouseAuthConfig = {
  readonly secret: string;
  readonly providers: OauthProvidersConfig;
  readonly syntheticMonitor?: SyntheticMonitorConfig;
  readonly callbackRelay?: OauthCallbackRelay;
};

function configError(message: string): AuthProviderConfigError {
  return new AuthProviderConfigError(IDP_PROVIDER_LABEL, message);
}

function trimOrigin(origin: string): string {
  return origin.replace(/\/$/, '');
}

/**
 * A simulated provider serves Google's paths from one origin
 * (`GOOGLE_IDP_ORIGIN`); production (`null`) spreads them across three hosts.
 */
export function googleEndpointsFor(
  idpOrigin: string | null
): GoogleOauthEndpoints {
  if (idpOrigin === null) return GOOGLE_PRODUCTION_ENDPOINTS;
  const base = trimOrigin(idpOrigin);
  return {
    authorizeUrl: `${base}/o/oauth2/v2/auth`,
    tokenUrl: `${base}/token`,
    userinfoUrl: `${base}/v1/userinfo`,
    revokeUrl: `${base}/revoke`,
  };
}

/** Sign in with Apple's paths on the simulated provider at `idpOrigin`. */
export function appleEndpointsFor(idpOrigin: string): AppleOauthEndpoints {
  const base = trimOrigin(idpOrigin);
  return {
    authorizeUrl: `${base}/auth/authorize`,
    tokenUrl: `${base}/auth/token`,
    jwksUrl: `${base}/auth/keys`,
    revokeUrl: `${base}/auth/revoke`,
  };
}

async function readGoogle(
  env: AuthProviderEnv
): Promise<OauthProvidersConfig['google']> {
  const [clientId, clientSecret, idpOrigin] = await Promise.all([
    env.readSecret(INHOUSE_AUTH_SECRET.googleClientId),
    env.readSecret(INHOUSE_AUTH_SECRET.googleClientSecret),
    env.readSecret(INHOUSE_AUTH_SECRET.googleIdpOrigin),
  ]);
  if (clientId === null || clientSecret === null) return undefined;
  return {
    clientId,
    clientSecret,
    endpoints: googleEndpointsFor(idpOrigin),
  };
}

function parseJwk(raw: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed !== null && typeof parsed === 'object') {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // Reported below.
  }
  throw configError(`${INHOUSE_AUTH_SECRET.applePrivateJwk} is not a JSON JWK`);
}

/**
 * The simulated Apple provider, when configured. Apple sign-in exists only to
 * run against the mock: in production it is refused outright, and a partial
 * set of bindings is a misconfiguration, not a degraded mode.
 */
async function readApple(
  env: AuthProviderEnv
): Promise<AppleProviderConfig | undefined> {
  const values = await Promise.all(
    [
      INHOUSE_AUTH_SECRET.appleIdpOrigin,
      INHOUSE_AUTH_SECRET.appleClientId,
      INHOUSE_AUTH_SECRET.appleTeamId,
      INHOUSE_AUTH_SECRET.appleKeyId,
      INHOUSE_AUTH_SECRET.applePrivateJwk,
    ].map((name) => env.readSecret(name))
  );
  if (values.every((value) => value === null)) return undefined;
  if (env.isProduction) {
    throw configError(
      'Sign in with Apple is mock-only: APPLE_* bindings are refused in production'
    );
  }
  const [origin, clientId, teamId, keyId, jwk] = values;
  if (
    origin == null ||
    clientId == null ||
    teamId == null ||
    keyId == null ||
    jwk == null
  ) {
    throw configError(
      'APPLE_IDP_ORIGIN, APPLE_CLIENT_ID, APPLE_TEAM_ID, APPLE_KEY_ID and APPLE_PRIVATE_JWK go together'
    );
  }
  return {
    clientId,
    teamId,
    keyId,
    privateJwk: parseJwk(jwk),
    issuer: trimOrigin(origin),
    endpoints: appleEndpointsFor(origin),
  };
}

async function readSyntheticMonitor(
  env: AuthProviderEnv
): Promise<SyntheticMonitorConfig | undefined> {
  const token = (
    await env.readSecret(INHOUSE_AUTH_SECRET.syntheticMonitorToken)
  )?.trim();
  if (token === undefined || token.length === 0) return undefined;
  if (token.length < MIN_SYNTHETIC_MONITOR_TOKEN_LENGTH) {
    throw configError(
      `${INHOUSE_AUTH_SECRET.syntheticMonitorToken} must be at least ${String(MIN_SYNTHETIC_MONITOR_TOKEN_LENGTH)} characters`
    );
  }
  return { token };
}

function httpOrigin(raw: string, name: string): string {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw configError(`${name}: "${raw}" is not a URL`);
  }
  const bare = trimOrigin(raw);
  if (!/^https?:$/.test(url.protocol) || url.origin !== bare) {
    throw configError(`${name}: "${raw}" must be a bare http(s) origin`);
  }
  return url.origin;
}

async function readCallbackRelay(
  env: AuthProviderEnv
): Promise<OauthCallbackRelay | undefined> {
  const [origin, tag] = await Promise.all([
    env.readSecret(INHOUSE_AUTH_SECRET.oauthCallbackOrigin),
    env.readSecret(INHOUSE_AUTH_SECRET.oauthStateTag),
  ]);
  if (origin === null && tag === null) return undefined;
  if (origin === null || tag === null) {
    throw configError(
      `${INHOUSE_AUTH_SECRET.oauthCallbackOrigin} and ${INHOUSE_AUTH_SECRET.oauthStateTag} go together`
    );
  }
  if (!STATE_TAG_PATTERN.test(tag)) {
    throw configError(
      `${INHOUSE_AUTH_SECRET.oauthStateTag}: "${tag}" must be a slug`
    );
  }
  return {
    callbackOrigin: httpOrigin(origin, INHOUSE_AUTH_SECRET.oauthCallbackOrigin),
    stateTag: tag,
  };
}

export async function readInhouseAuthConfig(
  env: AuthProviderEnv
): Promise<InhouseAuthConfig> {
  const secret = await env.readSecret(INHOUSE_AUTH_SECRET.secret);
  if (secret === null) {
    throw configError(`${INHOUSE_AUTH_SECRET.secret} is required`);
  }
  const [google, apple, syntheticMonitor, callbackRelay] = await Promise.all([
    readGoogle(env),
    readApple(env),
    readSyntheticMonitor(env),
    readCallbackRelay(env),
  ]);
  return {
    secret,
    providers: {
      ...(google === undefined ? {} : { google }),
      ...(apple === undefined ? {} : { apple }),
    },
    ...(syntheticMonitor === undefined ? {} : { syntheticMonitor }),
    ...(callbackRelay === undefined ? {} : { callbackRelay }),
  };
}
