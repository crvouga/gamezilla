import type { Timers } from '@pkgs/clock';
import type { HttpClient } from '@pkgs/http-client';
import { PubsubSecretName } from '../../public/secret-names';
import { isUnusableEmqxCredential } from '../secrets/emqx-credentials';

export type EmqxCredentials = {
  readonly apiKey: string;
  readonly apiSecret: string;
  readonly jwtSecret: string;
  readonly dashboardPassword: string;
};

export type ResolvedEmqxCredentials = {
  readonly credentials: EmqxCredentials;
  /** Secret names whose value was minted because it was missing or public. */
  readonly rotated: readonly string[];
};

/** Railway variable names the broker image reads at boot. */
export function emqxBrokerVariables(
  credentials: EmqxCredentials
): Readonly<Record<string, string>> {
  return {
    [PubsubSecretName.apiKey]: credentials.apiKey,
    [PubsubSecretName.apiSecret]: credentials.apiSecret,
    [PubsubSecretName.jwtSecret]: credentials.jwtSecret,
    [PubsubSecretName.dashboardPassword]: credentials.dashboardPassword,
  };
}

/**
 * Keep stored credentials unless they are missing or one of the committed
 * local-sidecar defaults; mint fresh ones otherwise.
 */
export function resolveEmqxCredentials(
  stored: ReadonlyMap<string, string>,
  randomHex: (bytes: number) => string
): ResolvedEmqxCredentials {
  const rotated: string[] = [];
  const pick = (name: string, mint: () => string): string => {
    const current = stored.get(name)?.trim() ?? '';
    if (!isUnusableEmqxCredential(current)) return current;
    rotated.push(name);
    return mint();
  };
  return {
    credentials: {
      apiKey: pick(PubsubSecretName.apiKey, () => `gamezilla-${randomHex(6)}`),
      apiSecret: pick(PubsubSecretName.apiSecret, () => randomHex(32)),
      jwtSecret: pick(PubsubSecretName.jwtSecret, () => randomHex(32)),
      dashboardPassword: pick(PubsubSecretName.dashboardPassword, () =>
        randomHex(24)
      ),
    },
    rotated,
  };
}

function basicAuth(credentials: EmqxCredentials): string {
  return `Basic ${btoa(`${credentials.apiKey}:${credentials.apiSecret}`)}`;
}

/** `true` when the HTTP API accepts `credentials` and every node runs. */
export async function brokerAcceptsCredentials(
  http: HttpClient,
  apiUrl: string,
  credentials: EmqxCredentials
): Promise<boolean> {
  try {
    const res = await http.fetch(`${apiUrl}/api/v5/nodes`, {
      headers: {
        Authorization: basicAuth(credentials),
        Accept: 'application/json',
      },
    });
    if (res.status !== 200) return false;
    const nodes = (await res.json()) as ReadonlyArray<{ node_status?: string }>;
    return nodes.length > 0 && nodes.every((n) => n.node_status === 'running');
  } catch {
    return false;
  }
}

export async function waitForBroker(options: {
  readonly http: HttpClient;
  readonly timers: Timers;
  readonly apiUrl: string;
  readonly credentials: EmqxCredentials;
  readonly attempts: number;
  readonly intervalMs: number;
}): Promise<void> {
  for (let i = 0; i < options.attempts; i++) {
    if (
      await brokerAcceptsCredentials(
        options.http,
        options.apiUrl,
        options.credentials
      )
    ) {
      return;
    }
    await new Promise<void>((resolve) => {
      options.timers.setTimeout(resolve, options.intervalMs);
    });
  }
  throw new Error(
    `EMQX at ${options.apiUrl} did not accept the provisioned credentials`
  );
}

async function dashboardToken(
  http: HttpClient,
  apiUrl: string,
  credentials: EmqxCredentials
): Promise<string> {
  const res = await http.fetch(`${apiUrl}/api/v5/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'admin',
      password: credentials.dashboardPassword,
    }),
  });
  if (!res.ok)
    throw new Error(`EMQX dashboard login failed: HTTP ${String(res.status)}`);
  return ((await res.json()) as { token: string }).token;
}

/**
 * Delete every API key except the provisioned one — keys from an earlier
 * bootstrap (e.g. the committed default) persist in the broker's volume.
 * EMQX manages API keys only through a dashboard session, not an API key.
 */
export async function deleteStaleApiKeys(
  http: HttpClient,
  apiUrl: string,
  credentials: EmqxCredentials
): Promise<readonly string[]> {
  const token = await dashboardToken(http, apiUrl, credentials);
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
  };
  const res = await http.fetch(`${apiUrl}/api/v5/api_key`, { headers });
  if (!res.ok)
    throw new Error(`EMQX api_key list failed: HTTP ${String(res.status)}`);
  const keys = (await res.json()) as ReadonlyArray<{
    name: string;
    api_key: string;
  }>;
  const stale = keys.filter((k) => k.api_key !== credentials.apiKey);
  for (const key of stale) {
    const del = await http.fetch(
      `${apiUrl}/api/v5/api_key/${encodeURIComponent(key.name)}`,
      { method: 'DELETE', headers }
    );
    if (!del.ok && del.status !== 404) {
      throw new Error(
        `EMQX api_key delete ${key.name} failed: HTTP ${String(del.status)}`
      );
    }
  }
  return stale.map((k) => k.name);
}
