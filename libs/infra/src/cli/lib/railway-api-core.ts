/**
 * Railway public GraphQL transport.
 * Endpoint: https://backboard.railway.com/graphql/v2
 */
import { assert } from '@pkgs/assert';
import { fetchWithRetry } from '@pkgs/async/fetch-with-retry';

const RAILWAY_GQL = 'https://backboard.railway.com/graphql/v2';

type GqlError = { readonly message?: string };
type GqlBody<T> = {
  readonly data?: T;
  readonly errors?: readonly GqlError[];
};

export async function railwayGql<T>(
  token: string,
  query: string,
  variables?: Record<string, unknown>
): Promise<T> {
  const res = await fetchWithRetry(RAILWAY_GQL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Railway GraphQL HTTP ${String(res.status)}: ${text}`);
  }
  const body = JSON.parse(text) as GqlBody<T>;
  if (body.errors !== undefined && body.errors.length > 0) {
    throw new Error(
      `Railway GraphQL: ${body.errors.map((e) => e.message ?? 'error').join('; ')}`
    );
  }
  assert.ok(body.data !== undefined, 'Railway GraphQL returned no data');
  return body.data;
}

export async function validateRailwayToken(token: string): Promise<void> {
  await railwayGql<{ me: { id: string } }>(token, `query { me { id } }`);
}

export type RailwayProject = {
  readonly id: string;
  readonly name: string;
  readonly environmentId: string;
};

export type RailwayService = {
  readonly id: string;
  readonly name: string;
};

export type RailwayCustomDomain = {
  readonly id: string;
  readonly domain: string;
  readonly cnameTarget: string | null;
  readonly verificationToken: string | null;
};

export function pickProductionEnv(
  envs: ReadonlyArray<{ readonly id: string; readonly name: string }>
): string {
  const prod = envs.find((e) => e.name.toLowerCase() === 'production');
  return (prod ?? envs[0])?.id ?? '';
}
