import {
  type ResolveInfisicalAccessTokenOptions,
  resolveInfisicalAccessTokenForWrites,
} from './impl-infisical/oidc-access-token';

export type ResolveWriteAccessTokenOptions = ResolveInfisicalAccessTokenOptions;

/**
 * Resolve a short-lived write token for the configured secrets backend.
 * Returns null when no token/OIDC path is available (read-only env mode).
 */
export async function resolveWriteAccessToken(
  options: ResolveWriteAccessTokenOptions
): Promise<string | null> {
  return resolveInfisicalAccessTokenForWrites(options);
}
