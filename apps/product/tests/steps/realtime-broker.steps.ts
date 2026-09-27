// @io-wall-ok — live health: the environment's EMQX broker.
/** `specs/health/live-updates.feature`. */

import { expect } from 'bun:test';
import { join } from 'node:path';
import { ClientConfigKey } from '@libs/client-config/public/client-config-keys';
import { parseClientConfigRows } from '@libs/client-config/public/parse-client-config';
import { PubsubSecretName as Name } from '@libs/pubsub/public/secret-names';
import { createHttpPubSubFromSecretStore } from '@libs/pubsub/root/server/create-http-pubsub-from-secret-store';
import {
  COMMITTED_EMQX_CREDENTIALS,
  EMQX_STOCK_DASHBOARD_PASSWORD,
} from '@pkgs/emqx-server/ports';
import type { HttpClient } from '@pkgs/http-client';
import { createRepoTreeObjectStore } from '@pkgs/object-store-node-fs/repo-tree-store';
import { createSecretAdminStore } from '@pkgs/secret-provider';
import { awaitApiAnswered, liveRows } from './client-config.steps';
import { eventually, Then } from './define';
import { type LiveWorld, requireSecret } from './live-world';
import { wallWait } from './wall-wait';

const REPO_ROOT = join(import.meta.dir, '../../../..');
/** A broker OpenTofu just created (or restarted) builds for a few minutes. */
const BROKER_WARMUP_MS = 10 * 60 * 1000;
const RETRY_MS = 10_000;

function basicAuth(): string {
  return `Basic ${btoa(`${requireSecret(Name.apiKey)}:${requireSecret(Name.apiSecret)}`)}`;
}

async function nodeStatuses(
  http: HttpClient
): Promise<readonly string[] | null> {
  try {
    const res = await http.fetch(`${requireSecret(Name.apiUrl)}/api/v5/nodes`, {
      headers: { Authorization: basicAuth(), Accept: 'application/json' },
    });
    if (res.status !== 200) return null;
    const nodes = (await res.json()) as ReadonlyArray<{ node_status?: string }>;
    return nodes.map((n) => n.node_status ?? 'unknown');
  } catch {
    return null;
  }
}

/**
 * `secrets-run` injected this process's env once, at the start of the run;
 * `apply:foundation` may have replaced the broker credentials since (a
 * placeholder or `regenerate`d value), so probe with the store's live values.
 */
const BROKER_CREDENTIALS = 'broker-credentials-current';

async function useCurrentBrokerCredentials(w: LiveWorld): Promise<void> {
  if (w.memo.has(BROKER_CREDENTIALS)) return;
  const store = await createSecretAdminStore({
    repoRoot: REPO_ROOT,
    configStore: createRepoTreeObjectStore({ rootDir: REPO_ROOT }),
  });
  const live = await store.exportSecrets(process.env['SECRETS_ENV']);
  for (const name of Object.values(Name)) {
    const value = live.get(name)?.trim() ?? '';
    if (value.length > 0) process.env[name] = value;
  }
  w.memo.set(BROKER_CREDENTIALS, true);
}

/** The broker's API authenticates and every node is running. */
Then('live updates are ready to reach people', async (w) => {
  await useCurrentBrokerCredentials(w);
  const seen: { statuses: readonly string[] | null } = { statuses: null };
  await eventually(
    async () => {
      seen.statuses = await nodeStatuses(w.http);
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
Then('the app can send a live update', async (w) => {
  await useCurrentBrokerCredentials(w);
  const pubsub = createHttpPubSubFromSecretStore({
    apiBaseUrl: requireSecret(Name.apiUrl),
    apiKey: requireSecret(Name.apiKey),
    apiSecret: requireSecret(Name.apiSecret),
  });
  await pubsub.publish('health-ping', { ok: true });
});

/**
 * Clients are given the broker's WSS address from the secret store, and it
 * points at the broker's host.
 */
Then(
  "people's apps are pointed at this environment's live updates",
  async (w) => {
    await useCurrentBrokerCredentials(w);
    await awaitApiAnswered(w);
    const wss = new URL(requireSecret(Name.wssUrl));
    expect(wss.protocol).toBe('wss:');
    expect(wss.hostname).toBe(new URL(requireSecret(Name.apiUrl)).hostname);
    const config = parseClientConfigRows(await liveRows());
    expect(config[ClientConfigKey.emqxWssUrl]).toBe(requireSecret(Name.wssUrl));
  }
);

/** The broker dashboard refuses the stock admin login. */
Then(
  'nobody can take over live updates with the default admin password',
  async (w) => {
    await useCurrentBrokerCredentials(w);
    const res = await w.http.fetch(
      `${requireSecret(Name.apiUrl)}/api/v5/login`,
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
  'nobody can take over live updates with a publicly known password',
  async (w) => {
    await useCurrentBrokerCredentials(w);
    const committed = [
      Name.apiKey,
      Name.apiSecret,
      Name.jwtSecret,
      Name.dashboardPassword,
    ].filter((name) => COMMITTED_EMQX_CREDENTIALS.has(requireSecret(name)));
    expect(committed).toEqual([]);
  }
);
