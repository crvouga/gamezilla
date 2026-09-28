// @io-wall-ok — live health: the environment's EMQX broker.
/** `specs/health/live-updates.feature`. */

import { expect } from 'bun:test';
import { ClientConfigKey } from '@libs/client-config/public/client-config-keys';
import { parseClientConfigRows } from '@libs/client-config/public/parse-client-config';
import { PubsubSecretName as Name } from '@libs/pubsub/public/secret-names';
import { createHttpPubSubFromSecretStore } from '@libs/pubsub/root/server/create-http-pubsub-from-secret-store';
import {
  COMMITTED_EMQX_CREDENTIALS,
  EMQX_STOCK_DASHBOARD_PASSWORD,
} from '@pkgs/emqx-server/ports';
import type { HttpClient } from '@pkgs/http-client';
import { awaitApiAnswered, liveRows } from './client-config.steps';
import { eventually, Then } from './define';
import { liveSecret } from './live-secrets';
import type { LiveWorld } from './live-world';
import { wallWait } from './wall-wait';

/** A broker OpenTofu just created (or restarted) builds for a few minutes. */
const BROKER_WARMUP_MS = 10 * 60 * 1000;
const RETRY_MS = 10_000;

/**
 * The broker's credentials as the secret store holds them now: an apply may
 * have replaced them (a placeholder or `regenerate`d value) since the run's
 * env was injected.
 */
type Broker = {
  readonly apiUrl: string;
  readonly apiKey: string;
  readonly apiSecret: string;
};

async function broker(w: LiveWorld): Promise<Broker> {
  return {
    apiUrl: await liveSecret(w, Name.apiUrl),
    apiKey: await liveSecret(w, Name.apiKey),
    apiSecret: await liveSecret(w, Name.apiSecret),
  };
}

function basicAuth(b: Broker): string {
  return `Basic ${btoa(`${b.apiKey}:${b.apiSecret}`)}`;
}

async function nodeStatuses(
  http: HttpClient,
  b: Broker
): Promise<readonly string[] | null> {
  try {
    const res = await http.fetch(`${b.apiUrl}/api/v5/nodes`, {
      headers: { Authorization: basicAuth(b), Accept: 'application/json' },
    });
    if (res.status !== 200) return null;
    const nodes = (await res.json()) as ReadonlyArray<{ node_status?: string }>;
    return nodes.map((n) => n.node_status ?? 'unknown');
  } catch {
    return null;
  }
}

/** The broker's API authenticates and every node is running. */
Then('what happens in a space can reach everyone in it', async (w) => {
  const b = await broker(w);
  const seen: { statuses: readonly string[] | null } = { statuses: null };
  await eventually(
    async () => {
      seen.statuses = await nodeStatuses(w.http, b);
      return (
        seen.statuses !== null &&
        seen.statuses.length > 0 &&
        seen.statuses.every((s) => s === 'running')
      );
    },
    { maxWaitMs: BROKER_WARMUP_MS, retryMs: RETRY_MS, ...wallWait }
  );
  const last = seen.statuses;
  expect(last, 'EMQX API never authenticated').not.toBeNull();
  expect(last?.length ?? 0).toBeGreaterThan(0);
  expect(last).toEqual((last ?? []).map(() => 'running'));
});

/** The server's publish path accepts a message. */
Then('the app can pass on what happens in a space', async (w) => {
  const b = await broker(w);
  const pubsub = createHttpPubSubFromSecretStore({
    apiBaseUrl: b.apiUrl,
    apiKey: b.apiKey,
    apiSecret: b.apiSecret,
  });
  await pubsub.publish('health-ping', { ok: true });
});

/**
 * Clients are given the broker's WSS address from the secret store, and it
 * points at the broker's host.
 */
Then(
  "people's apps follow what happens in this environment's spaces",
  async (w) => {
    const wssUrl = await liveSecret(w, Name.wssUrl);
    await awaitApiAnswered(w);
    const wss = new URL(wssUrl);
    expect(wss.protocol).toBe('wss:');
    expect(wss.hostname).toBe(
      new URL(await liveSecret(w, Name.apiUrl)).hostname
    );
    const config = parseClientConfigRows(await liveRows());
    expect(config[ClientConfigKey.emqxWssUrl]).toBe(wssUrl);
  }
);

/** The broker dashboard refuses the stock admin login. */
Then(
  'nobody can listen in on spaces or disturb them with the default password',
  async (w) => {
    const res = await w.http.fetch(
      `${await liveSecret(w, Name.apiUrl)}/api/v5/login`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'admin',
          password: EMQX_STOCK_DASHBOARD_PASSWORD,
        }),
      }
    );
    await res.body?.cancel();
    expect(res.status).toBe(401);
  }
);

/** No broker credential is one of the committed public credentials. */
Then(
  'nobody can listen in on spaces or disturb them with a publicly known password',
  async (w) => {
    const committed: string[] = [];
    for (const name of [
      Name.apiKey,
      Name.apiSecret,
      Name.jwtSecret,
      Name.dashboardPassword,
    ]) {
      if (COMMITTED_EMQX_CREDENTIALS.has(await liveSecret(w, name))) {
        committed.push(name);
      }
    }
    expect(committed).toEqual([]);
  }
);
