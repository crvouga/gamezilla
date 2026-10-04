/**
 * Verifying provider-signed JWTs against the provider's published JWKS.
 *
 * The key set is fetched through the injected HTTP client and cached; a token
 * whose `kid` the cache does not know triggers exactly one refetch, which is
 * how a relying party survives a provider key rotation without either
 * refetching on every request or rejecting tokens minted a moment after the
 * rotation.
 */

import type { Clock } from '@pkgs/clock-shared/types';
import type { HttpClient } from '@pkgs/http-client-shared/types';
import {
  createLocalJWKSet,
  errors,
  type JSONWebKeySet,
  type JWTPayload,
  jwtVerify,
} from 'jose';

/** Accept this much disagreement between the provider's clock and ours. */
export const JWT_CLOCK_TOLERANCE_S = 60;

export type JwtExpectations = {
  readonly issuer: string;
  readonly audience: string;
};

export type JwksVerifier = (
  token: string,
  expect: JwtExpectations
) => Promise<JWTPayload>;

async function fetchJwks(
  http: HttpClient,
  url: string
): Promise<JSONWebKeySet> {
  const res = await http.fetch(url, { method: 'GET' });
  if (!res.ok) throw new Error(`jwks fetch failed: ${String(res.status)}`);
  const body: unknown = await res.json();
  if (body === null || typeof body !== 'object' || !('keys' in body)) {
    throw new Error('jwks response invalid');
  }
  return body as JSONWebKeySet;
}

export function createJwksVerifier(args: {
  readonly http: HttpClient;
  readonly jwksUrl: string;
  readonly clock: Clock;
}): JwksVerifier {
  let cached: JSONWebKeySet | null = null;
  const keys = async (refresh: boolean): Promise<JSONWebKeySet> => {
    if (cached === null || refresh) {
      cached = await fetchJwks(args.http, args.jwksUrl);
    }
    return cached;
  };
  const verifyWith = async (
    set: JSONWebKeySet,
    token: string,
    expect: JwtExpectations
  ): Promise<JWTPayload> => {
    const { payload } = await jwtVerify(token, createLocalJWKSet(set), {
      issuer: expect.issuer,
      audience: expect.audience,
      currentDate: new Date(args.clock.now()),
      clockTolerance: JWT_CLOCK_TOLERANCE_S,
    });
    return payload;
  };
  return async (token, expect) => {
    try {
      return await verifyWith(await keys(false), token, expect);
    } catch (error) {
      if (!(error instanceof errors.JWKSNoMatchingKey)) throw error;
      return await verifyWith(await keys(true), token, expect);
    }
  };
}
